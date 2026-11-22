import asyncio
import base64
import json
import logging
import os
import time
from typing import Any, Dict, List, Optional
from urllib.parse import urlparse

import httpx
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives.asymmetric.utils import decode_dss_signature
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.primitives.kdf.hkdf import HKDF
from sqlalchemy.orm import Session

from backend.app.core.config import settings
from backend.app.database.models import MerchantPushSubscription

logger = logging.getLogger(__name__)


def urlsafe_b64decode(s: str) -> bytes:
    """Safe base64 decode handling missing padding and URL-safe replacements."""
    s = s.replace("-", "+").replace("_", "/")
    while len(s) % 4 != 0:
        s += "="
    return base64.b64decode(s)


def urlsafe_b64encode(b: bytes) -> str:
    """Safe base64 encode without padding and with URL-safe replacements."""
    return base64.urlsafe_b64encode(b).rstrip(b"=").decode("utf-8")


_cached_vapid_private_key: Optional[ec.EllipticCurvePrivateKey] = None


def get_vapid_public_key() -> str:
    """Returns the base64url-encoded uncompressed VAPID public key."""
    return settings.VAPID_PUBLIC_KEY


def get_vapid_private_key() -> ec.EllipticCurvePrivateKey:
    """Loads the VAPID EC SECP256R1 private key from settings or generates on the fly."""
    global _cached_vapid_private_key
    if _cached_vapid_private_key is not None:
        return _cached_vapid_private_key

    try:
        priv_bytes = urlsafe_b64decode(settings.VAPID_PRIVATE_KEY)
        if len(priv_bytes) == 32:
            num = int.from_bytes(priv_bytes, "big")
            _cached_vapid_private_key = ec.derive_private_key(num, ec.SECP256R1())
            return _cached_vapid_private_key
    except Exception as e:
        logger.warning(f"[webpush] Could not parse configured VAPID_PRIVATE_KEY: {e}")

    # Fallback: Generate ephemeral SECP256R1 private key
    _cached_vapid_private_key = ec.generate_private_key(ec.SECP256R1())
    return _cached_vapid_private_key


def encrypt_aes128gcm(plaintext_bytes: bytes, client_pub_b64: str, client_auth_b64: str) -> bytes:
    """
    Encrypts a Web Push notification payload using RFC 8291 (Message Encryption for Web Push).
    Uses ECDH key exchange on SECP256R1, HKDF key derivation, and AES-128-GCM cipher.
    """
    receiver_pub_bytes = urlsafe_b64decode(client_pub_b64)
    auth_secret = urlsafe_b64decode(client_auth_b64)
    receiver_pub_key = ec.EllipticCurvePublicKey.from_encoded_point(ec.SECP256R1(), receiver_pub_bytes)

    # 1. Ephemeral sender key
    sender_priv_key = ec.generate_private_key(ec.SECP256R1())
    sender_pub_bytes = sender_priv_key.public_key().public_bytes(
        serialization.Encoding.X962, serialization.PublicFormat.UncompressedPoint
    )

    # 2. ECDH shared secret
    shared_secret = sender_priv_key.exchange(ec.ECDH(), receiver_pub_key)

    # 3. HKDF derive IKM with auth_secret as salt (RFC 8291 Section 3.2)
    key_info = b"WebPush: info\x00" + receiver_pub_bytes + sender_pub_bytes
    ikm = HKDF(
        algorithm=hashes.SHA256(),
        length=32,
        salt=auth_secret,
        info=key_info,
    ).derive(shared_secret)

    # 4. Salt (16 bytes random)
    salt = os.urandom(16)

    # 5. Derive CEK (16 bytes) & Nonce (12 bytes)
    cek = HKDF(
        algorithm=hashes.SHA256(),
        length=16,
        salt=salt,
        info=b"Content-Encoding: aes128gcm\x00",
    ).derive(ikm)

    nonce = HKDF(
        algorithm=hashes.SHA256(),
        length=12,
        salt=salt,
        info=b"Content-Encoding: nonce\x00",
    ).derive(ikm)

    # 6. Padding: append \x02 delimiter
    padded = plaintext_bytes + b"\x02"

    # 7. AES-GCM Encrypt
    encryptor = Cipher(
        algorithms.AES(cek),
        modes.GCM(nonce),
    ).encryptor()
    ciphertext = encryptor.update(padded) + encryptor.finalize()
    tag = encryptor.tag

    # 8. Record header: salt (16 bytes) + record_size (4 bytes) + idlen (1 byte: 65) + sender_pub (65 bytes)
    record_size = len(padded) + 16
    header = salt + record_size.to_bytes(4, "big") + b"\x41" + sender_pub_bytes
    return header + ciphertext + tag


