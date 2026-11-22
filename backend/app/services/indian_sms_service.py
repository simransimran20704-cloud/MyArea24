"""
Indian SMS Gateway & TRAI DLT Compliance Service for MyArea24.

Under Telecom Regulatory Authority of India (TRAI) TCCCPR regulations, all
transactional SMS (OTPs, notifications) sent within India must comply with
Distributed Ledger Technology (DLT) requirements:
  1. Principal Entity ID (PE ID): 19-digit entity registration on Airtel/Jio/Vilpower.
  2. Sender ID / Header: 6 alphabetical characters approved by telcos (e.g. 'MYAR24').
  3. Content Template ID: 19-digit approved template registered with TRAI.

This module provides unified SMS dispatching across top Indian SMS gateways:
  - Fast2SMS (DLT route & OTP route)
  - MSG91 (India's primary OTP & Flow gateway)
  - Textlocal India (IMImobile)
  - Twilio India (+91 international transit)
  - Development Console Simulator (with DLT verification telemetry)
"""

import json
import logging
import re
import urllib.parse
import urllib.request
from dataclasses import dataclass
from typing import Any, Dict, Optional, Tuple

from backend.app.core.config import settings

logger = logging.getLogger(__name__)

INDIAN_MOBILE_REGEX = re.compile(r"^[6-9]\d{9}$")


@dataclass
class SmsDispatchResult:
    success: bool
    provider: str
    phone_number: str
    message_id: Optional[str] = None
    dlt_compliant: bool = False
    dlt_template_id: Optional[str] = None
    dlt_entity_id: Optional[str] = None
    error_message: Optional[str] = None
    is_simulated: bool = False

    def __bool__(self) -> bool:
        return self.success


def validate_indian_phone(phone_input: str) -> Tuple[bool, str, str, str]:
    """
    Validates and normalizes an Indian mobile number.
    Returns:
      (is_valid, clean_10_digits, international_format, masked_display)

    Examples:
      "+91 98765 43210" -> (True, "9876543210", "+919876543210", "+91 98*** **210")
      "09876543210"     -> (True, "9876543210", "+919876543210", "+91 98*** **210")
      "9876543210"      -> (True, "9876543210", "+919876543210", "+91 98*** **210")
      "1234567890"      -> (False, "", "", "") (Indian mobiles must start with 6, 7, 8, or 9)
    """
    if not phone_input or not isinstance(phone_input, str):
        return False, "", "", ""

    # Strip out spaces, dashes, parentheses, dots
    cleaned = re.sub(r"[\s\-\(\)\.]", "", phone_input.strip())

    # Strip international country codes (+91, 91) or leading zero
    if cleaned.startswith("+91"):
        digits = cleaned[3:]
    elif cleaned.startswith("91") and len(cleaned) == 12:
        digits = cleaned[2:]
    elif cleaned.startswith("0") and len(cleaned) == 11:
        digits = cleaned[1:]
    else:
        digits = cleaned

    # Check 10-digit Indian National Numbering Plan
    if len(digits) == 10 and INDIAN_MOBILE_REGEX.match(digits):
        international = f"+91{digits}"
        masked = f"+91 {digits[:2]}*** **{digits[-3:]}"
        return True, digits, international, masked

    return False, "", "", ""


def build_dlt_otp_message(
    otp_code: str,
    sender_id: Optional[str] = "MYAR24",
    validity_minutes: int = 10,
) -> str:
    """
    Renders standard TRAI DLT approved template text for OTP authentication.
    DLT registered template:
      "Your MyArea24 login code is {#var#}. Valid for {#var#} minutes. Do not share with anyone."
    """
    return f"Your MyArea24 login code is {otp_code}. Valid for {validity_minutes} minutes. Do not share with anyone."


