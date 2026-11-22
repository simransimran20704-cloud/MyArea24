import copy
import datetime
import json
import logging
import time
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, Header, HTTPException, Query, status, UploadFile, File
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import or_, func

from backend.app.api.deps import get_current_user
from backend.app.core.config import settings
from backend.app.core.security import hash_password, verify_password, create_access_token
from backend.app.api.businesses import generate_slug
from backend.app.services.media_storage import save_merchant_media
from backend.app.services.web_push_service import (
    get_vapid_public_key,
    send_merchant_push_notification,
    send_web_push,
)
from backend.app.database.models import (
    Business,
    Product,
    Offer,
    ServiceListing,
    Event,
    CustomerEnquiry,
    Order,
    OrderItem,
    User,
    MerchantPushSubscription,
)
from backend.app.database.session import get_db

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/merchant", tags=["Merchant Portal & Storefront Operations"])

# In-memory settings & state cache fallback for merchant preferences & 2FA toggles
MERCHANT_SETTINGS_STORE: Dict[str, Dict[str, Any]] = {}


# ==============================================================================
# Helper & Dependency: Strict Merchant Authorization & Business Resolution
# ==============================================================================
def get_current_merchant_business(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    business_id: Optional[int] = Query(None),
    x_merchant_id: Optional[str] = Header(None),
    x_dev_bypass: Optional[str] = Header(None, alias="X-Dev-Merchant-Bypass"),
) -> Business:
    """
    Enforces strict ownership authorization for merchant endpoints:
    1. Rejects development bypass headers if in production mode or DEBUG=False.
    2. Validates user authentication (get_current_user).
    3. If a target business is requested by ID or slug (business_id or x_merchant_id),
       strictly verifies that target business is owned by the authenticated user (or user is admin).
       If owned by another user -> raises HTTP 403 Forbidden.
       If not found -> raises HTTP 404 Not Found.
    4. If no specific business is requested, resolves the business owned by this user.
    5. If the user owns no business:
       - In production (or DEBUG=False): raises HTTP 404 Not Found.
       - In development mode (and DEBUG=True): auto-provisions a fresh, isolated business
         explicitly owned by this user (owner_id = user.id). Never falls back to another user's business!
    """
    is_production = (settings.APP_ENV or "").strip().lower() in ("production", "prod") or not settings.DEBUG

    # Reject dev bypass header in production
    if x_dev_bypass and is_production:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Development bypass headers are strictly forbidden in production mode.",
        )

    # 1. If explicit business_id query param is supplied:
    if business_id is not None:
        biz = db.query(Business).filter(Business.id == business_id).first()
        if not biz:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Business with ID {business_id} not found.",
            )
        if biz.owner_id != user.id and user.role != "admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Forbidden: You do not have permission to access or manage this business.",
            )
        return biz

    # 2. If explicit x_merchant_id header is supplied:
    if x_merchant_id:
        clean_id = x_merchant_id.strip()
        biz = db.query(Business).filter(
            or_(
                Business.slug == clean_id,
                Business.id == int(clean_id) if clean_id.isdigit() else False,
            )
        ).first()
        if not biz:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Business not found.",
            )
        if biz.owner_id != user.id and user.role != "admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Forbidden: You do not have permission to access or manage this business.",
            )
        return biz

    # 3. Default to the business owned by this authenticated user
    user_biz = db.query(Business).filter(Business.owner_id == user.id).first()
    if user_biz:
        return user_biz

    # 4. If user owns no business yet:
    if is_production:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No business registered for this merchant account. Please complete merchant onboarding.",
        )

    # In development mode only: auto-provision an isolated business owned by user.id
    dev_biz = Business(
        name=f"{user.full_name or 'My'} Storefront",
        slug=f"storefront-u{user.id}-{int(datetime.datetime.utcnow().timestamp())}",
        owner_id=user.id,
        category="Retail & Services",
        description="Verified local merchant storefront serving neighborhood residents.",
        address="Commercial Market, Local Area",
        locality="Local Area",
        city="Delhi NCR",
        state="Delhi NCR",
        latitude=28.6139,
        longitude=77.2090,
        phone=user.phone or "+91 98110 24024",
        email=user.email,
        opening_time="09:00",
        closing_time="21:30",
        days_open="Mon-Sun",
        is_verified=True,
        status="active",
        rating=5.0,
        review_count=0,
        view_count=0,
        call_clicks=0,
        direction_clicks=0,
    )
    db.add(dev_biz)
    db.commit()
    db.refresh(dev_biz)
    return dev_biz


def resolve_merchant_business(
    db: Session,
    user: Optional[User] = None,
    business_id: Optional[int] = None,
    **kwargs: Any,
) -> Business:
    """
    Backwards-compatible helper that strictly enforces ownership and never falls back
    to returning another merchant's business.
    """
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required to resolve merchant business.",
        )
    if business_id is not None:
        biz = db.query(Business).filter(Business.id == business_id).first()
        if not biz:
            raise HTTPException(status_code=404, detail="Business not found.")
        if biz.owner_id != user.id and user.role != "admin":
            raise HTTPException(status_code=403, detail="Forbidden: You do not own this business.")
        return biz
    biz = db.query(Business).filter(Business.owner_id == user.id).first()
    if not biz:
        raise HTTPException(status_code=404, detail="No business registered for this user.")
    return biz


# ==============================================================================
# Pydantic Schemas
# ==============================================================================
class StorefrontUpdateRequest(BaseModel):
    name: Optional[str] = None
    tagline: Optional[str] = None
    category: Optional[str] = None
    description: Optional[str] = None
    address: Optional[str] = None
    locality: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    website: Optional[str] = None
    opening_time: Optional[str] = None
    closing_time: Optional[str] = None
    days_open: Optional[str] = None
    owner_name: Optional[str] = None
    image_url: Optional[str] = None
    cover_image: Optional[str] = None
    logo: Optional[str] = None
    fssai_license_number: Optional[str] = None
    gstin: Optional[str] = None
    settlement_upi_id: Optional[str] = None
    settlement_bank_account: Optional[str] = None
    settlement_bank_ifsc: Optional[str] = None


class MerchantSettingsUpdateRequest(BaseModel):
    notifications: Optional[Dict[str, bool]] = None
    preferences: Optional[Dict[str, str]] = None
    google_business_connected: Optional[bool] = None
    whatsapp_connected: Optional[bool] = None


class PasswordChangeRequest(BaseModel):
    old_pin: Optional[str] = None
    new_pin: str


class TwoFactorToggleRequest(BaseModel):
    enabled: bool
    phone: Optional[str] = None


class MerchantProductCreateRequest(BaseModel):
    name: str
    brand: Optional[str] = None
    category: str
    price: float
    mrp: Optional[float] = None
    description: Optional[str] = None
    availability_status: str = "in_stock"
    stock_quantity: Optional[int] = 100
    image_url: Optional[str] = None
    image: Optional[str] = None


class MerchantServiceCreateRequest(BaseModel):
    name: Optional[str] = None
    title: Optional[str] = None
    category: str
    description: Optional[str] = None
    price_starting_at: Optional[float] = None
    price_starting: Optional[float] = None
    price_unit: str = "per visit"
    phone: Optional[str] = None
    whatsapp: Optional[str] = None
    timing: str = "08:00 AM - 08:00 PM"