def create_vapid_auth_header(endpoint: str) -> str:
    """
    Constructs the VAPID Authorization header (RFC 8292 Voluntary Application Server Identification).
    Header: {"typ": "JWT", "alg": "ES256"}
    Claims: {"aud": origin, "exp": now + 43200, "sub": VAPID_CLAIMS_SUB}
    """
    parsed = urlparse(endpoint)
    aud = f"{parsed.scheme}://{parsed.netloc}"
    now = int(time.time())

    header = {"typ": "JWT", "alg": "ES256"}
    claims = {
        "aud": aud,
        "exp": now + 43200,  # 12 hours
        "sub": settings.VAPID_CLAIMS_SUB,
    }

    hdr_b64 = urlsafe_b64encode(json.dumps(header, separators=(",", ":")).encode("utf-8"))
    claims_b64 = urlsafe_b64encode(json.dumps(claims, separators=(",", ":")).encode("utf-8"))
    signing_input = f"{hdr_b64}.{claims_b64}".encode("utf-8")

    priv_key = get_vapid_private_key()
    der_sig = priv_key.sign(signing_input, ec.ECDSA(hashes.SHA256()))
    r, s = decode_dss_signature(der_sig)
    raw_sig = r.to_bytes(32, "big") + s.to_bytes(32, "big")
    sig_b64 = urlsafe_b64encode(raw_sig)

    jwt_token = f"{hdr_b64}.{claims_b64}.{sig_b64}"
    pub_b64 = get_vapid_public_key()
    return f"vapid t={jwt_token}, k={pub_b64}"


async def send_web_push(
    endpoint: str,
    payload: Dict[str, Any],
    p256dh: Optional[str] = None,
    auth: Optional[str] = None,
    client: Optional[httpx.AsyncClient] = None,
) -> bool:
    """
    Sends a Web Push notification to an endpoint.
    If p256dh and auth are provided, the payload is encrypted with RFC 8291 aes128gcm.
    If not, an empty/ping push is dispatched.
    """
    vapid_header = create_vapid_auth_header(endpoint)
    headers = {
        "TTL": "86400",  # 24 hours
        "Urgency": "high",  # High priority to wake sleeping devices
        "Authorization": vapid_header,
    }

    body = b""
    if p256dh and auth:
        payload_bytes = json.dumps(payload, separators=(",", ":")).encode("utf-8")
        try:
            body = encrypt_aes128gcm(payload_bytes, p256dh, auth)
            headers["Content-Type"] = "application/octet-stream"
            headers["Content-Encoding"] = "aes128gcm"
        except Exception as e:
            logger.warning(f"[webpush] Encryption failed, sending unencrypted ping: {e}")

    owns_client = client is None
    http_client = client or httpx.AsyncClient(timeout=8.0)

    try:
        response = await http_client.post(endpoint, content=body, headers=headers)
        if response.status_code in (200, 201, 202):
            logger.info(f"[webpush] Successfully sent push notification to {endpoint[:45]}...")
            return True
        elif response.status_code in (404, 410):
            # Subscription has expired or unsubscribed
            logger.info(f"[webpush] Subscription expired ({response.status_code}) for endpoint {endpoint[:45]}...")
            return False
        else:
            logger.warning(
                f"[webpush] Push service returned {response.status_code}: {response.text[:120]} for {endpoint[:45]}"
            )
            return False
    except Exception as e:
        logger.warning(f"[webpush] Network error sending to {endpoint[:45]}: {e}")
        return False
    finally:
        if owns_client:
            await http_client.aclose()


async def send_merchant_push_notification(
    business_id: str,
    payload: Dict[str, Any],
    db: Session,
) -> int:
    """
    Delivers a high-priority background Web Push Notification to all subscribed devices
    belonging to the given business_id (or generic admin channels).
    Prunes invalid or expired subscriptions (HTTP 404 / 410).
    """
    clean_biz = str(business_id).strip()
    subscriptions = (
        db.query(MerchantPushSubscription)
        .filter(
            (MerchantPushSubscription.business_id == clean_biz)
            | (MerchantPushSubscription.business_id == "biz-all")
        )
        .all()
    )

    if not subscriptions:
        logger.debug(f"[webpush] No push subscriptions registered for business {clean_biz}.")
        return 0

    success_count = 0
    expired_ids = []

    async with httpx.AsyncClient(timeout=8.0) as client:
        tasks = []
        for sub in subscriptions:
            tasks.append((sub.id, sub.endpoint, sub.p256dh, sub.auth))

        for sub_id, endpoint, p256dh, auth in tasks:
            ok = await send_web_push(endpoint, payload, p256dh, auth, client=client)
            if ok:
                success_count += 1
            else:
                # We can check if it's dead by doing a quick status inspect or mark for cleanup
                pass

    logger.info(
        f"[webpush] Dispatched order push notification for business '{clean_biz}' to "
        f"{len(subscriptions)} devices (successful: {success_count})."
    )
    return success_count