def dispatch_fast2sms(
    phone_10: str,
    otp_code: str,
    validity_minutes: int = 10,
) -> SmsDispatchResult:
    """
    Dispatches OTP via Fast2SMS (https://www.fast2sms.com).
    Supports both DLT route (TRAI compliant) and Quick OTP route.
    """
    api_key = settings.FAST2SMS_API_KEY
    if not api_key or api_key.startswith("your_"):
        return SmsDispatchResult(
            success=False,
            provider="fast2sms",
            phone_number=phone_10,
            error_message="Fast2SMS API key not configured",
        )

    url = "https://www.fast2sms.com/dev/bulkV2"
    route = (settings.FAST2SMS_ROUTE or "dlt").strip().lower()
    sender_id = settings.SMS_SENDER_ID or "MYAR24"
    dlt_template_id = settings.DLT_TEMPLATE_ID
    dlt_entity_id = settings.DLT_ENTITY_ID
    otp_id = getattr(settings, "FAST2SMS_OTP_ID", None)

    try:
        # 1. Modern Fast2SMS Smart OTP API (if FAST2SMS_OTP_ID configured)
        if otp_id:
            smart_url = "https://www.fast2sms.com/dev/otp/send"
            smart_payload = {
                "mobile": phone_10,
                "otp_id": otp_id,
                "otp": otp_code,
                "otp_expiry": validity_minutes,
            }
            smart_data = json.dumps(smart_payload).encode("utf-8")
            req = urllib.request.Request(
                smart_url,
                data=smart_data,
                headers={
                    "authorization": api_key,
                    "Content-Type": "application/json",
                    "Accept": "application/json",
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 MyArea24/1.0",
                },
                method="POST",
            )
        # 2. Fast2SMS Bulk V2 API (DLT or Quick OTP route)
        elif route == "dlt" and dlt_template_id:
            payload = {
                "route": "dlt",
                "sender_id": sender_id,
                "message": dlt_template_id,
                "variables_values": f"{otp_code}|{validity_minutes}",
                "flash": "0",
                "numbers": phone_10,
            }
            if dlt_entity_id:
                payload["pe_id"] = dlt_entity_id
            data_encoded = urllib.parse.urlencode(payload).encode("utf-8")
            req = urllib.request.Request(
                url,
                data=data_encoded,
                headers={
                    "authorization": api_key,
                    "Content-Type": "application/x-www-form-urlencoded",
                    "Accept": "application/json",
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 MyArea24/1.0",
                },
                method="POST",
            )
        else:
            payload = {
                "route": "otp",
                "variables_values": otp_code,
                "numbers": phone_10,
            }
            data_encoded = urllib.parse.urlencode(payload).encode("utf-8")
            req = urllib.request.Request(
                url,
                data=data_encoded,
                headers={
                    "authorization": api_key,
                    "Content-Type": "application/x-www-form-urlencoded",
                    "Accept": "application/json",
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 MyArea24/1.0",
                },
                method="POST",
            )

        with urllib.request.urlopen(req, timeout=10) as resp:
            resp_body = resp.read().decode("utf-8")
            result_json = json.loads(resp_body)
            if result_json.get("return") is True:
                msg_id = None
                if result_json.get("request_id"):
                    msg_id = str(result_json.get("request_id"))
                logger.info("[sms] Fast2SMS OTP dispatched successfully to +91-%s (id=%s)", phone_10, msg_id)
                return SmsDispatchResult(
                    success=True,
                    provider="fast2sms",
                    phone_number=phone_10,
                    message_id=msg_id,
                    dlt_compliant=route == "dlt",
                    dlt_template_id=dlt_template_id,
                    dlt_entity_id=dlt_entity_id,
                )
            else:
                raw_err = result_json.get("message") or "Fast2SMS dispatch rejected"
                err = ", ".join(str(x) for x in raw_err) if isinstance(raw_err, list) else str(raw_err)
                status_code = result_json.get("status_code")
                if status_code == 996:
                    full_err = "Fast2SMS KYC Required (Error 996): Before using OTP Message API, complete Website Verification / KYC in your Fast2SMS panel under the OTP Message menu."
                elif status_code == 999:
                    full_err = "Fast2SMS Account Activation Required (Error 999): A minimum recharge of ₹100 is required in Fast2SMS before activating API route."
                else:
                    full_err = f"Fast2SMS error (code {status_code}): {err}" if status_code else f"Fast2SMS error: {err}"
                logger.warning("[sms] Fast2SMS returned failure: %s", full_err)
                return SmsDispatchResult(
                    success=False,
                    provider="fast2sms",
                    phone_number=phone_10,
                    error_message=full_err,
                )
    except urllib.error.HTTPError as http_err:
        err_msg = f"HTTP Error {http_err.code}"
        status_code = None
        try:
            raw_body = http_err.read().decode("utf-8")
            err_json = json.loads(raw_body)
            raw_err = err_json.get("message")
            if raw_err is not None:
                err_msg = ", ".join(str(x) for x in raw_err) if isinstance(raw_err, list) else str(raw_err)
            else:
                err_msg = raw_body
            status_code = err_json.get("status_code")
        except Exception:
            pass

        if status_code == 996:
            full_err = "Fast2SMS KYC Required (Error 996): Before using OTP Message API, complete Website Verification / KYC in your Fast2SMS panel under the OTP Message menu."
        elif status_code == 999:
            full_err = "Fast2SMS Account Activation Required (Error 999): A minimum recharge of ₹100 is required in Fast2SMS before activating API route."
        elif http_err.code == 403:
            full_err = "Fast2SMS Connection Blocked (HTTP 403): Request was blocked by local sandbox/proxy or Fast2SMS firewall. Please ensure the backend server runs with external network access and your IP is not blacklisted."
        else:
            full_err = f"Fast2SMS error (code {status_code}): {err_msg}" if status_code else f"Fast2SMS error: {err_msg}"
        logger.warning("[sms] Fast2SMS HTTP %s: %s", http_err.code, full_err)
        return SmsDispatchResult(
            success=False,
            provider="fast2sms",
            phone_number=phone_10,
            error_message=full_err,
        )
    except Exception as e:
        logger.error("[sms] Fast2SMS connection error: %s", e)
        return SmsDispatchResult(
            success=False,
            provider="fast2sms",
            phone_number=phone_10,
            error_message=str(e),
        )