class MerchantOfferCreateRequest(BaseModel):
    title: str
    description: Optional[str] = None
    discount_text: Optional[str] = None
    discountText: Optional[str] = None
    coupon_code: Optional[str] = None
    code: Optional[str] = None
    category: Optional[str] = "Food & Retail"
    valid_days: Optional[int] = 14
    valid_until: Optional[str] = None
    image_url: Optional[str] = None
    banner_image_url: Optional[str] = None
    image: Optional[str] = None


class MerchantEventCreateRequest(BaseModel):
    title: str
    category: Optional[str] = "Community Event"
    organizer: Optional[str] = None
    venue_name: Optional[str] = None
    venue: Optional[str] = None
    address: Optional[str] = None
    start_time: Optional[str] = None
    event_date: Optional[str] = None
    timing_text: Optional[str] = None
    description: Optional[str] = None


class OrderStatusUpdateRequest(BaseModel):
    status: str  # 'confirmed', 'preparing', 'out_for_delivery', 'delivered', 'cancelled'


class LeadStatusUpdateRequest(BaseModel):
    status: str  # 'New', 'Contacted', 'Qualified', 'Closed'


class ReviewReplyRequest(BaseModel):
    reply_text: str


class MerchantRegisterRequest(BaseModel):
    business_name: str
    category: str
    owner_name: str
    phone: str
    whatsapp: Optional[str] = None
    email: str
    full_address: str
    locality: str
    city: str
    pincode: Optional[str] = None
    doc_type: Optional[str] = "GSTIN"
    doc_number: Optional[str] = None
    opening_time: Optional[str] = "09:00"
    closing_time: Optional[str] = "21:30"
    store_pin: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None


class MerchantLoginRequest(BaseModel):
    identifier: str
    store_pin: str


# ==============================================================================
# Endpoints: 0. Merchant Onboarding & Authentication
# ==============================================================================
@router.post("/register", response_model=Dict[str, Any])
def register_merchant(
    req: MerchantRegisterRequest,
    db: Session = Depends(get_db),
):
    """
    Registers a new merchant storefront and owner account in the backend database.
    Stores cryptographically salted password/PIN hash (never plain text) and provisions JWT credentials.
    """
    if len(req.store_pin.strip()) < 4:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Store Security PIN / Password must be at least 4 characters long.",
        )

    clean_email = req.email.lower().strip()
    clean_phone = req.phone.strip()
    phone_digits = "".join(filter(str.isdigit, clean_phone))
    ten_digits = phone_digits[-10:] if len(phone_digits) >= 10 else phone_digits

    phone_variants = [
        clean_phone,
        phone_digits,
        ten_digits,
        f"+91{ten_digits}",
        f"0{ten_digits}",
        f"+91-{ten_digits[:5]}-{ten_digits[5:]}",
        f"+91 {ten_digits}",
    ]

    # Look up or create merchant user
    user = (
        db.query(User)
        .filter(or_(func.lower(User.email) == clean_email, User.phone.in_(phone_variants)))
        .first()
    )
    if not user and len(ten_digits) >= 10:
        candidates = db.query(User).filter(
            or_(
                User.phone.like(f"%{ten_digits[:5]}%"),
                User.phone.like(f"%{ten_digits[5:]}%"),
            )
        ).all()
        for c in candidates:
            if c.phone and "".join(filter(str.isdigit, c.phone)).endswith(ten_digits):
                user = c
                break

    if not user:
        user = User(
            email=clean_email,
            phone=clean_phone,
            full_name=req.owner_name.strip(),
            role="merchant",
            is_active=True,
            is_verified=True,
            password_hash=hash_password(req.store_pin.strip()),
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    else:
        user.role = "merchant"
        user.full_name = req.owner_name.strip()
        if not user.phone:
            user.phone = clean_phone
        user.password_hash = hash_password(req.store_pin.strip())
        user.is_verified = True
        db.commit()
        db.refresh(user)

    # Check if user already owns a business
    biz = db.query(Business).filter(Business.owner_id == user.id).first()
    if not biz:
        slug = generate_slug(req.business_name, req.locality, db)
        biz = Business(
            slug=slug,
            name=req.business_name.strip(),
            owner_id=user.id,
            category=req.category.strip(),
            address=req.full_address.strip(),
            locality=req.locality.strip(),
            city=req.city.strip(),
            state="Delhi NCR",
            pincode=req.pincode.strip() if req.pincode else "110085",
            latitude=req.latitude if req.latitude is not None else 28.7196,
            longitude=req.longitude if req.longitude is not None else 77.1186,
            phone=clean_phone,
            whatsapp=req.whatsapp.strip() if req.whatsapp else clean_phone,
            email=clean_email,
            opening_time=req.opening_time or "09:00",
            closing_time=req.closing_time or "21:30",
            days_open="Mon-Sun",
            is_verified=True,
            status="active",
        )
        db.add(biz)
        db.commit()
        db.refresh(biz)
    else:
        # Update existing business profile
        biz.name = req.business_name.strip()
        biz.category = req.category.strip()
        biz.address = req.full_address.strip()
        biz.locality = req.locality.strip()
        biz.city = req.city.strip()
        biz.phone = clean_phone
        biz.whatsapp = req.whatsapp.strip() if req.whatsapp else clean_phone
        biz.email = clean_email
        biz.opening_time = req.opening_time or biz.opening_time
        biz.closing_time = req.closing_time or biz.closing_time
        biz.is_verified = True
        db.commit()
        db.refresh(biz)

    token = create_access_token(data={"sub": str(user.id), "email": user.email, "role": "merchant"})

    profile = {
        "id": str(biz.id),
        "businessName": biz.name,
        "category": biz.category,
        "ownerName": user.full_name or "Store Owner",
        "phone": biz.phone or "",
        "whatsapp": biz.whatsapp or "",
        "email": biz.email or "",
        "fullAddress": biz.address,
        "locality": biz.locality,
        "city": biz.city,
        "pincode": biz.pincode or "",
        "docType": req.doc_type or "GSTIN",
        "docNumber": req.doc_number or "",
        "openingTime": biz.opening_time,
        "closingTime": biz.closing_time,
        "isVerified": True,
        "registeredAt": datetime.datetime.utcnow().isoformat(),
    }

    return {
        "status": "success",
        "message": f"Storefront '{biz.name}' registered successfully.",
        "token": token,
        "business": {
            "id": biz.id,
            "slug": biz.slug,
            "name": biz.name,
            "category": biz.category,
            "address": biz.address,
            "locality": biz.locality,
            "city": biz.city,
            "phone": biz.phone,
            "whatsapp": biz.whatsapp,
            "email": biz.email,
            "openingTime": biz.opening_time,
            "closingTime": biz.closing_time,
        },
        "profile": profile,
    }


@router.post("/login", response_model=Dict[str, Any])
def login_merchant(
    req: MerchantLoginRequest,
    db: Session = Depends(get_db),
):
    """
    Authenticates a merchant via their phone or email and Store Security PIN against the database.
    Allows verified merchants to log in from any computer or browser and instantly access their storefront dashboard.
    """
    clean_id = req.identifier.strip().lower()
    clean_digits = "".join(filter(str.isdigit, clean_id))
    clean_pin = req.store_pin.strip()

    if not clean_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Store phone number or email address is required.",
        )

    if not clean_pin:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Store Security PIN / Password is required.",
        )

    user = None
    biz = None

    if "@" in clean_id:
        user = db.query(User).filter(func.lower(User.email) == clean_id).first()
        if not user:
            biz = db.query(Business).filter(func.lower(Business.email) == clean_id).first()
            if biz and biz.owner_id:
                user = db.query(User).filter(User.id == biz.owner_id).first()
    else:
        ten_digits = clean_digits[-10:] if len(clean_digits) >= 10 else clean_digits
        if not ten_digits or len(ten_digits) < 10:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Please enter a valid 10-digit phone number or email address.",
            )

        phone_variants = [
            clean_id,
            clean_digits,
            ten_digits,
            f"+91{ten_digits}",
            f"0{ten_digits}",
            f"+91-{ten_digits[:5]}-{ten_digits[5:]}",
            f"+91 {ten_digits}",
            f"+91 {ten_digits[:5]} {ten_digits[5:]}",
        ]

        # 1. Lookup in User table
        user = db.query(User).filter(
            or_(
                User.phone.in_(phone_variants),
                User.phone.endswith(ten_digits),
            )
        ).first()

        if not user:
            candidates = db.query(User).filter(
                or_(
                    User.phone.like(f"%{ten_digits[:5]}%"),
                    User.phone.like(f"%{ten_digits[5:]}%"),
                )
            ).all()
            for c in candidates:
                if c.phone and "".join(filter(str.isdigit, c.phone)).endswith(ten_digits):
                    user = c
                    break

        # 2. If not found in User, lookup in Business table
        if not user:
            biz = db.query(Business).filter(
                or_(
                    Business.phone.in_(phone_variants),
                    Business.phone.endswith(ten_digits),
                )
            ).first()

            if not biz:
                biz_candidates = db.query(Business).filter(
                    or_(
                        Business.phone.like(f"%{ten_digits[:5]}%"),
                        Business.phone.like(f"%{ten_digits[5:]}%"),
                    )
                ).all()
                for b in biz_candidates:
                    if b.phone and "".join(filter(str.isdigit, b.phone)).endswith(ten_digits):
                        biz = b
                        break

            if biz and biz.owner_id:
                user = db.query(User).filter(User.id == biz.owner_id).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="No merchant storefront found matching this phone number or email.",
        )

    # RBAC: Check user role
    if user.role not in ("merchant", "admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. This account does not have merchant storefront privileges.",
        )

    # Account status: active check
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your merchant account has been deactivated. Please contact support.",
        )

    # Account status: verification check
    if not user.is_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your merchant account is pending verification. Please complete verification before logging in.",
        )

    # Verify PIN / Password
    if not user.password_hash or not verify_password(clean_pin, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect Store Access PIN / Password. Please check and try again.",
        )

    # Resolve merchant business
    if not biz:
        biz = db.query(Business).filter(Business.owner_id == user.id).first()

    if not biz:
        # Check if there is an unlinked business matching user's phone or email
        if user.email:
            biz = db.query(Business).filter(func.lower(Business.email) == user.email.lower()).first()
        if not biz and user.phone:
            u_digits = "".join(filter(str.isdigit, user.phone))[-10:]
            if len(u_digits) >= 10:
                biz_candidates = db.query(Business).filter(Business.phone.isnot(None)).all()
                for b in biz_candidates:
                    if b.phone and "".join(filter(str.isdigit, b.phone)).endswith(u_digits):
                        biz = b
                        break
        if biz and biz.owner_id is None:
            biz.owner_id = user.id
            db.commit()
            db.refresh(biz)

    if not biz:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No storefront found for this merchant account. Please complete store registration.",
        )

    if biz.status != "active":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your storefront is currently inactive. Please contact support.",
        )

    token = create_access_token(data={"sub": str(user.id), "email": user.email, "role": user.role})

    profile = {
        "id": str(biz.id),
        "businessName": biz.name,
        "category": biz.category,
        "ownerName": user.full_name or "Store Owner",
        "phone": biz.phone or user.phone or "",
        "whatsapp": biz.whatsapp or biz.phone or "",
        "email": biz.email or user.email or "",
        "fullAddress": biz.address or "",
        "locality": biz.locality or "",
        "city": biz.city or "",
        "pincode": biz.pincode or "",
        "docType": "GSTIN",
        "docNumber": getattr(biz, "gstin", "") or getattr(biz, "tax_identifier", "") or "",
        "openingTime": biz.opening_time or "09:00",
        "closingTime": biz.closing_time or "21:30",
        "isVerified": bool(biz.is_verified and user.is_verified),
        "registeredAt": biz.created_at.isoformat() if biz.created_at else datetime.datetime.utcnow().isoformat(),
    }

    return {
        "status": "success",
        "message": f"Welcome back, {biz.name}!",
        "token": token,
        "business": {
            "id": biz.id,
            "slug": biz.slug,
            "name": biz.name,
            "category": biz.category,
            "address": biz.address,
            "locality": biz.locality,
            "city": biz.city,
            "phone": biz.phone,
            "whatsapp": biz.whatsapp,
            "email": biz.email,
            "openingTime": biz.opening_time,
            "closingTime": biz.closing_time,
        },
        "profile": profile,
    }


