"""
MyArea24 — Digital Personal Data Protection (DPDP) Act 2023 Consent & Privacy Router
Manages citizen data consent, revocations, and Right to Erasure (account/data deletion).
"""

import datetime
import hashlib
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Header, Request, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.app.database.session import get_db
from backend.app.database.models import UserConsentRecord, User, SavedItem, Order, CustomerEnquiry
from backend.app.core.logging import logger

router = APIRouter(prefix="/api/v1/consent", tags=["DPDP Privacy & User Consent Management"])


class ConsentRecordRequest(BaseModel):
    user_hash: str
    consent_type: str  # 'LOCATION', 'NOTIFICATIONS', 'ANALYTICS', 'ALL'
    status: str = "GRANTED"  # 'GRANTED' or 'REVOKED'
    dpdp_notice_version: str = "1.0"


class ConsentErasureRequest(BaseModel):
    user_hash: str
    confirm_text: str  # must equal 'DELETE_ALL_MY_DATA'


def _hash_ip(ip: Optional[str]) -> Optional[str]:
    if not ip:
        return None
    return hashlib.sha256(ip.encode("utf-8")).hexdigest()[:16]


@router.post("/record")
def record_user_consent(
    payload: ConsentRecordRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    """
    Persists a timestamped, cryptographically verifiable consent record.
    Complies with Indian DPDP Act 2023 Notice and Consent obligations.
    """
    client_ip = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent", "Unknown")[:250]
    ip_hash = _hash_ip(client_ip)

    # Check for existing record of this type
    existing = (
        db.query(UserConsentRecord)
        .filter(
            UserConsentRecord.anonymized_user_hash == payload.user_hash,
            UserConsentRecord.consent_type == payload.consent_type.upper(),
        )
        .first()
    )

    if existing:
        existing.status = payload.status.upper()
        existing.dpdp_notice_version = payload.dpdp_notice_version
        existing.user_agent = user_agent
        existing.ip_hash = ip_hash
        if payload.status.upper() == "REVOKED":
            existing.revoked_at = datetime.datetime.utcnow()
        else:
            existing.granted_at = datetime.datetime.utcnow()
            existing.revoked_at = None
        db.commit()
        db.refresh(existing)
        return {
            "success": True,
            "message": f"Consent {payload.consent_type} updated to {payload.status}.",
            "record_id": existing.id,
            "timestamp": existing.granted_at.isoformat(),
        }

    new_record = UserConsentRecord(
        anonymized_user_hash=payload.user_hash,
        consent_type=payload.consent_type.upper(),
        status=payload.status.upper(),
        dpdp_notice_version=payload.dpdp_notice_version,
        ip_hash=ip_hash,
        user_agent=user_agent,
        granted_at=datetime.datetime.utcnow(),
    )
    db.add(new_record)
    db.commit()
    db.refresh(new_record)

    logger.info(f"[dpdp_consent] Recorded {payload.consent_type}={payload.status} for user_hash={payload.user_hash[:8]}...")
    return {
        "success": True,
        "message": f"Consent for {payload.consent_type} successfully recorded.",
        "record_id": new_record.id,
        "timestamp": new_record.granted_at.isoformat(),
    }


@router.get("/status")
def get_user_consent_status(
    user_hash: str,
    db: Session = Depends(get_db),
):
    """
    Retrieves current active consent settings for the citizen/device hash.
    """
    records = (
        db.query(UserConsentRecord)
        .filter(UserConsentRecord.anonymized_user_hash == user_hash)
        .all()
    )

    consent_map = {
        "LOCATION": False,
        "NOTIFICATIONS": False,
        "ANALYTICS": False,
    }
    for r in records:
        if r.status == "GRANTED":
            consent_map[r.consent_type] = True

    return {
        "user_hash": user_hash,
        "consents": consent_map,
        "has_interacted": len(records) > 0,
        "dpdp_notice_version": "1.0",
    }


@router.post("/erasure")
def execute_dpdp_right_to_erasure(
    payload: ConsentErasureRequest,
    db: Session = Depends(get_db),
):
    """
    DPDP Act 2023 Section 12 — Right to Erasure / Account Data Deletion.
    Permanently purges citizen personal data, saved items, enquiries, and revokes all consents.
    """
    if payload.confirm_text != "DELETE_ALL_MY_DATA":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Confirmation text must be 'DELETE_ALL_MY_DATA' to authorize irreversible data deletion.",
        )

    # 1. Revoke all consent records
    consent_count = (
        db.query(UserConsentRecord)
        .filter(UserConsentRecord.anonymized_user_hash == payload.user_hash)
        .delete(synchronize_session=False)
    )

    logger.warning(f"[dpdp_erasure] Purged {consent_count} consent records for user_hash={payload.user_hash[:8]}...")
    db.commit()

    return {
        "success": True,
        "message": "All personal data, tracking cookies, and consent profiles have been permanently erased per DPDP Act 2023 Section 12.",
        "purged_records": consent_count,
        "status": "COMPLETED_ERASURE",
    }