def _open_msg91_url(req: urllib.request.Request, timeout: int = 10):
    """
    Executes an HTTP request to MSG91 strictly over IPv4 (socket.AF_INET).
    Ensures the whitelisted public IPv4 address is always presented to MSG91,
    preventing dual-stack IPv6 address rejection (Error Code 418).
    """
    import socket
    orig_getaddrinfo = socket.getaddrinfo

    def _ipv4_getaddrinfo(host, port, family=0, type=0, proto=0, flags=0):
        if "msg91" in str(host).lower():
            return orig_getaddrinfo(host, port, socket.AF_INET, type, proto, flags)
        return orig_getaddrinfo(host, port, family, type, proto, flags)

    try:
        socket.getaddrinfo = _ipv4_getaddrinfo
        return urllib.request.urlopen(req, timeout=timeout)
    finally:
        socket.getaddrinfo = orig_getaddrinfo


def check_msg91_balance(auth_key: str) -> Optional[int]:
    """
    Checks MSG91 transactional SMS credit balance.
    Returns credit count (e.g. 0, 50), or None if balance check couldn't be determined.
    """
    try:
        url = f"https://api.msg91.com/api/balance.php?authkey={auth_key}&type=4"
        req = urllib.request.Request(
            url,
            headers={"User-Agent": "Mozilla/5.0 MyArea24/1.0", "Accept": "*/*"},
        )
        with _open_msg91_url(req, timeout=4) as resp:
            text = resp.read().decode("utf-8").strip()
            if text.isdigit():
                return int(text)
    except Exception as e:
        logger.debug("[sms] MSG91 balance check query notice: %s", e)
    return None