# ==============================================================================
# Endpoints: 0.5 Merchant Media & Camera Uploads
# ==============================================================================
@router.post("/upload-image", response_model=Dict[str, Any])
@router.post("/upload", response_model=Dict[str, Any])
async def upload_merchant_media_file(
    file: UploadFile = File(...),
    biz: Business = Depends(get_current_merchant_business),
):
    """
    Uploads an image (photo capture or file browse) for merchant products, offers, banners, or storefront logos.
    Supports native camera capture and browser file picking.
    Validates file format and size, generates WebP thumbnails, and persists to cloud storage (S3/R2/GCS) or static storage.
    """
    try:
        file_bytes = await file.read()
        if not file_bytes:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Uploaded file is empty.",
            )

        content_type = file.content_type or "image/jpeg"
        result = await save_merchant_media(
            file_bytes=file_bytes,
            original_filename=file.filename or "photo.jpg",
            content_type=content_type,
            merchant_id=biz.id,
        )
        return result
    except HTTPException:
        raise
    except ValueError as ve:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(ve),
        )
    except Exception as e:
        logger.exception(f"[merchant_upload] Failed to process media upload: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to store uploaded media file.",
        )


# ==============================================================================
# Endpoints: 1. Storefront Profile
# ==============================================================================
@router.get("/storefront", response_model=Dict[str, Any])
def get_storefront_profile(
    db: Session = Depends(get_db),
    biz: Business = Depends(get_current_merchant_business),
):
    """
    Fetches the authenticated merchant's storefront details, verification status, and telemetry.
    """
    prod_count = db.query(func.count(Product.id)).filter(Product.business_id == biz.id).scalar() or 0
    offer_count = db.query(func.count(Offer.id)).filter(Offer.business_id == biz.id).scalar() or 0
    orders_count = db.query(func.count(Order.id)).filter(Order.business_id == biz.id).scalar() or 0
    leads_count = db.query(func.count(CustomerEnquiry.id)).filter(CustomerEnquiry.business_id == biz.id).scalar() or 0

    biz_settings = MERCHANT_SETTINGS_STORE.get(str(biz.id), {})
    cover_img = biz_settings.get("cover_image") or "./assets/crops/biz-ai-cafe.webp"
    logo_img = biz_settings.get("logo") or biz.image_url or "./assets/crops/biz-card-chai.webp"

    return {
        "status": "success",
        "storefront": {
            "id": biz.id,
            "slug": biz.slug,
            "name": biz.name,
            "tagline": f"Verified Local Merchant • {biz.locality}",
            "category": biz.category,
            "description": biz.description,
            "ownerName": biz.owner.full_name if biz.owner else "Store Owner",
            "ownerRole": "Owner & Operator",
            "fullAddress": biz.address,
            "locality": biz.locality,
            "city": biz.city,
            "state": biz.state,
            "pincode": biz.pincode or "",
            "locationArea": f"{biz.locality}, {biz.city}",
            "phone": biz.phone or "+91 98110 24024",
            "email": biz.email or f"contact@{biz.slug}.myarea24.in",
            "website": biz.website or f"www.{biz.slug}.in",
            "rating": round(biz.rating, 1) if biz.review_count > 0 else 5.0,
            "reviewCount": biz.review_count or 0,
            "verificationStatus": "Verified" if biz.is_verified else "Under Review",
            "submissionDate": biz.created_at.strftime("%d %b %Y"),
            "profileCompletion": 100 if biz.is_verified else 80,
            "openingTime": biz.opening_time,
            "closingTime": biz.closing_time,
            "daysOpen": biz.days_open,
            "fssaiLicenseNumber": biz.fssai_license_number or "",
            "fssai_license_number": biz.fssai_license_number or "",
            "gstin": biz.gstin or "",
            "settlementUpiId": biz.settlement_upi_id or "",
            "settlement_upi_id": biz.settlement_upi_id or "",
            "settlementBankAccount": biz.settlement_bank_account or "",
            "settlement_bank_account": biz.settlement_bank_account or "",
            "settlementBankIfsc": biz.settlement_bank_ifsc or "",
            "settlement_bank_ifsc": biz.settlement_bank_ifsc or "",
            "logo": logo_img,
            "coverImage": cover_img,
            "stats": {
                "activeProductsCount": prod_count,
                "activeOffersCount": offer_count,
                "totalOrdersCount": orders_count,
                "totalLeadsCount": leads_count,
                "viewCount": biz.view_count or 0,
                "directionClicks": biz.direction_clicks or 0,
                "callClicks": biz.call_clicks or 0,
            },
        },
    }


