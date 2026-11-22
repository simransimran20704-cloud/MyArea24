import datetime
import logging
import math
import re
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status, UploadFile, File
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import or_, func

from backend.app.api.deps import get_current_user
from backend.app.database.models import Business, Product, User
from backend.app.database.session import get_db
from backend.app.intelligence.rules import haversine_distance_km
from backend.app.services.business_discovery_service import sync_live_businesses, extract_locality_tokens
from backend.app.services.indian_search_synonyms import (
    expand_search_query,
    get_implied_categories_for_query,
)
from backend.app.services.media_storage import save_merchant_media

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/products", tags=["Nearby Products & Price Comparison"])


class ProductCreateRequest(BaseModel):
    business_id: Optional[int] = None
    name: str
    brand: Optional[str] = None
    model_variant: Optional[str] = None
    category: str
    description: Optional[str] = None
    local_price: float
    mrp: Optional[float] = None
    online_price: Optional[float] = None
    online_provider: Optional[str] = None
    online_url: Optional[str] = None
    availability_status: str = "in_stock"  # 'in_stock', 'confirm_with_seller', 'low_stock', 'out_of_stock'
    stock_quantity: Optional[int] = None
    image_url: Optional[str] = None
    image: Optional[str] = None
    is_featured: bool = False


class ProductUpdateRequest(BaseModel):
    name: Optional[str] = None
    brand: Optional[str] = None
    model_variant: Optional[str] = None
    category: Optional[str] = None
    description: Optional[str] = None
    local_price: Optional[float] = None
    mrp: Optional[float] = None
    online_price: Optional[float] = None
    online_provider: Optional[str] = None
    online_url: Optional[str] = None
    availability_status: Optional[str] = None
    stock_quantity: Optional[int] = None
    image_url: Optional[str] = None
    image: Optional[str] = None
    is_featured: Optional[bool] = None