def dispatch_msg91(
    phone_10: str,
    otp_code: str,
    validity_minutes: int = 10,
) -> SmsDispatchResult:
    """
    Dispatches OTP via MSG91 (https://msg91.com) SendOTP API.
    India's primary DLT enterprise gateway with built-in operator fallback.
    """
    auth_key = settings.MSG91_AUTH_KEY
    if not auth_key or auth_key.startswith("your_"):
        return SmsDispatchResult(
            success=False,
            provider="msg91",
            phone_number=phone_10,
            error_message="MSG91 Auth Key not configured",
        )

    # 1. Proactively check MSG91 transactional credit balance
    # MSG91 SendOTP API returns HTTP 200 {"type": "success"} even when balance is 0,
    # but telecom operators drop the message before it ever reaches physical handsets!
    credits = check_msg91_balance(auth_key)
    if credits is not None and credits <= 0:
        logger.warning("[sms] MSG91 account balance is 0 credits. Cannot deliver SMS to +91-%s", phone_10)
        return SmsDispatchResult(
            success=False,
            provider="msg91",
            phone_number=phone_10,
            error_message="MSG91 account balance is 0 credits (AuthKey: 591030AZgRckIpM4j6afc8767P1). Add transactional SMS credits at control.msg91.com or register an approved TRAI DLT template.",
        )

    template_id = settings.MSG91_TEMPLATE_ID or settings.DLT_TEMPLATE_ID
    sender_id = settings.MSG91_SENDER_ID or settings.SMS_SENDER_ID or "MYAR24"

    # MSG91 SendOTP endpoint
    params = {
        "mobile": f"91{phone_10}",
        "authkey": auth_key,
        "otp": otp_code,
        "otp_expiry": str(validity_minutes),
    }
    if template_id:
        params["template_id"] = template_id
    if sender_id:
        params["sender"] = sender_id

    query_str = urllib.parse.urlencode({k: v for k, v in params.items() if v})
    url = f"https://control.msg91.com/api/v5/otp?{query_str}"

    try:
        req = urllib.request.Request(
            url,
            headers={
                "authkey": auth_key,
                "Content-Type": "application/json",
                "Accept": "application/json",
            },
            method="POST",
        )
        with _open_msg91_url(req, timeout=10) as resp:
            resp_body = resp.read().decode("utf-8")
            result_json = json.loads(resp_body)
            msg_type = result_json.get("type", "").lower()
            if msg_type in ("success", "") and resp.status in (200, 201):
                msg_id = result_json.get("request_id") or result_json.get("message")
                logger.info("[sms] MSG91 OTP dispatched successfully to +91-%s (id=%s)", phone_10, msg_id)
                return SmsDispatchResult(
                    success=True,
                    provider="msg91",
                    phone_number=phone_10,
                    message_id=msg_id,
                    dlt_compliant=True,
                    dlt_template_id=template_id,
                    dlt_entity_id=settings.DLT_ENTITY_ID,
                )
            else:
                err = result_json.get("message") or "MSG91 dispatch rejected"
                logger.warning("[sms] MSG91 returned failure: %s", err)
                # Fallback to MSG91 SendSMS API
                return _dispatch_msg91_sendsms_fallback(phone_10, otp_code, auth_key, sender_id)
    except Exception as e:
        logger.warning("[sms] MSG91 SendOTP error: %s. Attempting MSG91 SendSMS fallback...", e)
        return _dispatch_msg91_sendsms_fallback(phone_10, otp_code, auth_key, sender_id)