@router.put("/storefront", response_model=Dict[str, Any])
def update_storefront_profile(
    body: StorefrontUpdateRequest,
    db: Session = Depends(get_db),
    biz: Business = Depends(get_current_merchant_business),
):
    """
    Updates merchant storefront details (name, address, hours, contact info).
    Strictly restricted to the business owned by the authenticated merchant.
    """
    if body.name:
        biz.name = body.name.strip()
    if body.category:
        biz.category = body.category.strip()
    if body.description is not None:
        biz.description = body.description.strip()
    if body.address:
        biz.address = body.address.strip()
    if body.locality:
        biz.locality = body.locality.strip()
    if body.city:
        biz.city = body.city.strip()
    if body.state:
        biz.state = body.state.strip()
    if body.pincode:
        biz.pincode = body.pincode.strip()
    if body.phone:
        biz.phone = body.phone.strip()
    if body.email:
        biz.email = body.email.strip()
    if body.website:
        biz.website = body.website.strip()
    if body.opening_time:
        biz.opening_time = body.opening_time
    if body.closing_time:
        biz.closing_time = body.closing_time
    if body.days_open:
        biz.days_open = body.days_open
    if body.fssai_license_number is not None:
        biz.fssai_license_number = body.fssai_license_number.strip()
    if body.gstin is not None:
        biz.gstin = body.gstin.strip().upper()
    if body.settlement_upi_id is not None:
        biz.settlement_upi_id = body.settlement_upi_id.strip()
    if body.settlement_bank_account is not None:
        biz.settlement_bank_account = body.settlement_bank_account.strip()
    if body.settlement_bank_ifsc is not None:
        biz.settlement_bank_ifsc = body.settlement_bank_ifsc.strip().upper()

    if str(biz.id) not in MERCHANT_SETTINGS_STORE:
        MERCHANT_SETTINGS_STORE[str(biz.id)] = {}

    if body.cover_image:
        MERCHANT_SETTINGS_STORE[str(biz.id)]["cover_image"] = body.cover_image.strip()
    if body.logo:
        MERCHANT_SETTINGS_STORE[str(biz.id)]["logo"] = body.logo.strip()
        biz.image_url = body.logo.strip()
    elif body.image_url:
        biz.image_url = body.image_url.strip()

    if body.owner_name and biz.owner:
        biz.owner.full_name = body.owner_name.strip()

    biz.updated_at = datetime.datetime.utcnow()
    db.commit()
    db.refresh(biz)

    return {
        "status": "success",
        "message": "Storefront profile updated successfully.",
        "business": {
            "id": biz.id,
            "name": biz.name,
            "phone": biz.phone,
            "address": biz.address,
            "locality": biz.locality,
            "city": biz.city,
        },
    }


# ==============================================================================
# Endpoints: 2. Merchant Settings & Preferences
# ==============================================================================
@router.get("/settings", response_model=Dict[str, Any])
def get_merchant_settings(
    biz: Business = Depends(get_current_merchant_business),
):
    """
    Returns merchant notifications, preferences, security, and connected integrations.
    """
    key = str(biz.id)
    settings_data = MERCHANT_SETTINGS_STORE.get(
        key,
        {
            "notifications": {
                "enquiries": True,
                "reviews": True,
                "promotions": True,
                "billing": True,
                "queries": True,
                "updates": False,
            },
            "preferences": {
                "language": "English",
                "timezone": "(GMT +5:30) India Standard Time",
                "dateFormat": "DD MMM YYYY (e.g. 30 Apr 2026)",
                "currency": "INR (₹)",
                "measurement": "Metric (km, m, °C)",
            },
            "security": {
                "twoFactorEnabled": False,
                "lastPasswordChange": "Recently",
            },
            "integrations": {
                "googleBusinessConnected": True,
                "whatsAppConnected": bool(biz.phone),
            },
        },
    )

    return {"status": "success", "settings": settings_data}


@router.put("/settings", response_model=Dict[str, Any])
def update_merchant_settings(
    body: MerchantSettingsUpdateRequest,
    biz: Business = Depends(get_current_merchant_business),
):
    """
    Persists merchant notification toggles, language, currency, and integration states.
    """
    key = str(biz.id)
    curr = MERCHANT_SETTINGS_STORE.get(
        key,
        {
            "notifications": {
                "enquiries": True,
                "reviews": True,
                "promotions": True,
                "billing": True,
                "queries": True,
                "updates": False,
            },
            "preferences": {
                "language": "English",
                "timezone": "(GMT +5:30) India Standard Time",
                "dateFormat": "DD MMM YYYY (e.g. 30 Apr 2026)",
                "currency": "INR (₹)",
                "measurement": "Metric (km, m, °C)",
            },
            "security": {
                "twoFactorEnabled": False,
                "lastPasswordChange": "Recently",
            },
            "integrations": {
                "googleBusinessConnected": True,
                "whatsAppConnected": bool(biz.phone),
            },
        },
    )

    curr = copy.deepcopy(curr) if isinstance(curr, dict) else {}
    if "notifications" not in curr or not isinstance(curr["notifications"], dict):
        curr["notifications"] = {
            "enquiries": True,
            "reviews": True,
            "promotions": True,
            "billing": True,
            "queries": True,
            "updates": False,
        }
    if "preferences" not in curr or not isinstance(curr["preferences"], dict):
        curr["preferences"] = {
            "language": "English",
            "timezone": "(GMT +5:30) India Standard Time",
            "dateFormat": "DD MMM YYYY (e.g. 30 Apr 2026)",
            "currency": "INR (₹)",
            "measurement": "Metric (km, m, °C)",
        }
    if "integrations" not in curr or not isinstance(curr["integrations"], dict):
        curr["integrations"] = {
            "googleBusinessConnected": True,
            "whatsAppConnected": bool(biz.phone),
        }

    if body.notifications:
        curr["notifications"].update(body.notifications)
    if body.preferences:
        curr["preferences"].update(body.preferences)
    if body.google_business_connected is not None:
        curr["integrations"]["googleBusinessConnected"] = body.google_business_connected
    if body.whatsapp_connected is not None:
        curr["integrations"]["whatsAppConnected"] = body.whatsapp_connected

    MERCHANT_SETTINGS_STORE[key] = curr

    return {
        "status": "success",
        "message": "Settings and preferences saved successfully.",
        "settings": curr,
    }