def format_relative_freshness(dt: Optional[datetime.datetime]) -> str:
    if not dt:
        return "Price recently verified"
    delta = datetime.datetime.utcnow() - dt
    if delta.total_seconds() < 3600:
        mins = max(1, int(delta.total_seconds() // 60))
        return f"Updated {mins}m ago"
    elif delta.total_seconds() < 86400:
        hrs = int(delta.total_seconds() // 3600)
        return f"Updated {hrs}h ago"
    else:
        days = int(delta.total_seconds() // 86400)
        return f"Updated {days}d ago"


@router.get("", response_model=Dict[str, Any])
def search_products(
    q: Optional[str] = Query(None, description="Search term across name, brand, model"),
    category: Optional[str] = Query(None, description="Category filter"),
    brand: Optional[str] = Query(None, description="Brand filter"),
    business_id: Optional[str] = Query(None, description="Filter by specific merchant business ID or slug"),
    locality: Optional[str] = Query(None, description="Locality or area filter"),
    city: Optional[str] = Query(None, description="City filter"),
    pincode: Optional[str] = Query(None, description="Pincode / Postal code filter"),
    min_price: Optional[float] = Query(None, description="Minimum local price"),
    max_price: Optional[float] = Query(None, description="Maximum local price"),
    in_stock_only: Optional[bool] = Query(False, description="Filter for in-stock products"),
    user_lat: Optional[float] = Query(None, description="User latitude for distance calculation"),
    user_lon: Optional[float] = Query(None, description="User longitude for distance calculation"),
    sort_by: str = Query("relevance", description="relevance, price_asc, price_desc, distance"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    # Normalize parameter types for direct python & test call resilience
    q = q if isinstance(q, str) else None
    category = category if isinstance(category, str) else None
    brand = brand if isinstance(brand, str) else None
    business_id = str(business_id) if isinstance(business_id, (str, int)) else None
    locality = locality if isinstance(locality, str) else None
    city = city if isinstance(city, str) else None
    pincode = pincode if isinstance(pincode, str) else None
    min_price = min_price if isinstance(min_price, (int, float)) else None
    max_price = max_price if isinstance(max_price, (int, float)) else None
    in_stock_only = in_stock_only if isinstance(in_stock_only, bool) else False
    user_lat = float(user_lat) if isinstance(user_lat, (int, float)) else None
    user_lon = float(user_lon) if isinstance(user_lon, (int, float)) else None
    sort_by = sort_by if isinstance(sort_by, str) else "relevance"
    page = page if isinstance(page, int) and page >= 1 else 1
    page_size = page_size if isinstance(page_size, int) and page_size >= 1 else 20

    # Resolve coordinates and canonical city/locality across all 780+ Indian districts
    target_loc = (city or locality or "").strip()
    disp_city = (city or "").strip()
    disp_locality = (locality or "").strip()
    if target_loc and business_id is None:
        try:
            from backend.app.services.event_ingestion_service import resolve_city_centroid_and_name
            _, res_city, res_loc, c_lat, c_lon = resolve_city_centroid_and_name(
                target_loc, lat=None, lon=None, locality_name=locality
            )
            disp_city = res_city or disp_city
            disp_locality = res_loc or disp_locality
            if user_lat is None or user_lon is None:
                user_lat, user_lon = c_lat, c_lon
            elif haversine_distance_km(user_lat, user_lon, c_lat, c_lon) > 100.0:
                user_lat, user_lon = c_lat, c_lon
        except Exception:
            pass

    # Dynamic live business & product discovery if coordinates provided and area count is low
    if user_lat is not None and user_lon is not None and business_id is None:
        try:
            nearby_count = db.query(Business).filter(
                (Business.latitude - user_lat) * (Business.latitude - user_lat)
                + (Business.longitude - user_lon) * (Business.longitude - user_lon) <= 0.04
            ).count()
            if nearby_count < 4:
                sync_live_businesses(db, user_lat, user_lon, disp_city or city, disp_locality or locality)
        except Exception:
            pass

    query = db.query(Product).join(Business, Product.business_id == Business.id)
    if business_id is not None and str(business_id).strip():
        raw_biz = str(business_id).strip()
        biz_conds = [Business.slug == raw_biz, func.lower(Business.name) == raw_biz.lower()]
        digits = re.sub(r"\D", "", raw_biz)
        if digits:
            biz_conds.append(Product.business_id == int(digits))
        query = query.filter(or_(*biz_conds))
    else:
        query = query.filter(Business.status == "active")

    # Exclude inactive, discontinued, out of stock, or zero-stock products per requirements
    query = query.filter(
        Product.availability_status.notin_(["out_of_stock", "discontinued", "inactive"]),
        or_(Product.stock_quantity == None, Product.stock_quantity > 0),
    )

    if pincode and pincode.strip():
        query = query.filter(Business.pincode == pincode.strip())

    is_postgres = False
    try:
        bind = db.get_bind()
        if bind and bind.dialect.name == "postgresql":
            is_postgres = True
    except Exception:
        pass

    if q:
        cleaned_q = q.strip().lower()
        expanded_terms = expand_search_query(cleaned_q, max_terms=15)
        implied_categories = get_implied_categories_for_query(cleaned_q)
        q_clauses = []

        if is_postgres:
            ts_query = func.plainto_tsquery('english', cleaned_q)
            ts_vector = func.to_tsvector(
                'english',
                func.concat_ws(' ', Product.name, Product.brand, Product.description, Product.category, Business.name)
            )
            q_clauses.append(ts_vector.op('@@')(ts_query))

            # PostgreSQL pg_trgm trigram similarity for typo tolerance on product name & brand
            if len(cleaned_q) >= 3:
                q_clauses.append(func.similarity(Product.name, cleaned_q) >= 0.25)
                q_clauses.append(func.similarity(Product.brand, cleaned_q) >= 0.25)

            for term in expanded_terms:
                pat = f"%{term}%"
                q_clauses.append(func.lower(Product.name).like(pat))
                q_clauses.append(func.lower(Product.brand).like(pat))
                q_clauses.append(func.lower(Product.model_variant).like(pat))
                q_clauses.append(func.lower(Product.category).like(pat))
                q_clauses.append(func.lower(Product.description).like(pat))
                q_clauses.append(func.lower(Business.name).like(pat))

            for cat in implied_categories:
                q_clauses.append(func.lower(Product.category).like(f"%{cat.lower()}%"))
        else:
            for term in expanded_terms:
                pat = f"%{term}%"
                q_clauses.append(func.lower(Product.name).like(pat))
                q_clauses.append(func.lower(Product.brand).like(pat))
                q_clauses.append(func.lower(Product.model_variant).like(pat))
                q_clauses.append(func.lower(Product.category).like(pat))
                q_clauses.append(func.lower(Product.description).like(pat))
                q_clauses.append(func.lower(Business.name).like(pat))

            for cat in implied_categories:
                q_clauses.append(func.lower(Product.category).like(f"%{cat.lower()}%"))

        if q_clauses:
            query = query.filter(or_(*q_clauses))

    if category:
        query = query.filter(func.lower(Product.category) == category.strip().lower())

    if brand:
        query = query.filter(func.lower(Product.brand) == brand.strip().lower())

    if business_id is None:
        loc_tokens = extract_locality_tokens(locality or disp_locality, city or disp_city)
        broad_regions = {"delhi", "new delhi", "mumbai", "india", "local area", "all", "select your area (india)"}
        token_clauses = []
        for tok in loc_tokens:
            if len(tok) >= 3 and tok.lower() not in broad_regions:
                token_clauses.append(func.lower(Business.locality).like(f"%{tok.lower()}%"))
                token_clauses.append(func.lower(Business.address).like(f"%{tok.lower()}%"))

        if user_lat is not None and user_lon is not None:
            rad_lat = math.radians(user_lat)
            cos_lat = math.cos(rad_lat)
            cos_lat_sq = cos_lat * cos_lat
            dist_expr = (
                (Business.latitude - user_lat) * (Business.latitude - user_lat)
                + (Business.longitude - user_lon) * (Business.longitude - user_lon) * cos_lat_sq
            )
            # Hyperlocal radius: ~6.0 km or matching neighborhood locality
            if token_clauses:
                query = query.filter(or_(dist_expr <= 0.0035, *token_clauses))
            else:
                query = query.filter(dist_expr <= 0.0035)
        elif token_clauses:
            query = query.filter(or_(*token_clauses))

    if min_price is not None:
        query = query.filter(Product.local_price >= min_price)

    if max_price is not None:
        query = query.filter(Product.local_price <= max_price)

    if in_stock_only:
        query = query.filter(Product.availability_status == "in_stock")

    # SQL Ordering
    if sort_by == "price_asc":
        query = query.order_by(Product.local_price.asc(), Product.id.desc())
    elif sort_by == "price_desc":
        query = query.order_by(Product.local_price.desc(), Product.id.desc())
    elif sort_by == "distance" and user_lat is not None and user_lon is not None:
        rad_lat = math.radians(user_lat)
        cos_lat = math.cos(rad_lat)
        cos_lat_sq = cos_lat * cos_lat
        dist_expr = (
            (Business.latitude - user_lat) * (Business.latitude - user_lat)
            + (Business.longitude - user_lon) * (Business.longitude - user_lon) * cos_lat_sq
        )
        query = query.order_by(dist_expr.asc(), Product.id.desc())
    else:
        # Default relevance (featured first, then recent)
        query = query.order_by(Product.is_featured.desc(), Product.id.desc())

    # Direct SQL total count calculation
    total = query.count()

    # Direct SQL OFFSET and LIMIT pagination
    start = (page - 1) * page_size
    paged_products = query.offset(start).limit(page_size).all()

    items = []
    for p in paged_products:
        b = p.business
        dist = None
        if user_lat is not None and user_lon is not None:
            dist = round(haversine_distance_km(user_lat, user_lon, b.latitude, b.longitude), 2)

        # Price comparison analysis
        savings_amount = 0.0
        savings_percent = 0.0
        better_offline = False
        if p.online_price and p.online_price > 0:
            diff = p.online_price - p.local_price
            if diff > 0:
                savings_amount = round(diff, 2)
                savings_percent = round((diff / p.online_price) * 100, 1)
                better_offline = True

        items.append({
            "id": p.id,
            "name": p.name,
            "brand": p.brand,
            "model_variant": p.model_variant,
            "category": p.category,
            "description": p.description,
            "local_price": p.local_price,
            "mrp": p.mrp,
            "online_price": p.online_price,
            "online_provider": p.online_provider,
            "online_url": p.online_url,
            "savings_amount": savings_amount,
            "savings_percent": savings_percent,
            "better_offline": better_offline,
            "availability_status": p.availability_status,
            "stock_quantity": p.stock_quantity,
            "image_url": p.image_url,
            "price_updated_at": p.price_updated_at.isoformat() if p.price_updated_at else None,
            "freshness_label": format_relative_freshness(p.price_updated_at),
            "is_featured": p.is_featured,
            "business": {
                "id": b.id,
                "slug": b.slug,
                "name": b.name,
                "category": b.category,
                "address": b.address,
                "locality": b.locality,
                "city": b.city,
                "phone": b.phone,
                "whatsapp": b.whatsapp,
                "rating": b.rating,
                "latitude": b.latitude,
                "longitude": b.longitude,
                "distance_km": dist,
            },
        })

    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.get("/categories")
def list_product_categories(db: Session = Depends(get_db)):
    """Returns product categories with active item counts."""
    cats = (
        db.query(Product.category, func.count(Product.id))
        .join(Business, Product.business_id == Business.id)
        .filter(Business.status == "active")
        .group_by(Product.category)
        .all()
    )
    return [{"category": c[0], "count": c[1]} for c in cats]


@router.get("/{product_id}")
def get_product_detail(
    product_id: int,
    user_lat: Optional[float] = Query(None),
    user_lon: Optional[float] = Query(None),
    db: Session = Depends(get_db),
):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    b = product.business
    dist = None
    if user_lat is not None and user_lon is not None:
        dist = round(haversine_distance_km(user_lat, user_lon, b.latitude, b.longitude), 2)

    savings_amount = 0.0
    savings_percent = 0.0
    better_offline = False
    if product.online_price and product.online_price > 0:
        diff = product.online_price - product.local_price
        if diff > 0:
            savings_amount = round(diff, 2)
            savings_percent = round((diff / product.online_price) * 100, 1)
            better_offline = True

    # Nearby stores with same brand/category
    similar = (
        db.query(Product)
        .join(Business, Product.business_id == Business.id)
        .filter(Product.category == product.category, Product.id != product.id)
        .limit(4)
        .all()
    )

    return {
        "product": {
            "id": product.id,
            "name": product.name,
            "brand": product.brand,
            "model_variant": product.model_variant,
            "category": product.category,
            "description": product.description,
            "local_price": product.local_price,
            "mrp": product.mrp,
            "online_price": product.online_price,
            "online_provider": product.online_provider,
            "online_url": product.online_url,
            "savings_amount": savings_amount,
            "savings_percent": savings_percent,
            "better_offline": better_offline,
            "availability_status": product.availability_status,
            "stock_quantity": product.stock_quantity,
            "image_url": product.image_url,
            "price_updated_at": product.price_updated_at.isoformat() if product.price_updated_at else None,
            "freshness_label": format_relative_freshness(product.price_updated_at),
            "is_featured": product.is_featured,
        },
        "business": {
            "id": b.id,
            "slug": b.slug,
            "name": b.name,
            "category": b.category,
            "address": b.address,
            "locality": b.locality,
            "city": b.city,
            "phone": b.phone,
            "whatsapp": b.whatsapp,
            "rating": b.rating,
            "latitude": b.latitude,
            "longitude": b.longitude,
            "distance_km": dist,
            "opening_time": b.opening_time,
            "closing_time": b.closing_time,
        },
        "similar_products": [
            {
                "id": s.id,
                "name": s.name,
                "brand": s.brand,
                "local_price": s.local_price,
                "image_url": s.image_url,
                "store_name": s.business.name,
                "locality": s.business.locality,
            }
            for s in similar
        ],
    }


@router.get("/{product_id}/compare")
def compare_product_prices(
    product_id: int,
    user_lat: Optional[float] = Query(None),
    user_lon: Optional[float] = Query(None),
    db: Session = Depends(get_db),
):
    """
    Compares a product's offline price at nearby local stores against online marketplace benchmarks (PPT Slide 07).
    """
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    b = product.business
    online_price = product.online_price or product.mrp or round(product.local_price * 1.08, 2)
    savings = max(0.0, round(online_price - product.local_price, 2))

    # Find matching or category-peer products across nearby stores
    peers = (
        db.query(Product)
        .join(Business, Product.business_id == Business.id)
        .filter(Product.category == product.category)
        .limit(6)
        .all()
    )
    local_options = []
    for p in peers:
        dist = (
            round(haversine_distance_km(user_lat, user_lon, p.business.latitude, p.business.longitude), 2)
            if user_lat is not None and user_lon is not None
            else None
        )
        local_options.append({
            "product_id": p.id,
            "product_name": p.name,
            "store_name": p.business.name,
            "store_slug": p.business.slug,
            "locality": p.business.locality,
            "city": p.business.city,
            "local_price": p.local_price,
            "availability_status": p.availability_status,
            "distance_km": dist,
            "phone": p.business.phone,
        })

    prices = [opt["local_price"] for opt in local_options] or [product.local_price]
    return {
        "product_id": product.id,
        "product_name": product.name,
        "category": product.category,
        "price_range": {
            "min_local_price": min(prices),
            "max_local_price": max(prices),
            "online_benchmark_price": online_price,
            "online_provider": product.online_provider or "Amazon / Flipkart",
        },
        "savings_vs_online": savings,
        "better_offline": product.local_price <= online_price,
        "primary_store": {
            "id": b.id,
            "name": b.name,
            "slug": b.slug,
            "locality": b.locality,
            "local_price": product.local_price,
            "availability_status": product.availability_status,
        },
        "nearby_store_options": local_options,
    }


@router.post("", status_code=status.HTTP_201_CREATED)
def create_product(
    req: ProductCreateRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Adds a new product to a merchant's digital storefront.
    """
    target_biz_id = req.business_id
    if not target_biz_id:
        user_biz = db.query(Business).filter(Business.owner_id == user.id).first()
        if user_biz:
            target_biz_id = user_biz.id
        else:
            raise HTTPException(status_code=400, detail="business_id required or user must own a registered business")

    business = db.query(Business).filter(Business.id == target_biz_id).first()
    if not business:
        raise HTTPException(status_code=404, detail="Business not found")

    if user.role != "admin" and business.owner_id != user.id:
        raise HTTPException(status_code=403, detail="Not authorized to add products to this business")

    # Duplicate prevention: check if identical product name already exists in this business inventory
    existing_prod = (
        db.query(Product)
        .filter(
            Product.business_id == target_biz_id,
            func.lower(Product.name) == req.name.strip().lower(),
        )
        .first()
    )
    if existing_prod:
        return {
            "id": existing_prod.id,
            "name": existing_prod.name,
            "business_id": existing_prod.business_id,
            "local_price": existing_prod.local_price,
            "message": "Product already listed in your inventory. Retrieved existing listing idempotently.",
            "is_duplicate": True,
        }

    prod = Product(
        business_id=target_biz_id,
        name=req.name.strip(),
        brand=req.brand.strip() if req.brand else None,
        model_variant=req.model_variant.strip() if req.model_variant else None,
        category=req.category.strip(),
        description=req.description.strip() if req.description else None,
        local_price=req.local_price,
        mrp=req.mrp,
        online_price=req.online_price,
        online_provider=req.online_provider,
        online_url=req.online_url,
        availability_status=req.availability_status,
        stock_quantity=req.stock_quantity,
        image_url=req.image_url or req.image,
        price_updated_at=datetime.datetime.utcnow(),
        is_featured=req.is_featured,
    )
    db.add(prod)
    db.commit()
    db.refresh(prod)

    return {
        "success": True,
        "message": f"Product '{prod.name}' added to {business.name} catalogue",
        "product_id": prod.id,
    }


@router.put("/{product_id}")
def update_product(
    product_id: int,
    req: ProductUpdateRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    prod = db.query(Product).filter(Product.id == product_id).first()
    if not prod:
        raise HTTPException(status_code=404, detail="Product not found")

    if user.role != "admin" and prod.business.owner_id != user.id:
        raise HTTPException(status_code=403, detail="Not authorized to edit this product")

    if req.name is not None:
        prod.name = req.name.strip()
    if req.brand is not None:
        prod.brand = req.brand.strip()
    if req.model_variant is not None:
        prod.model_variant = req.model_variant.strip()
    if req.category is not None:
        prod.category = req.category.strip()
    if req.description is not None:
        prod.description = req.description.strip()
    if req.local_price is not None:
        prod.local_price = req.local_price
        prod.price_updated_at = datetime.datetime.utcnow()
    if req.mrp is not None:
        prod.mrp = req.mrp
    if req.online_price is not None:
        prod.online_price = req.online_price
    if req.online_provider is not None:
        prod.online_provider = req.online_provider
    if req.online_url is not None:
        prod.online_url = req.online_url
    if req.availability_status is not None:
        prod.availability_status = req.availability_status
    if req.stock_quantity is not None:
        prod.stock_quantity = req.stock_quantity
    if req.image_url is not None or req.image is not None:
        prod.image_url = req.image_url or req.image
    if req.is_featured is not None:
        prod.is_featured = req.is_featured

    db.commit()
    db.refresh(prod)
    return {
        "success": True,
        "message": "Product updated successfully",
        "product": {
            "id": prod.id,
            "name": prod.name,
            "category": prod.category,
            "local_price": prod.local_price,
            "mrp": prod.mrp,
            "availability_status": prod.availability_status,
            "description": prod.description,
            "image_url": prod.image_url,
        },
    }


@router.post("/upload-image")
@router.post("/upload")
async def upload_product_media(
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Uploads a product photo, bill snapshot, or shelf inventory image.
    Supports native camera capture and file uploads, persisting to S3/Cloud or static storage.
    """
    try:
        file_bytes = await file.read()
        if not file_bytes:
            raise HTTPException(status_code=400, detail="Uploaded file is empty.")

        user_biz = db.query(Business).filter(Business.owner_id == user.id).first()
        biz_id = user_biz.id if user_biz else None

        content_type = file.content_type or "image/jpeg"
        res = await save_merchant_media(
            file_bytes=file_bytes,
            original_filename=file.filename or "product.jpg",
            content_type=content_type,
            merchant_id=biz_id,
        )
        return res
    except HTTPException:
        raise
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        logger.exception(f"[products_upload] Failed to process media: {e}")
        raise HTTPException(status_code=500, detail="Failed to store uploaded media file.")


@router.delete("/{product_id}")
def delete_product(
    product_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    prod = db.query(Product).filter(Product.id == product_id).first()
    if not prod:
        raise HTTPException(status_code=404, detail="Product not found")

    if user.role != "admin" and prod.business.owner_id != user.id:
        raise HTTPException(status_code=403, detail="Not authorized to delete this product")

    db.delete(prod)
    db.commit()
    return {"success": True, "message": "Product deleted from catalogue"}


@router.get("/barcode/{barcode}", response_model=Dict[str, Any])
async def lookup_product_by_barcode(
    barcode: str,
    db: Session = Depends(get_db),
):
    """
    Looks up packaged product details (name, brand, category, image)
    by barcode via Open Food Facts (ODbL open database).
    Includes merchant availability notes.
    """
    from backend.app.integrations.products.open_food_facts import open_food_facts_client

    clean_code = barcode.strip()
    local_prod = (
        db.query(Product)
        .filter(or_(Product.name.ilike(f"%{clean_code}%"), Product.description.ilike(f"%{clean_code}%")))
        .first()
    )

    open_data = await open_food_facts_client.lookup_barcode(clean_code)

    if not open_data and not local_prod:
        raise HTTPException(
            status_code=404,
            detail=f"Barcode '{clean_code}' not found in Open Food Facts or local merchant listings.",
        )

    return {
        "success": True,
        "barcode": clean_code,
        "product": open_data or {
            "name": local_prod.name,
            "brand": local_prod.brand or "Local Merchant",
            "category": local_prod.category,
            "image_url": local_prod.image_url or local_prod.image,
            "source": "Local Merchant Database",
            "local_price": local_prod.local_price,
            "availability_status": local_prod.availability_status,
        },
        "has_local_seller": bool(local_prod),
        "local_seller": (
            {
                "business_id": local_prod.business_id,
                "business_name": local_prod.business.name if local_prod.business else None,
                "local_price": local_prod.local_price,
                "mrp": local_prod.mrp,
                "availability": local_prod.availability_status,
            }
            if local_prod
            else None
        ),
        "attribution": "Open Food Facts (ODbL) & MyArea24 Local Merchant Network",
    }


@router.get("/search-open-catalog", response_model=Dict[str, Any])
async def search_open_catalog(
    q: str = Query(..., min_length=2, description="Search term for packaged FMCG goods"),
    limit: int = Query(10, ge=1, le=25),
):
    """
    Searches packaged goods catalog across Open Food Facts to assist merchants in adding products
    and customers in finding packaged FMCG items.
    """
    from backend.app.integrations.products.open_food_facts import open_food_facts_client

    results = await open_food_facts_client.search_packaged_products(q, limit=limit)
    return {
        "query": q,
        "count": len(results),
        "results": results,
        "attribution": "Open Food Facts (ODbL Open Database)",
    }