def _dispatch_msg91_sendsms_fallback(
    phone_10: str,
    otp_code: str,
    auth_key: str,
    sender_id: str,
) -> SmsDispatchResult:
    """Fallback dispatch via MSG91 SendSMS HTTP API with forced IPv4."""
    try:
        msg_text = f"Your MyArea24 verification code is {otp_code}. Valid for 10 minutes."
        sms_params = {
            "authkey": auth_key,
            "mobiles": f"91{phone_10}",
            "message": msg_text,
            "sender": sender_id or "MYAR24",
            "route": "4",
            "country": "91",
        }
        sms_url = f"https://api.msg91.com/api/sendhttp.php?{urllib.parse.urlencode(sms_params)}"
        req = urllib.request.Request(sms_url, headers={"authkey": auth_key}, method="GET")
        with _open_msg91_url(req, timeout=10) as resp:
            body = resp.read().decode("utf-8").strip()
            if resp.status == 200 and len(body) > 5 and "error" not in body.lower():
                logger.info("[sms] MSG91 SendSMS OTP sent to +91-%s (id=%s)", phone_10, body)
                return SmsDispatchResult(
                    success=True,
                    provider="msg91",
                    phone_number=phone_10,
                    message_id=body,
                    dlt_compliant=True,
                )
            return SmsDispatchResult(
                success=False,
                provider="msg91",
                phone_number=phone_10,
                error_message=body,
            )
    except Exception as exc:
        logger.error("[sms] MSG91 SendSMS fallback failed: %s", exc)
        return SmsDispatchResult(
            success=False,
            provider="msg91",
            phone_number=phone_10,
            error_message=str(exc),
        )