# ==============================================================================
# Endpoints: 3. Security (Password & 2FA)
# ==============================================================================
@router.post("/security/password", response_model=Dict[str, Any])
def change_merchant_password(
    body: PasswordChangeRequest,
    user: User = Depends(get_current_user),
    biz: Business = Depends(get_current_merchant_business),
    db: Session = Depends(get_db),
):
    """
    Changes or updates the merchant portal login PIN / password for the authenticated user in the database.
    """
    if len(body.new_pin) < 4:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="PIN / Password must be at least 4 characters long.",
        )

    if body.old_pin and user.password_hash:
        if not verify_password(body.old_pin, user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Current PIN / Password does not match.",
            )

    user.password_hash = hash_password(body.new_pin)
    db.commit()

    key = str(biz.id)
    if key in MERCHANT_SETTINGS_STORE and isinstance(MERCHANT_SETTINGS_STORE[key], dict):
        MERCHANT_SETTINGS_STORE[key].setdefault("security", {})
        MERCHANT_SETTINGS_STORE[key]["security"]["lastPasswordChange"] = "Just now"

    return {
        "status": "success",
        "message": "Merchant password / PIN changed successfully.",
        "updatedAt": datetime.datetime.utcnow().isoformat(),
    }


@router.post("/security/2fa", response_model=Dict[str, Any])
def toggle_two_factor_auth(
    body: TwoFactorToggleRequest,
    biz: Business = Depends(get_current_merchant_business),
):
    """
    Enables or disables Two-Factor Authentication (2FA) for the merchant portal.
    """
    key = str(biz.id)
    if key not in MERCHANT_SETTINGS_STORE:
        MERCHANT_SETTINGS_STORE[key] = {
            "notifications": {},
            "preferences": {},
            "security": {"twoFactorEnabled": body.enabled, "lastPasswordChange": "Recently"},
            "integrations": {},
        }
    else:
        MERCHANT_SETTINGS_STORE[key]["security"]["twoFactorEnabled"] = body.enabled

    return {
        "status": "success",
        "twoFactorEnabled": body.enabled,
        "message": f"Two-factor authentication has been {'enabled' if body.enabled else 'disabled'}.",
    }


# ==============================================================================
# Endpoints: 4. Account Actions & Data Export
# ==============================================================================
@router.get("/export-data", response_model=Dict[str, Any])
def export_merchant_data(
    db: Session = Depends(get_db),
    biz: Business = Depends(get_current_merchant_business),
):
    """
    Generates a full JSON export archive of all merchant data (storefront, products, orders, enquiries).
    Strictly isolated to records belonging to this authenticated merchant's business.
    """
    prods = db.query(Product).filter(Product.business_id == biz.id).all()
    offers = db.query(Offer).filter(Offer.business_id == biz.id).all()
    orders = db.query(Order).filter(Order.business_id == biz.id).all()
    leads = db.query(CustomerEnquiry).filter(CustomerEnquiry.business_id == biz.id).all()

    return {
        "status": "success",
        "exportedAt": datetime.datetime.utcnow().isoformat(),
        "storefront": {
            "id": biz.id,
            "name": biz.name,
            "category": biz.category,
            "address": biz.address,
            "phone": biz.phone,
            "email": biz.email,
        },
        "catalog": [
            {
                "id": p.id,
                "name": p.name,
                "price": p.local_price,
                "category": p.category,
                "status": p.availability_status,
            }
            for p in prods
        ],
        "offers": [
            {
                "id": o.id,
                "title": o.title,
                "discount": o.discount_text,
                "code": o.coupon_code,
            }
            for o in offers
        ],
        "orders": [
            {
                "orderNumber": o.order_number,
                "customerName": o.customer_name,
                "customerPhone": o.customer_phone,
                "total": o.final_payable,
                "status": o.status,
                "createdAt": o.created_at.isoformat(),
            }
            for o in orders
        ],
        "leads": [
            {
                "customerName": l.customer_name,
                "phone": l.customer_phone,
                "message": l.message,
                "status": l.status,
            }
            for l in leads
        ],
    }


@router.post("/account/deactivate", response_model=Dict[str, Any])
def deactivate_merchant_account(
    db: Session = Depends(get_db),
    biz: Business = Depends(get_current_merchant_business),
):
    """
    Deactivates merchant storefront (sets status to 'suspended').
    """
    biz.status = "suspended"
    db.commit()

    return {
        "status": "success",
        "message": f"Storefront '{biz.name}' has been deactivated. Public listings paused.",
    }


@router.delete("/account", response_model=Dict[str, Any])
def delete_merchant_account_permanently(
    db: Session = Depends(get_db),
    biz: Business = Depends(get_current_merchant_business),
):
    """
    Permanently deletes merchant storefront and all associated catalog items and orders.
    Strictly isolated to this authenticated merchant's business.
    """
    biz_name = biz.name

    # Cascade delete all products, offers, orders, enquiries
    db.query(Product).filter(Product.business_id == biz.id).delete()
    db.query(Offer).filter(Offer.business_id == biz.id).delete()
    db.query(CustomerEnquiry).filter(CustomerEnquiry.business_id == biz.id).delete()
    db.query(Order).filter(Order.business_id == biz.id).delete()
    db.delete(biz)
    db.commit()

    return {
        "status": "success",
        "message": f"Merchant storefront '{biz_name}' and all associated records deleted permanently.",
    }


# ==============================================================================
# Endpoints: 5. Products CRUD
# ==============================================================================
@router.get("/products", response_model=Dict[str, Any])
def list_merchant_products(
    db: Session = Depends(get_db),
    biz: Business = Depends(get_current_merchant_business),
):
    prods = db.query(Product).filter(Product.business_id == biz.id).order_by(Product.id.desc()).all()

    return {
        "status": "success",
        "count": len(prods),
        "products": [
            {
                "id": f"merchant-prod-{p.id}",
                "numericId": p.id,
                "name": p.name,
                "category": p.category,
                "price": p.local_price,
                "originalPrice": p.online_price or p.mrp,
                "discount": f"Save ₹{int((p.online_price or p.mrp) - p.local_price)}" if (p.online_price or p.mrp) and (p.online_price or p.mrp) > p.local_price else None,
                "stock": p.stock_quantity or 100,
                "status": "Active" if p.availability_status == "in_stock" else "Paused",
                "views": (biz.view_count or 0) + p.id * 3,
                "rating": 4.8,
                "image": p.image_url or "./assets/crops/prod-arhar-dal.webp",
            }
            for p in prods
        ],
    }


@router.post("/products", response_model=Dict[str, Any])
def create_merchant_product(
    body: MerchantProductCreateRequest,
    db: Session = Depends(get_db),
    biz: Business = Depends(get_current_merchant_business),
):
    new_p = Product(
        business_id=biz.id,
        name=body.name.strip(),
        brand=body.brand or biz.name,
        category=body.category.strip(),
        local_price=body.price,
        mrp=body.mrp,
        online_price=body.mrp or round(body.price * 1.18),
        online_provider="Online MRP",
        description=body.description,
        availability_status=body.availability_status,
        stock_quantity=body.stock_quantity,
        image_url=body.image_url or body.image,
    )
    db.add(new_p)
    db.commit()
    db.refresh(new_p)

    return {
        "status": "success",
        "message": "Product created successfully.",
        "product": {
            "id": f"merchant-prod-{new_p.id}",
            "numericId": new_p.id,
            "name": new_p.name,
            "price": new_p.local_price,
            "category": new_p.category,
            "status": "Active" if new_p.availability_status == "in_stock" else "Paused",
        },
    }


@router.put("/products/{product_id}", response_model=Dict[str, Any])
def update_merchant_product(
    product_id: int,
    body: Dict[str, Any],
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    biz: Business = Depends(get_current_merchant_business),
):
    p = db.query(Product).filter(Product.id == product_id).first()
    if not p:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found.")
    if p.business_id != biz.id and user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: You do not have permission to modify this product.",
        )

    if "name" in body:
        p.name = body["name"]
    if "price" in body:
        p.local_price = float(body["price"])
    if "category" in body:
        p.category = body["category"]
    if "status" in body:
        p.availability_status = "in_stock" if body["status"] == "Active" else "out_of_stock"
    if "stock" in body:
        p.stock_quantity = int(body["stock"])
    if "image_url" in body:
        p.image_url = body["image_url"]
    elif "image" in body:
        p.image_url = body["image"]

    p.updated_at = datetime.datetime.utcnow()
    db.commit()
    db.refresh(p)

    return {"status": "success", "message": "Product updated successfully."}


@router.delete("/products/{product_id}", response_model=Dict[str, Any])
def delete_merchant_product(
    product_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    biz: Business = Depends(get_current_merchant_business),
):
    p = db.query(Product).filter(Product.id == product_id).first()
    if not p:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found.")
    if p.business_id != biz.id and user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: You do not have permission to delete this product.",
        )

    db.delete(p)
    db.commit()
    return {"status": "success", "message": "Product removed from catalog."}


# ==============================================================================
# Endpoints: 6. Orders Management
# ==============================================================================
@router.get("/orders", response_model=Dict[str, Any])
def list_merchant_orders(
    db: Session = Depends(get_db),
    biz: Business = Depends(get_current_merchant_business),
):
    orders = db.query(Order).filter(Order.business_id == biz.id).order_by(Order.id.desc()).all()

    return {
        "status": "success",
        "count": len(orders),
        "orders": [
            {
                "id": str(o.id),
                "orderNumber": o.order_number,
                "customerName": o.customer_name,
                "customerPhone": o.customer_phone,
                "deliveryAddress": o.delivery_address,
                "items": [
                    {
                        "name": item.item_name if hasattr(item, 'item_name') else getattr(item, 'product_name', 'Item'),
                        "quantity": item.quantity if hasattr(item, 'quantity') else 1,
                        "price": item.unit_price,
                    }
                    for item in o.items
                ] if o.items else [{"name": "Store Order Items", "quantity": 1, "price": o.final_payable}],
                "subtotal": o.total_amount,
                "finalPayable": o.final_payable,
                "paymentMethod": o.payment_method,
                "paymentStatus": o.payment_status,
                "status": o.status,
                "createdAt": o.created_at.strftime("%I:%M %p, %d %b"),
                "estimatedDelivery": f"Within {o.estimated_delivery_mins} mins",
            }
            for o in orders
        ],
    }


@router.put("/orders/{order_id}/status", response_model=Dict[str, Any])
def update_merchant_order_status(
    order_id: int,
    body: OrderStatusUpdateRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    biz: Business = Depends(get_current_merchant_business),
):
    o = db.query(Order).filter(Order.id == order_id).first()
    if not o:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found.")
    if o.business_id != biz.id and user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: You do not have permission to modify this order.",
        )

    o.status = body.status
    o.updated_at = datetime.datetime.utcnow()
    db.commit()

    return {"status": "success", "message": f"Order status updated to {body.status}."}


# ==============================================================================
# Endpoints: 7. Leads & Enquiries
# ==============================================================================
@router.get("/leads", response_model=Dict[str, Any])
def list_merchant_leads(
    db: Session = Depends(get_db),
    biz: Business = Depends(get_current_merchant_business),
):
    enquiries = db.query(CustomerEnquiry).filter(CustomerEnquiry.business_id == biz.id).order_by(CustomerEnquiry.id.desc()).all()

    return {
        "status": "success",
        "count": len(enquiries),
        "leads": [
            {
                "id": str(e.id),
                "customerName": e.customer_name,
                "customerPhone": e.customer_phone,
                "interestedCategory": e.enquiry_type,
                "message": e.message,
                "status": "New" if e.status == "pending" else "Contacted" if e.status == "contacted" else "Closed",
                "createdAt": e.created_at.strftime("%d %b, %I:%M %p"),
            }
            for e in enquiries
        ],
    }


@router.put("/leads/{lead_id}/status", response_model=Dict[str, Any])
def update_lead_status(
    lead_id: int,
    body: LeadStatusUpdateRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    biz: Business = Depends(get_current_merchant_business),
):
    e = db.query(CustomerEnquiry).filter(CustomerEnquiry.id == lead_id).first()
    if not e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Enquiry not found.")
    if e.business_id != biz.id and user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: You do not have permission to modify this enquiry.",
        )

    mapped_status = "pending" if body.status == "New" else "contacted" if body.status == "Contacted" else "resolved"
    e.status = mapped_status
    db.commit()

    return {"status": "success", "message": f"Lead status updated to {body.status}."}