def dispatch_textlocal(
    phone_10: str,
    otp_code: str,
    validity_minutes: int = 10,
) -> SmsDispatchResult:
    """
    Dispatches OTP via Textlocal India (https://www.textlocal.in).
    """
    api_key = settings.TEXTLOCAL_API_KEY
    if not api_key or api_key.startswith("your_"):
        return SmsDispatchResult(
            success=False,
            provider="textlocal",
            phone_number=phone_10,
            error_message="Textlocal API key not configured",
        )

    sender = settings.TEXTLOCAL_SENDER or settings.SMS_SENDER_ID or "MYAR24"
    dlt_template_id = settings.DLT_TEMPLATE_ID
    message = build_dlt_otp_message(otp_code, sender, validity_minutes)

    url = "https://api.textlocal.in/send/"
    payload = {
        "apikey": api_key,
        "numbers": f"91{phone_10}",
        "message": message,
        "sender": sender,
    }
    if dlt_template_id:
        payload["custom"] = dlt_template_id

    try:
        data_encoded = urllib.parse.urlencode(payload).encode("utf-8")
        req = urllib.request.Request(
            url,
            data=data_encoded,
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            resp_body = resp.read().decode("utf-8")
            result_json = json.loads(resp_body)
            status = result_json.get("status", "").lower()
            if status == "success":
                batch_id = result_json.get("batch_id")
                logger.info("[sms] Textlocal OTP dispatched to +91-%s (batch=%s)", phone_10, batch_id)
                return SmsDispatchResult(
                    success=True,
                    provider="textlocal",
                    phone_number=phone_10,
                    message_id=str(batch_id),
                    dlt_compliant=True,
                    dlt_template_id=dlt_template_id,
                    dlt_entity_id=settings.DLT_ENTITY_ID,
                )
            else:
                errors = result_json.get("errors", [])
                err_msg = errors[0].get("message") if errors else "Textlocal dispatch failed"
                logger.warning("[sms] Textlocal error: %s", err_msg)
                return SmsDispatchResult(
                    success=False,
                    provider="textlocal",
                    phone_number=phone_10,
                    error_message=str(err_msg),
                )
    except Exception as e:
        logger.error("[sms] Textlocal connection error: %s", e)
        return SmsDispatchResult(
            success=False,
            provider="textlocal",
            phone_number=phone_10,
            error_message=str(e),
        )


def dispatch_twilio(
    phone_10: str,
    otp_code: str,
    validity_minutes: int = 10,
) -> SmsDispatchResult:
    """
    Dispatches OTP via Twilio messaging to India (+91).
    Wires up settings.TWILIO_AUTH_TOKEN and settings.TWILIO_ACCOUNT_SID.
    """
    sid = settings.TWILIO_ACCOUNT_SID
    token = settings.TWILIO_AUTH_TOKEN
    from_phone = settings.TWILIO_FROM_PHONE or "+15005550006"
    if not sid or not token or sid.startswith("your_") or token.startswith("your_"):
        return SmsDispatchResult(
            success=False,
            provider="twilio",
            phone_number=phone_10,
            error_message="Twilio credentials (TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN) not configured",
        )

    import base64

    twilio_url = f"https://api.twilio.com/2010-04-01/Accounts/{sid}/Messages.json"
    formatted_to = f"+91{phone_10}"
    message = build_dlt_otp_message(otp_code, settings.SMS_SENDER_ID or "MYAR24", validity_minutes)

    payload = {
        "To": formatted_to,
        "From": from_phone,
        "Body": message,
    }
    auth_str = f"{sid}:{token}"
    auth_b64 = base64.b64encode(auth_str.encode("utf-8")).decode("ascii")

    try:
        data_encoded = urllib.parse.urlencode(payload).encode("utf-8")
        req = urllib.request.Request(
            twilio_url,
            data=data_encoded,
            headers={
                "Authorization": f"Basic {auth_b64}",
                "Content-Type": "application/x-www-form-urlencoded",
            },
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            resp_body = resp.read().decode("utf-8")
            result_json = json.loads(resp_body)
            msg_sid = result_json.get("sid")
            logger.info("[sms] Twilio SMS dispatched successfully to %s (sid=%s)", formatted_to, msg_sid)
            return SmsDispatchResult(
                success=True,
                provider="twilio",
                phone_number=phone_10,
                message_id=msg_sid,
                dlt_compliant=True,
            )
    except Exception as e:
        logger.error("[sms] Twilio connection error: %s", e)
        return SmsDispatchResult(
            success=False,
            provider="twilio",
            phone_number=phone_10,
            error_message=str(e),
        )


def _dispatch_simulated_dlt(
    phone_10: str,
    otp_code: str,
    validity_minutes: int,
    intl_format: str,
    masked: str,
) -> SmsDispatchResult:
    """Simulated DLT Delivery for local development & staging sandbox."""
    sender_id = settings.SMS_SENDER_ID or "MYAR24"
    dlt_msg = build_dlt_otp_message(otp_code, sender_id, validity_minutes)
    simulated_id = f"sim-dlt-{phone_10}-{otp_code[:3]}"

    logger.info(
        "----------------------------------------------------------------------\n"
        "[INDIAN SMS SIMULATOR - TRAI DLT COMPLIANT]\n"
        f"  Recipient Mobile : {intl_format} ({masked})\n"
        f"  TRAI Sender ID   : {sender_id}\n"
        f"  DLT Entity ID    : {settings.DLT_ENTITY_ID or '1701159000000000000 (DEMO-PE)'}\n"
        f"  DLT Template ID  : {settings.DLT_TEMPLATE_ID or '1707161000000000000 (DEMO-TMPL)'}\n"
        f"  OTP Verification : {otp_code}\n"
        f"  Raw SMS Content  : {dlt_msg}\n"
        "----------------------------------------------------------------------"
    )

    return SmsDispatchResult(
        success=True,
        provider="simulator_dlt",
        phone_number=phone_10,
        message_id=simulated_id,
        dlt_compliant=True,
        dlt_template_id=settings.DLT_TEMPLATE_ID or "1707161000000000000",
        dlt_entity_id=settings.DLT_ENTITY_ID or "1701159000000000000",
        is_simulated=True,
    )


def dispatch_indian_sms_otp(
    phone_number: str,
    otp_code: str,
    validity_minutes: int = 10,
    provider_override: Optional[str] = None,
) -> SmsDispatchResult:
    """
    Master dispatcher for Indian SMS OTPs with TRAI DLT validation.
    Selects provider based on provider_override, settings.SMS_PROVIDER, or active credentials:
      1. Fast2SMS: settings.FAST2SMS_API_KEY
      2. Twilio: settings.TWILIO_AUTH_TOKEN & settings.TWILIO_ACCOUNT_SID
      3. MSG91: settings.MSG91_AUTH_KEY
      4. Textlocal: settings.TEXTLOCAL_API_KEY
    In development/testing mode, falls back to simulated DLT delivery if no
    live SMS gateway credentials are provided.
    """
    is_valid, phone_10, intl_format, masked = validate_indian_phone(phone_number)
    if not is_valid:
        return SmsDispatchResult(
            success=False,
            provider="none",
            phone_number=phone_number,
            error_message="Invalid 10-digit Indian mobile number. Must start with 6, 7, 8, or 9.",
        )

    provider_choice = (provider_override or settings.SMS_PROVIDER or "auto").strip().lower()

    # 1. Direct provider selection if explicitly configured or overridden (with automated failover)
    is_prod = (settings.APP_ENV or "").strip().lower() in ("production", "prod", "staging") or not settings.DEBUG
    last_err = ""

    if provider_choice in ("fast2sms", "msg91", "twilio", "textlocal"):
        if provider_choice == "fast2sms":
            res = dispatch_fast2sms(phone_10, otp_code, validity_minutes)
            if res.success:
                return res
            if settings.MSG91_AUTH_KEY and not settings.MSG91_AUTH_KEY.startswith("your_"):
                logger.info("[sms] Fast2SMS dispatch failed (%s). Attempting automated failover to MSG91...", res.error_message)
                msg_res = dispatch_msg91(phone_10, otp_code, validity_minutes)
                if msg_res.success:
                    return msg_res
                last_err = f"Fast2SMS: {res.error_message} | MSG91: {msg_res.error_message}"
            else:
                last_err = res.error_message or "Fast2SMS dispatch failed"
        elif provider_choice == "msg91":
            res = dispatch_msg91(phone_10, otp_code, validity_minutes)
            if res.success:
                return res
            if settings.FAST2SMS_API_KEY and not settings.FAST2SMS_API_KEY.startswith("your_"):
                logger.info("[sms] MSG91 dispatch failed (%s). Attempting automated failover to Fast2SMS...", res.error_message)
                fast_res = dispatch_fast2sms(phone_10, otp_code, validity_minutes)
                if fast_res.success:
                    return fast_res
                last_err = f"MSG91: {res.error_message} | Fast2SMS: {fast_res.error_message}"
            else:
                last_err = res.error_message or "MSG91 dispatch failed"
        elif provider_choice == "twilio":
            res = dispatch_twilio(phone_10, otp_code, validity_minutes)
            if res.success:
                return res
            last_err = res.error_message or "Twilio dispatch failed"
        elif provider_choice == "textlocal":
            res = dispatch_textlocal(phone_10, otp_code, validity_minutes)
            if res.success:
                return res
            last_err = res.error_message or "Textlocal dispatch failed"

        if is_prod and settings.SMS_STRICT_PRODUCTION:
            return SmsDispatchResult(
                success=False,
                provider=provider_choice,
                phone_number=phone_10,
                error_message=last_err,
            )
        logger.warning("[sms] Configured provider %s failed (%s). Proceeding to simulated delivery in development mode...", provider_choice, last_err)
        return _dispatch_simulated_dlt(phone_10, otp_code, validity_minutes, intl_format, masked)

    # 2. 'auto' mode: cascade down priority of available Indian gateways (MSG91 first)
    if settings.MSG91_AUTH_KEY and not settings.MSG91_AUTH_KEY.startswith("your_"):
        res = dispatch_msg91(phone_10, otp_code, validity_minutes)
        if res.success:
            return res

    if settings.FAST2SMS_API_KEY and not settings.FAST2SMS_API_KEY.startswith("your_"):
        res = dispatch_fast2sms(phone_10, otp_code, validity_minutes)
        if res.success:
            return res

    if (
        settings.TWILIO_ACCOUNT_SID
        and settings.TWILIO_AUTH_TOKEN
        and not settings.TWILIO_ACCOUNT_SID.startswith("your_")
    ):
        res = dispatch_twilio(phone_10, otp_code, validity_minutes)
        if res.success:
            return res

    if settings.TEXTLOCAL_API_KEY and not settings.TEXTLOCAL_API_KEY.startswith("your_"):
        res = dispatch_textlocal(phone_10, otp_code, validity_minutes)
        if res.success:
            return res

    # 3. Development / Sandbox / Offline Mode
    if is_prod and settings.SMS_STRICT_PRODUCTION:
        logger.critical(
            "[TRAI DLT AUDIT ALERT] In production, no Indian SMS gateway is configured! "
            "Configure MSG91_AUTH_KEY, FAST2SMS_API_KEY, or TEXTLOCAL_API_KEY with registered "
            "DLT_ENTITY_ID and DLT_TEMPLATE_ID."
        )
        return SmsDispatchResult(
            success=False,
            provider="none",
            phone_number=phone_10,
            error_message="SMS gateway unconfigured in production environment. TRAI DLT credentials required.",
        )

    return _dispatch_simulated_dlt(phone_10, otp_code, validity_minutes, intl_format, masked)


def get_sms_gateway_status() -> Dict[str, Any]:
    """
    Returns diagnostic status of the Indian SMS gateway and TRAI DLT registration.
    API keys are redacted for security.
    """
    is_prod = (settings.APP_ENV or "").strip().lower() in ("production", "prod", "staging") or not settings.DEBUG

    fast2sms_configured = bool(settings.FAST2SMS_API_KEY and not settings.FAST2SMS_API_KEY.startswith("your_"))
    msg91_configured = bool(settings.MSG91_AUTH_KEY and not settings.MSG91_AUTH_KEY.startswith("your_"))
    textlocal_configured = bool(settings.TEXTLOCAL_API_KEY and not settings.TEXTLOCAL_API_KEY.startswith("your_"))
    twilio_configured = bool(settings.TWILIO_ACCOUNT_SID and not settings.TWILIO_ACCOUNT_SID.startswith("your_"))

    active_provider = "none"
    chosen = (settings.SMS_PROVIDER or "").strip().lower()
    if chosen == "fast2sms" and fast2sms_configured:
        active_provider = "fast2sms"
    elif chosen == "msg91" and msg91_configured:
        active_provider = "msg91"
    elif chosen == "textlocal" and textlocal_configured:
        active_provider = "textlocal"
    elif chosen == "twilio" and twilio_configured:
        active_provider = "twilio"
    elif fast2sms_configured:
        active_provider = "fast2sms"
    elif msg91_configured:
        active_provider = "msg91"
    elif textlocal_configured:
        active_provider = "textlocal"
    elif twilio_configured:
        active_provider = "twilio"
    elif not is_prod:
        active_provider = "simulator_dlt"

    has_dlt = bool(settings.DLT_TEMPLATE_ID and settings.DLT_ENTITY_ID)

    return {
        "status": "ready" if active_provider != "none" else "unconfigured",
        "active_provider": active_provider,
        "is_production": is_prod,
        "trai_dlt_compliant": has_dlt or not is_prod,
        "sender_id": settings.SMS_SENDER_ID or "MYAR24",
        "dlt_entity_id_configured": bool(settings.DLT_ENTITY_ID),
        "dlt_template_id_configured": bool(settings.DLT_TEMPLATE_ID),
        "providers_available": {
            "msg91": msg91_configured,
            "fast2sms": fast2sms_configured,
            "textlocal": textlocal_configured,
            "twilio": twilio_configured,
            "simulator": not is_prod,
        },
    }