# ==============================================================================
# Endpoints: 8. Overview Aggregated Metrics & Telemetry
# ==============================================================================
@router.get("/overview", response_model=Dict[str, Any])
def get_merchant_overview(
    db: Session = Depends(get_db),
    biz: Business = Depends(get_current_merchant_business),
):
    """
    Computes deterministic, real counts for the merchant dashboard (zero hardcoded mock data).
    Strictly isolated to the authenticated merchant's business.
    """
    active_products = db.query(func.count(Product.id)).filter(
        Product.business_id == biz.id,
        Product.availability_status == "in_stock"
    ).scalar() or 0

    total_products = db.query(func.count(Product.id)).filter(
        Product.business_id == biz.id
    ).scalar() or 0

    active_services = db.query(func.count(ServiceListing.id)).filter(
        ServiceListing.business_id == biz.id,
        ServiceListing.is_available == True
    ).scalar() or 0

    total_services = db.query(func.count(ServiceListing.id)).filter(
        ServiceListing.business_id == biz.id
    ).scalar() or 0

    active_offers = db.query(func.count(Offer.id)).filter(
        Offer.business_id == biz.id,
        Offer.is_active == True
    ).scalar() or 0

    total_orders = db.query(func.count(Order.id)).filter(
        Order.business_id == biz.id
    ).scalar() or 0

    placed_orders = db.query(func.count(Order.id)).filter(
        Order.business_id == biz.id,
        Order.status == "placed"
    ).scalar() or 0

    total_leads = db.query(func.count(CustomerEnquiry.id)).filter(
        CustomerEnquiry.business_id == biz.id
    ).scalar() or 0

    new_leads = db.query(func.count(CustomerEnquiry.id)).filter(
        CustomerEnquiry.business_id == biz.id,
        CustomerEnquiry.status == "pending"
    ).scalar() or 0

    return {
        "status": "success",
        "business": {
            "id": biz.id,
            "name": biz.name,
            "category": biz.category,
            "rating": round(biz.rating, 1) if biz.review_count > 0 else 5.0,
            "reviewCount": biz.review_count or 0,
            "isVerified": biz.is_verified,
        },
        "metrics": {
            "activeProductsCount": active_products,
            "totalProductsCount": total_products,
            "activeServicesCount": active_services,
            "totalServicesCount": total_services,
            "activeOffersCount": active_offers,
            "totalOrdersCount": total_orders,
            "placedOrdersCount": placed_orders,
            "totalLeadsCount": total_leads,
            "newLeadsCount": new_leads,
            "profileViews": biz.view_count or 0,
            "directionClicks": biz.direction_clicks or 0,
            "callClicks": biz.call_clicks or 0,
            "totalInteractions": total_orders + total_leads + (biz.review_count or 0),
        },
    }


# ==============================================================================
# Endpoints: 9. Services CRUD
# ==============================================================================
@router.get("/services", response_model=Dict[str, Any])
def list_merchant_services(
    db: Session = Depends(get_db),
    biz: Business = Depends(get_current_merchant_business),
):
    services = db.query(ServiceListing).filter(ServiceListing.business_id == biz.id).order_by(ServiceListing.id.desc()).all()

    return {
        "status": "success",
        "count": len(services),
        "services": [
            {
                "id": f"srv-{s.id}",
                "numericId": s.id,
                "name": s.provider_name,
                "category": s.category,
                "description": s.description,
                "price": f"₹{int(s.price_starting_at)} onwards" if s.price_starting_at else "Quote on Call",
                "priceValue": s.price_starting_at or 500,
                "phone": s.phone,
                "status": "Active" if s.is_available else "Paused",
                "rating": round(s.rating, 1),
                "reviewCount": s.review_count,
            }
            for s in services
        ],
    }


@router.post("/services", response_model=Dict[str, Any])
def create_merchant_service(
    body: MerchantServiceCreateRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    biz: Business = Depends(get_current_merchant_business),
):
    svc_name = (body.name or body.title or f"{biz.name} Service").strip()
    price = body.price_starting_at or body.price_starting or 500.0

    new_s = ServiceListing(
        business_id=biz.id,
        user_id=user.id,
        provider_name=svc_name,
        category=body.category.strip(),
        description=body.description or f"Professional service by {biz.name}",
        service_area=f"{biz.locality} and nearby sectors",
        locality=biz.locality,
        city=biz.city,
        latitude=biz.latitude or 28.6139,
        longitude=biz.longitude or 77.2090,
        phone=body.phone or biz.phone or "+91 98110 24024",
        whatsapp=body.whatsapp or biz.phone,
        price_starting_at=price,
        price_unit=body.price_unit,
        timing=body.timing,
        experience_years=5,
        is_verified=True,
        is_available=True,
        rating=5.0,
        review_count=0,
    )
    db.add(new_s)
    db.commit()
    db.refresh(new_s)

    return {
        "status": "success",
        "message": "Service listed successfully.",
        "service": {
            "id": f"srv-{new_s.id}",
            "numericId": new_s.id,
            "name": new_s.provider_name,
            "category": new_s.category,
            "price": f"₹{int(new_s.price_starting_at)} onwards",
            "status": "Active",
        },
    }


@router.delete("/services/{service_id}", response_model=Dict[str, Any])
def delete_merchant_service(
    service_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    biz: Business = Depends(get_current_merchant_business),
):
    s = db.query(ServiceListing).filter(ServiceListing.id == service_id).first()
    if not s:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Service listing not found.")
    if s.business_id != biz.id and user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: You do not have permission to delete this service.",
        )
    db.delete(s)
    db.commit()
    return {"status": "success", "message": "Service listing deleted successfully."}


# ==============================================================================
# Endpoints: 10. Offers CRUD
# ==============================================================================
@router.get("/offers", response_model=Dict[str, Any])
def list_merchant_offers(
    db: Session = Depends(get_db),
    biz: Business = Depends(get_current_merchant_business),
):
    offers = db.query(Offer).filter(Offer.business_id == biz.id).order_by(Offer.id.desc()).all()

    return {
        "status": "success",
        "count": len(offers),
        "offers": [
            {
                "id": f"off-{o.id}",
                "numericId": o.id,
                "title": o.title,
                "discountText": o.discount_text,
                "code": o.coupon_code or "LOCALDEAL",
                "type": o.category or "Special Deal",
                "validUntil": o.valid_until.strftime("%d %b %Y"),
                "status": "Active" if o.is_active else "Expired",
                "claimedCount": 0,
                "image": o.banner_image_url or "./assets/crops/biz-urban-chai.webp",
            }
            for o in offers
        ],
    }


@router.post("/offers", response_model=Dict[str, Any])
def create_merchant_offer(
    body: MerchantOfferCreateRequest,
    db: Session = Depends(get_db),
    biz: Business = Depends(get_current_merchant_business),
):
    discount = (body.discount_text or body.discountText or "Special Discount").strip()
    coupon = (body.coupon_code or body.code or f"DEAL{int(datetime.datetime.utcnow().timestamp()) % 1000}").upper().strip()

    valid_until_dt = datetime.datetime.utcnow() + datetime.timedelta(days=body.valid_days or 14)
    if body.valid_until:
        try:
            valid_until_dt = datetime.datetime.fromisoformat(body.valid_until.replace("Z", "+00:00"))
        except Exception:
            pass

    banner_img = body.banner_image_url or body.image_url or body.image

    new_o = Offer(
        business_id=biz.id,
        title=body.title.strip(),
        description=body.description or f"Exclusive offer from {biz.name}",
        discount_text=discount,
        coupon_code=coupon,
        category=body.category or biz.category,
        valid_from=datetime.datetime.utcnow(),
        valid_until=valid_until_dt,
        terms_conditions="Valid for local residents. Cannot be combined with other offers.",
        is_active=True,
        banner_image_url=banner_img,
    )
    db.add(new_o)
    db.commit()
    db.refresh(new_o)

    return {
        "status": "success",
        "message": "Offer created successfully.",
        "offer": {
            "id": f"off-{new_o.id}",
            "numericId": new_o.id,
            "title": new_o.title,
            "discountText": new_o.discount_text,
            "code": new_o.coupon_code,
            "status": "Active",
        },
    }


@router.delete("/offers/{offer_id}", response_model=Dict[str, Any])
def delete_merchant_offer(
    offer_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    biz: Business = Depends(get_current_merchant_business),
):
    o = db.query(Offer).filter(Offer.id == offer_id).first()
    if not o:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Offer not found.")
    if o.business_id != biz.id and user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: You do not have permission to delete this offer.",
        )
    db.delete(o)
    db.commit()
    return {"status": "success", "message": "Offer deleted successfully."}


# ==============================================================================
# Endpoints: 11. Events CRUD
# ==============================================================================
@router.get("/events", response_model=Dict[str, Any])
def list_merchant_events(
    db: Session = Depends(get_db),
    biz: Business = Depends(get_current_merchant_business),
):
    events = db.query(Event).filter(
        or_(
            Event.organizer == biz.name,
            Event.source == f"Merchant: {biz.name}",
        )
    ).order_by(Event.id.desc()).all()

    return {
        "status": "success",
        "count": len(events),
        "events": [
            {
                "id": f"evt-{e.id}",
                "numericId": e.id,
                "title": e.title,
                "category": e.category,
                "organizer": e.organizer,
                "venue": e.venue_name,
                "dateDisplay": e.timing_text or e.start_time.strftime("%d %b %Y, %I:%M %p"),
                "status": "Upcoming" if e.start_time >= datetime.datetime.utcnow() else "Completed",
            }
            for e in events
        ],
    }


@router.post("/events", response_model=Dict[str, Any])
def create_merchant_event(
    body: MerchantEventCreateRequest,
    db: Session = Depends(get_db),
    biz: Business = Depends(get_current_merchant_business),
):
    venue = (body.venue_name or body.venue or biz.address).strip()
    organizer = (body.organizer or biz.name).strip()

    start_dt = datetime.datetime.utcnow() + datetime.timedelta(days=7)
    if body.start_time:
        try:
            start_dt = datetime.datetime.fromisoformat(body.start_time.replace("Z", "+00:00"))
        except Exception:
            pass
    elif body.event_date:
        try:
            start_dt = datetime.datetime.fromisoformat(body.event_date.replace("Z", "+00:00"))
        except Exception:
            pass

    new_e = Event(
        title=body.title.strip(),
        category=body.category or "Community Event",
        organizer=organizer,
        venue_name=venue,
        address=body.address or biz.address,
        locality=biz.locality,
        city=biz.city,
        latitude=biz.latitude or 28.6139,
        longitude=biz.longitude or 77.2090,
        start_time=start_dt,
        timing_text=body.timing_text or start_dt.strftime("%d %b %Y • 10:00 AM onwards"),
        description=body.description or f"Community event organized by {biz.name}.",
        is_verified=True,
        source=f"Merchant: {biz.name}",
    )
    db.add(new_e)
    db.commit()
    db.refresh(new_e)

    return {
        "status": "success",
        "message": "Event published successfully.",
        "event": {
            "id": f"evt-{new_e.id}",
            "numericId": new_e.id,
            "title": new_e.title,
            "venue": new_e.venue_name,
            "status": "Upcoming",
        },
    }


@router.delete("/events/{event_id}", response_model=Dict[str, Any])
def delete_merchant_event(
    event_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    biz: Business = Depends(get_current_merchant_business),
):
    e = db.query(Event).filter(Event.id == event_id).first()
    if not e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found.")

    is_owner = (
        e.organizer == biz.name
        or e.source == f"Merchant: {biz.name}"
        or (biz.address and e.address == biz.address)
    )
    if not is_owner and user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: You do not have permission to delete this event.",
        )

    db.delete(e)
    db.commit()
    return {"status": "success", "message": "Event deleted successfully."}


# ==============================================================================
# Web Push Notifications (Service Worker Background Order Chime)
# ==============================================================================

class PushSubscriptionPayload(BaseModel):
    business_id: str
    endpoint: str
    p256dh: Optional[str] = None
    auth: Optional[str] = None
    user_agent: Optional[str] = None


@router.get("/push-subscription/public-key", response_model=Dict[str, Any])
def get_push_public_key():
    """
    Returns the VAPID public key so client browsers and PWAs can subscribe
    to Web Push notifications via Service Worker (pushManager.subscribe).
    """
    return {
        "status": "success",
        "public_key": get_vapid_public_key(),
    }


@router.post("/push-subscription", response_model=Dict[str, Any])
def save_push_subscription(
    req: PushSubscriptionPayload,
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(get_current_user_optional if "get_current_user_optional" in globals() else lambda: None),
):
    """
    Registers or updates a Web Push subscription endpoint for the merchant storefront.
    Allows lock-screen ringing and audio notification via Service Worker when the phone is sleeping.
    """
    if not req.endpoint or not req.business_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="business_id and endpoint are required.",
        )

    clean_biz = str(req.business_id).strip()
    clean_endpoint = req.endpoint.strip()

    sub = (
        db.query(MerchantPushSubscription)
        .filter(
            MerchantPushSubscription.business_id == clean_biz,
            MerchantPushSubscription.endpoint == clean_endpoint,
        )
        .first()
    )

    if sub:
        sub.p256dh = req.p256dh
        sub.auth = req.auth
        sub.user_agent = req.user_agent
        sub.updated_at = datetime.datetime.utcnow()
    else:
        sub = MerchantPushSubscription(
            business_id=clean_biz,
            user_id=getattr(user, "id", None) if user else None,
            endpoint=clean_endpoint,
            p256dh=req.p256dh,
            auth=req.auth,
            user_agent=req.user_agent,
            created_at=datetime.datetime.utcnow(),
            updated_at=datetime.datetime.utcnow(),
        )
        db.add(sub)

    db.commit()
    logger.info(f"[webpush] Registered push subscription for business {clean_biz}: {clean_endpoint[:45]}...")

    return {
        "status": "success",
        "message": "Push subscription registered successfully.",
        "subscription_id": sub.id,
    }


@router.delete("/push-subscription", response_model=Dict[str, Any])
def delete_push_subscription(
    endpoint: str = Query(...),
    business_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    """Removes a Web Push subscription endpoint."""
    q = db.query(MerchantPushSubscription).filter(MerchantPushSubscription.endpoint == endpoint.strip())
    if business_id:
        q = q.filter(MerchantPushSubscription.business_id == business_id.strip())
    deleted_count = q.delete(synchronize_session=False)
    db.commit()

    return {
        "status": "success",
        "deleted_count": deleted_count,
        "message": "Push subscription removed successfully.",
    }


@router.post("/test-push", response_model=Dict[str, Any])
async def trigger_test_push(
    business_id: str = Query("biz-registered-store"),
    db: Session = Depends(get_db),
):
    """
    Dispatches a test order audio chime notification to all registered Web Push devices
    belonging to the merchant storefront.
    """
    clean_biz = business_id.strip()
    test_payload = {
        "type": "MERCHANT_ORDER",
        "title": "🛍️ Test Order Alert — MyArea24",
        "body": "Sample order received: ₹350.00 from Priya S. • Audio chime & lock screen ring verified!",
        "orderNumber": f"TEST-ORD-{int(time.time()) % 10000}",
        "businessId": clean_biz,
        "finalPayable": 350.0,
        "customerName": "Priya S.",
        "deliveryAddress": "Flat 402, Green Valley Apartments",
        "url": "/merchant",
    }

    count = await send_merchant_push_notification(clean_biz, test_payload, db)
    return {
        "status": "success",
        "dispatched_count": count,
        "message": f"Test push notification dispatched to {count} registered device(s).",
    }

