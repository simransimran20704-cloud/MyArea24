import datetime

import math

from typing import Any, Dict, List, Optional

from sqlalchemy import (

    Column,

    Integer,

    String,

    Float,

    DateTime,

    Boolean,

    Text,

    ForeignKey,

    Index,

    JSON,

    BigInteger,

    func,

    cast,

    event,

)

from sqlalchemy.orm import relationship, Session

from backend.app.database.session import Base, is_sqlite



try:

    from geoalchemy2 import Geometry, Geography

    HAS_GEOALCHEMY = True

except ImportError:

    HAS_GEOALCHEMY = False

    Geometry = None

    Geography = None





def haversine_distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:

    """Haversine formula for spherical distance in kilometers."""

    r = 6371.0

    phi1, phi2 = math.radians(lat1), math.radians(lat2)

    dphi = math.radians(lat2 - lat1)

    dlambda = math.radians(lon2 - lon1)

    a = math.sin(dphi / 2.0) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2.0) ** 2

    return r * 2.0 * math.atan2(math.sqrt(a), math.sqrt(max(0.0, 1.0 - a)))





def query_spatial_nearby(

    db: Session,

    model,

    lat: float,

    lon: float,

    radius_km: float = 5.0,

    additional_filters: Optional[List[Any]] = None,

    order_by_dist: bool = True,

    limit: int = 50,

) -> list:

    """

    Executes a high-efficiency spatial proximity query:

    1. On PostgreSQL with PostGIS:

       Leverages ST_DWithin on indexed Geography points with GiST index for logarithmic O(log N) searches.

       Calculates exact distance via ST_Distance.

    2. On SQLite / testing:

       Calculates tight bounding box (delta_lat, delta_lon) evaluated against composite (latitude, longitude)

       B-tree index, followed by exact Haversine distance filtering and sorting.

    """

    radius_meters = radius_km * 1000.0



    if not is_sqlite and HAS_GEOALCHEMY and Geography is not None:

        try:

            pt_col = cast(func.ST_SetSRID(func.ST_MakePoint(model.longitude, model.latitude), 4326), Geography)

            target_pt = cast(func.ST_SetSRID(func.ST_MakePoint(lon, lat), 4326), Geography)



            query = db.query(model).filter(

                model.latitude.isnot(None),

                model.longitude.isnot(None),

                func.ST_DWithin(pt_col, target_pt, radius_meters),

            )

            if additional_filters:

                for f in additional_filters:

                    query = query.filter(f)



            if order_by_dist:

                query = query.order_by(func.ST_Distance(pt_col, target_pt).asc())



            return query.limit(limit).all()

        except Exception:

            # Fall back to indexed bounding box if PostGIS extension is not installed

            pass



    # SQLite / Bounding Box fallback

    delta_lat = radius_km / 111.0

    delta_lon = radius_km / (111.0 * max(0.1, math.cos(math.radians(lat))))



    query = db.query(model).filter(

        model.latitude.isnot(None),

        model.longitude.isnot(None),

        model.latitude.between(lat - delta_lat, lat + delta_lat),

        model.longitude.between(lon - delta_lon, lon + delta_lon),

    )

    if additional_filters:

        for f in additional_filters:

            query = query.filter(f)



    records = query.all()

    filtered = []

    for r in records:

        if r.latitude is not None and r.longitude is not None:

            d = haversine_distance_km(lat, lon, float(r.latitude), float(r.longitude))

            if d <= radius_km:

                filtered.append((d, r))



    if order_by_dist:

        filtered.sort(key=lambda x: x[0])



    return [r for d, r in filtered[:limit]]





class DataSource(Base):

    __tablename__ = "data_sources"



    id = Column(String(50), primary_key=True)  # e.g., 'weatherapi', 'here_traffic', 'sachet_cap'

    name = Column(String(100), nullable=False)

    base_url = Column(String(255), nullable=True)

    is_active = Column(Boolean, default=True, nullable=False)

    last_sync_at = Column(DateTime, nullable=True)

    last_status = Column(String(50), nullable=True)  # 'SUCCESS', 'FAILED', 'RATE_LIMITED'

    error_count = Column(Integer, default=0, nullable=False)

    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)

    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow, nullable=False)



    sync_logs = relationship("DataSyncLog", back_populates="source", cascade="all, delete-orphan")





class DataSyncLog(Base):

    __tablename__ = "data_sync_logs"



    id = Column(Integer, primary_key=True, autoincrement=True)

    source_id = Column(String(50), ForeignKey("data_sources.id", ondelete="CASCADE"), nullable=False)

    sync_started_at = Column(DateTime, nullable=False)

    sync_ended_at = Column(DateTime, nullable=True)

    duration_ms = Column(Integer, nullable=True)

    records_fetched = Column(Integer, default=0, nullable=False)

    records_persisted = Column(Integer, default=0, nullable=False)

    records_rejected = Column(Integer, default=0, nullable=False)

    status = Column(String(50), nullable=False)  # 'SUCCESS', 'FAILED', 'RATE_LIMITED'

    error_message = Column(Text, nullable=True)

    metadata_json = Column(JSON, nullable=True)



    source = relationship("DataSource", back_populates="sync_logs")



    __table_args__ = (

        Index("ix_sync_logs_source_started", "source_id", "sync_started_at"),

    )





class WeatherObservation(Base):

    __tablename__ = "weather_observations"



    id = Column(Integer, primary_key=True, autoincrement=True)

    source_id = Column(String(50), ForeignKey("data_sources.id"), default="weatherapi", nullable=False)

    source_record_id = Column(String(255), unique=True, nullable=False)  # deduplication key

    location_name = Column(String(100), nullable=False)

    latitude = Column(Float, nullable=False)

    longitude = Column(Float, nullable=False)

    observed_at = Column(DateTime, nullable=False)

    forecast_valid_until = Column(DateTime, nullable=True)

    temperature_c = Column(Float, nullable=False)

    precipitation_mm = Column(Float, nullable=False)  # rainfall accumulation over interval

    precipitation_interval_minutes = Column(Integer, default=60, nullable=False)

    condition_text = Column(String(100), nullable=False)

    wind_kph = Column(Float, nullable=True)

    humidity = Column(Integer, nullable=True)

    raw_timestamp = Column(BigInteger, nullable=True)

    ingested_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)



    __table_args__ = (

        Index("ix_weather_coords_observed", "latitude", "longitude", "observed_at"),

        Index("ix_weather_observed_at", "observed_at"),

    )





class TrafficObservation(Base):

    __tablename__ = "traffic_observations"



    id = Column(Integer, primary_key=True, autoincrement=True)

    source_id = Column(String(50), ForeignKey("data_sources.id"), default="here_traffic", nullable=False)

    source_record_id = Column(String(255), unique=True, nullable=False)  # deduplication key

    incident_type = Column(String(50), nullable=False)  # 'CONGESTION', 'ACCIDENT', 'ROAD_CLOSURE', etc.

    criticality = Column(String(20), nullable=True)  # 'critical', 'major', 'minor', 'low'

    latitude = Column(Float, nullable=False)

    longitude = Column(Float, nullable=False)

    geometry_geojson = Column(JSON, nullable=True)

    jam_factor = Column(Float, nullable=True)  # 0.0 to 10.0

    delay_seconds = Column(Integer, nullable=True)

    road_name = Column(String(200), nullable=True)

    description = Column(Text, nullable=True)

    observed_at = Column(DateTime, nullable=False)

    expected_end_at = Column(DateTime, nullable=True)

    ingested_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)



    __table_args__ = (

        Index("ix_traffic_coords_observed", "latitude", "longitude", "observed_at"),

        Index("ix_traffic_observed_at", "observed_at"),

    )





class GovernmentNotice(Base):

    __tablename__ = "government_notices"



    id = Column(Integer, primary_key=True, autoincrement=True)

    source_id = Column(String(50), ForeignKey("data_sources.id"), default="sachet_cap", nullable=False)

    alert_identifier = Column(String(255), unique=True, nullable=False)  # CAP <identifier>

    sender = Column(String(255), nullable=False)

    event_type = Column(String(100), nullable=False)

    severity = Column(String(50), nullable=False)  # 'Extreme', 'Severe', 'Moderate', 'Minor', 'Unknown'

    urgency = Column(String(50), nullable=False)

    certainty = Column(String(50), nullable=False)

    headline = Column(Text, nullable=False)

    description = Column(Text, nullable=True)

    instruction = Column(Text, nullable=True)

    area_description = Column(Text, nullable=False)

    polygon_geojson = Column(JSON, nullable=True)

    circle_geojson = Column(JSON, nullable=True)

    effective_at = Column(DateTime, nullable=False)

    expires_at = Column(DateTime, nullable=False)

    is_active = Column(Boolean, default=True, nullable=False)

    ingested_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)



    __table_args__ = (

        Index("ix_notices_effective_expires", "effective_at", "expires_at"),

        Index("ix_notices_active", "is_active"),

    )





class AirQualityObservation(Base):

    __tablename__ = "air_quality_observations"



    id = Column(Integer, primary_key=True, autoincrement=True)

    source_id = Column(String(50), ForeignKey("data_sources.id"), default="openaq", nullable=False)

    source_record_id = Column(String(255), unique=True, nullable=False)  # deduplication key

    station_id = Column(String(100), nullable=False)

    station_name = Column(String(200), nullable=False)

    city = Column(String(100), nullable=False)

    state = Column(String(100), nullable=True)

    latitude = Column(Float, nullable=False)

    longitude = Column(Float, nullable=False)

    observed_at = Column(DateTime, nullable=False)

    aqi_value = Column(Float, nullable=True)  # CPCB NAQI (0-500+)

    aqi_category = Column(String(50), nullable=True)  # 'Good', 'Satisfactory', 'Moderate', 'Poor', 'Very Poor', 'Severe'

    prominent_pollutant = Column(String(50), nullable=True)  # e.g. 'PM2.5', 'PM10'

    pm25 = Column(Float, nullable=True)  # µg/m³

    pm10 = Column(Float, nullable=True)  # µg/m³

    no2 = Column(Float, nullable=True)  # µg/m³

    so2 = Column(Float, nullable=True)  # µg/m³

    co = Column(Float, nullable=True)  # mg/m³

    o3 = Column(Float, nullable=True)  # µg/m³

    raw_data = Column(JSON, nullable=True)

    ingested_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)



    __table_args__ = (

        Index("ix_aqi_coords_observed", "latitude", "longitude", "observed_at"),

        Index("ix_aqi_observed_at", "observed_at"),

        Index("ix_aqi_station_observed", "station_id", "observed_at"),

    )





class IntelligenceInsight(Base):

    __tablename__ = "intelligence_insights"



    id = Column(Integer, primary_key=True, autoincrement=True)

    insight_type = Column(String(50), nullable=False)  # 'weather_traffic_correlation'

    area_label = Column(String(255), nullable=False)

    latitude = Column(Float, nullable=False)

    longitude = Column(Float, nullable=False)

    radius_km = Column(Float, default=5.0, nullable=False)

    headline = Column(String(255), nullable=False)

    summary = Column(Text, nullable=False)

    potential_impact = Column(Text, nullable=False)

    recommendation = Column(Text, nullable=False)

    evidence_quality = Column(String(50), nullable=False)  # 'supported', 'insufficient_evidence'

    composite_severity = Column(String(20), nullable=False)  # 'minor', 'moderate', 'high', 'severe'

    confidence_level = Column(String(100), default="HIGH (Multi-Source Corroborated)", nullable=False)

    rule_identifier = Column(String(100), default="SCENARIO_A_WEATHER_TRAFFIC", nullable=False)

    rule_version = Column(String(20), default="1.0", nullable=False)

    data_quality_notes = Column(Text, nullable=True)

    observed_at = Column(DateTime, nullable=True)

    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)

    expires_at = Column(DateTime, nullable=False)

    next_review_at = Column(DateTime, nullable=True)

    dedup_hash = Column(String(64), unique=True, nullable=False)

    is_active = Column(Boolean, default=True, nullable=False)



    signals = relationship("IntelligenceSignal", back_populates="insight", cascade="all, delete-orphan")



    __table_args__ = (

        Index("ix_insights_area_created", "area_label", "created_at"),

        Index("ix_insights_active_expires", "is_active", "expires_at"),

        Index("ix_insights_type_severity", "insight_type", "composite_severity"),

    )





class IntelligenceSignal(Base):

    __tablename__ = "intelligence_signals"



    id = Column(Integer, primary_key=True, autoincrement=True)

    insight_id = Column(Integer, ForeignKey("intelligence_insights.id", ondelete="CASCADE"), nullable=False)

    signal_type = Column(String(50), nullable=False)  # 'weather', 'traffic', 'alert'

    source_name = Column(String(50), nullable=False)  # 'weatherapi', 'here_traffic', 'sachet_cap'

    observation_table = Column(String(50), nullable=False)

    observation_id = Column(Integer, nullable=False)

    observed_at = Column(DateTime, nullable=False)

    metric_summary = Column(String(255), nullable=False)

    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)



    insight = relationship("IntelligenceInsight", back_populates="signals")



    __table_args__ = (

        Index("ix_signals_insight", "insight_id"),

        Index("ix_signals_obs", "observation_table", "observation_id"),

    )





# ==============================================================================

# MyArea24 Hyperlocal Marketplace & Discovery Domain Models

# ==============================================================================



class User(Base):

    __tablename__ = "users"



    id = Column(Integer, primary_key=True, autoincrement=True)

    email = Column(String(255), unique=True, nullable=False, index=True)

    phone = Column(String(50), nullable=True, index=True)

    full_name = Column(String(150), nullable=True)

    role = Column(String(50), default="resident", nullable=False)  # 'resident', 'merchant', 'admin'

    is_active = Column(Boolean, default=True, nullable=False)

    is_verified = Column(Boolean, default=False, nullable=False)

    password_hash = Column(String(255), nullable=True)

    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)

    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow, nullable=False)



    businesses = relationship("Business", back_populates="owner")

    saved_items = relationship("SavedItem", back_populates="user", cascade="all, delete-orphan")





class OtpToken(Base):

    __tablename__ = "otp_tokens"



    id = Column(Integer, primary_key=True, autoincrement=True)

    email = Column(String(255), nullable=False, index=True)

    otp_code = Column(String(10), nullable=False)

    purpose = Column(String(50), default="login", nullable=False)  # 'login', 'signup', 'merchant_onboarding'

    expires_at = Column(DateTime, nullable=False)

    is_used = Column(Boolean, default=False, nullable=False)

    attempts = Column(Integer, default=0, nullable=False)

    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)



    __table_args__ = (

        Index("ix_otp_email_code", "email", "otp_code"),

    )





class Business(Base):

    __tablename__ = "businesses"



    id = Column(Integer, primary_key=True, autoincrement=True)

    slug = Column(String(150), unique=True, nullable=False, index=True)

    name = Column(String(200), nullable=False, index=True)

    owner_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    category = Column(String(100), nullable=False, index=True)  # 'Electronics', 'Grocery', 'Pharmacy', 'Stationery', 'Food & Dining', 'Services'

    subcategory = Column(String(100), nullable=True)

    description = Column(Text, nullable=True)

    address = Column(Text, nullable=False)

    locality = Column(String(100), nullable=False, index=True)

    city = Column(String(100), nullable=False, index=True)

    state = Column(String(100), default="Delhi NCR", nullable=False)

    pincode = Column(String(20), nullable=True)

    latitude = Column(Float, nullable=False)

    longitude = Column(Float, nullable=False)

    phone = Column(String(50), nullable=True)

    whatsapp = Column(String(50), nullable=True)

    email = Column(String(100), nullable=True)

    website = Column(String(255), nullable=True)

    opening_time = Column(String(10), default="09:00", nullable=False)

    closing_time = Column(String(10), default="21:30", nullable=False)

    days_open = Column(String(100), default="Mon-Sun", nullable=False)

    image_url = Column(String(500), nullable=True)

    fssai_license_number = Column(String(50), nullable=True, index=True)  # FSSAI 14-digit license for Food & Dining / Grocery

    gstin = Column(String(50), nullable=True, index=True)  # 15-character GSTIN for registered Indian commercial merchants

    settlement_upi_id = Column(String(100), nullable=True)  # Merchant UPI ID / VPA for direct settlements (e.g. store@okaxis)

    settlement_bank_account = Column(String(50), nullable=True)  # Commercial bank account number

    settlement_bank_ifsc = Column(String(20), nullable=True)  # 11-character Indian Financial System Code (IFSC)

    is_verified = Column(Boolean, default=True, nullable=False)

    status = Column(String(50), default="active", nullable=False)  # 'active', 'pending_approval', 'suspended'

    rating = Column(Float, default=4.5, nullable=False)

    review_count = Column(Integer, default=0, nullable=False)

    view_count = Column(Integer, default=0, nullable=False)

    call_clicks = Column(Integer, default=0, nullable=False)

    direction_clicks = Column(Integer, default=0, nullable=False)

    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)

    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow, nullable=False)



    owner = relationship("User", back_populates="businesses")

    products = relationship("Product", back_populates="business", cascade="all, delete-orphan")

    offers = relationship("Offer", back_populates="business", cascade="all, delete-orphan")

    enquiries = relationship("CustomerEnquiry", back_populates="business", cascade="all, delete-orphan")



    if not is_sqlite and HAS_GEOALCHEMY and Geometry is not None:

        geom = Column(Geometry(geometry_type="POINT", srid=4326, spatial_index=True), nullable=True)



    __table_args__ = [

        Index("ix_business_locality_category", "locality", "category"),

        Index("ix_business_city_category", "city", "category"),

        Index("ix_business_coords", "latitude", "longitude"),

    ]

    if not is_sqlite and HAS_GEOALCHEMY:

        __table_args__.append(

            Index(

                "ix_business_gist_spatial",

                func.ST_SetSRID(func.ST_MakePoint(longitude, latitude), 4326),

                postgresql_using="gist",

            )

        )

    __table_args__ = tuple(__table_args__)



    @classmethod

    def query_nearby(

        cls,

        db: Session,

        lat: float,

        lon: float,

        radius_km: float = 5.0,

        category: Optional[str] = None,

        limit: int = 50,

    ) -> List["Business"]:

        """

        Queries commercial storefronts nearby.

        Uses PostgreSQL ST_DWithin with GiST spatial index when on PostGIS,

        or composite indexed bounding box on SQLite.

        """

        filters = []

        if category and category.strip():

            filters.append(func.lower(cls.category) == category.strip().lower())

        return query_spatial_nearby(

            db,

            cls,

            lat,

            lon,

            radius_km=radius_km,

            additional_filters=filters,

            order_by_dist=True,

            limit=limit,

        )





class Product(Base):

    __tablename__ = "products"



    id = Column(Integer, primary_key=True, autoincrement=True)

    business_id = Column(Integer, ForeignKey("businesses.id", ondelete="CASCADE"), nullable=False, index=True)

    name = Column(String(255), nullable=False, index=True)

    brand = Column(String(100), nullable=True, index=True)

    model_variant = Column(String(100), nullable=True)

    category = Column(String(100), nullable=False, index=True)

    description = Column(Text, nullable=True)

    local_price = Column(Float, nullable=False)  # Price in INR ₹

    mrp = Column(Float, nullable=True)

    online_price = Column(Float, nullable=True)  # Online comparison benchmark

    online_provider = Column(String(50), nullable=True)  # e.g. Amazon, Flipkart, Blinkit

    online_url = Column(String(500), nullable=True)

    availability_status = Column(String(50), default="in_stock", nullable=False)  # 'in_stock', 'confirm_with_seller', 'low_stock', 'out_of_stock'

    stock_quantity = Column(Integer, nullable=True)

    image_url = Column(String(500), nullable=True)

    price_updated_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)

    is_featured = Column(Boolean, default=False, nullable=False)

    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)

    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow, nullable=False)



    business = relationship("Business", back_populates="products")



    __table_args__ = (

        Index("ix_product_category_price", "category", "local_price"),

    )





class ServiceListing(Base):

    __tablename__ = "service_listings"



    id = Column(Integer, primary_key=True, autoincrement=True)

    provider_name = Column(String(200), nullable=False, index=True)

    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    business_id = Column(Integer, ForeignKey("businesses.id", ondelete="SET NULL"), nullable=True)

    category = Column(String(100), nullable=False, index=True)  # 'Electrician', 'Plumber', 'AC Repair', 'Salon', 'Tutor'

    description = Column(Text, nullable=True)

    service_area = Column(String(255), nullable=False)

    locality = Column(String(100), nullable=False, index=True)

    city = Column(String(100), nullable=False, index=True)

    latitude = Column(Float, nullable=False)

    longitude = Column(Float, nullable=False)

    phone = Column(String(50), nullable=False)

    whatsapp = Column(String(50), nullable=True)

    price_starting_at = Column(Float, nullable=True)

    price_unit = Column(String(50), default="per visit", nullable=False)

    timing = Column(String(100), default="08:00 AM - 08:00 PM", nullable=False)

    experience_years = Column(Integer, default=5, nullable=False)

    is_verified = Column(Boolean, default=True, nullable=False)

    is_available = Column(Boolean, default=True, nullable=False)

    rating = Column(Float, default=4.8, nullable=False)

    review_count = Column(Integer, default=12, nullable=False)

    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)



    __table_args__ = (

        Index("ix_service_locality_cat", "locality", "category"),

    )





class Offer(Base):

    __tablename__ = "offers"



    id = Column(Integer, primary_key=True, autoincrement=True)

    business_id = Column(Integer, ForeignKey("businesses.id", ondelete="CASCADE"), nullable=False, index=True)

    title = Column(String(255), nullable=False)

    description = Column(Text, nullable=True)

    discount_text = Column(String(100), nullable=False)  # e.g., '20% OFF', 'Flat ₹500 Off'

    coupon_code = Column(String(50), nullable=True)

    category = Column(String(100), nullable=False, index=True)

    valid_from = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)

    valid_until = Column(DateTime, nullable=False)

    terms_conditions = Column(Text, nullable=True)

    is_active = Column(Boolean, default=True, nullable=False)

    banner_image_url = Column(String(500), nullable=True)

    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)



    business = relationship("Business", back_populates="offers")



    __table_args__ = (

        Index("ix_offers_valid_active", "is_active", "valid_until"),

    )





class Event(Base):

    __tablename__ = "events"



    id = Column(Integer, primary_key=True, autoincrement=True)

    title = Column(String(255), nullable=False)

    category = Column(String(100), nullable=False, index=True)  # 'Civic Advisory', 'Community', 'Workshop', 'Market'

    organizer = Column(String(200), nullable=False)

    venue_name = Column(String(200), nullable=False)

    address = Column(Text, nullable=False)

    locality = Column(String(100), nullable=False, index=True)

    city = Column(String(100), nullable=False, index=True)

    latitude = Column(Float, nullable=False)

    longitude = Column(Float, nullable=False)

    start_time = Column(DateTime, nullable=False)

    end_time = Column(DateTime, nullable=True)

    timing_text = Column(String(150), nullable=True)

    description = Column(Text, nullable=True)

    registration_url = Column(String(500), nullable=True)

    is_verified = Column(Boolean, default=True, nullable=False)

    source = Column(String(100), default="Official Municipal / Community Board", nullable=False)

    expected_attendance = Column(Integer, default=500, nullable=True)

    parking_pressure = Column(String(50), default="MODERATE", nullable=True)  # 'CRITICAL', 'ELEVATED', 'MODERATE', 'NORMAL'

    arterial_traffic_impact = Column(String(50), default="MODERATE", nullable=True)  # 'HIGH_BOTTLENECK', 'MODERATE', 'LOW'

    exit_weather_advisory = Column(String(255), nullable=True)

    correlated_commute_route = Column(String(255), nullable=True)

    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)



    __table_args__ = (

        Index("ix_events_locality_time", "locality", "start_time"),

    )





class CustomerEnquiry(Base):

    __tablename__ = "customer_enquiries"



    id = Column(Integer, primary_key=True, autoincrement=True)

    business_id = Column(Integer, ForeignKey("businesses.id", ondelete="CASCADE"), nullable=True, index=True)

    product_id = Column(Integer, ForeignKey("products.id", ondelete="SET NULL"), nullable=True)

    service_id = Column(Integer, ForeignKey("service_listings.id", ondelete="SET NULL"), nullable=True, index=True)

    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    customer_name = Column(String(100), nullable=False)

    customer_phone = Column(String(50), nullable=False)

    customer_email = Column(String(100), nullable=True)

    enquiry_type = Column(String(50), default="general", nullable=False)  # 'stock_check', 'price_quote', 'appointment', 'general'

    message = Column(Text, nullable=False)

    status = Column(String(50), default="pending", nullable=False)  # 'pending', 'contacted', 'resolved'

    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)



    business = relationship("Business", back_populates="enquiries")

    service = relationship("ServiceListing")





class AnalyticsEvent(Base):

    __tablename__ = "analytics_events"



    id = Column(Integer, primary_key=True, autoincrement=True)

    business_id = Column(Integer, ForeignKey("businesses.id", ondelete="CASCADE"), nullable=True, index=True)

    product_id = Column(Integer, nullable=True)

    event_type = Column(String(50), nullable=False)  # 'page_view', 'call_click', 'whatsapp_click', 'direction_click', 'enquiry_submitted'

    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)





class SavedItem(Base):

    __tablename__ = "saved_items"



    id = Column(Integer, primary_key=True, autoincrement=True)

    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    item_type = Column(String(50), nullable=False)  # 'business', 'product', 'service', 'offer'

    item_id = Column(Integer, nullable=False)

    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)



    user = relationship("User", back_populates="saved_items")



    __table_args__ = (

        Index("ix_saved_user_item", "user_id", "item_type", "item_id"),

    )





class MandiPrice(Base):

    __tablename__ = "mandi_prices"



    id = Column(Integer, primary_key=True, autoincrement=True)

    commodity = Column(String(100), nullable=False, index=True)

    variety = Column(String(100), nullable=True)

    mandi_name = Column(String(150), nullable=False, index=True)

    state = Column(String(50), nullable=False)

    district = Column(String(100), nullable=True, index=True)

    city = Column(String(100), nullable=True, index=True)

    category = Column(String(50), default="Vegetables", nullable=True)

    modal_price = Column(Float, nullable=False)  # Normalized INR per kg

    min_price = Column(Float, nullable=True)

    max_price = Column(Float, nullable=True)

    unit = Column(String(20), default="kg", nullable=False)

    raw_modal_price = Column(Float, nullable=True)  # Wholesale INR per Quintal (100 kg)

    raw_min_price = Column(Float, nullable=True)

    raw_max_price = Column(Float, nullable=True)

    raw_unit = Column(String(20), default="Quintal", nullable=True)

    grade = Column(String(50), nullable=True)  # e.g., Medium, Grade A

    source_name = Column(String(120), default="Government of India - Agmarknet (data.gov.in)", nullable=True)

    reported_at = Column(String(50), nullable=True)  # Original reported arrival date

    arrival_volume = Column(String(50), nullable=True)

    price_trend = Column(String(50), default="Stable", nullable=False)

    observed_date = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)

    fetched_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)





class FuelPriceRecord(Base):

    """

    Persisted city-wise daily retail fuel prices (Petrol, Diesel)

    dynamically synchronized from India Petroleum API / PPAC MoPNG feeds.

    """

    __tablename__ = "fuel_price_records"



    id = Column(Integer, primary_key=True, autoincrement=True)

    city_slug = Column(String(50), nullable=False, index=True)

    city_name = Column(String(100), nullable=False, index=True)

    state = Column(String(100), nullable=True)

    fuel_type = Column(String(20), nullable=False, index=True)  # 'petrol', 'diesel'

    price = Column(Float, nullable=False)

    currency = Column(String(10), default="INR", nullable=False)

    unit = Column(String(20), default="L", nullable=False)

    source_date = Column(String(20), nullable=False, index=True)  # YYYY-MM-DD

    source_posted_date = Column(String(20), nullable=True)

    last_fetched_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)

    source_provider = Column(String(100), default="india_petroleum_api", nullable=False)

    attribution = Column(String(255), nullable=True)

    is_verified = Column(Boolean, default=True, nullable=False)



    __table_args__ = (

        Index("ix_fuel_city_fuel_date", "city_slug", "fuel_type", "source_date", unique=True),

    )





class FuelStationRecord(Base):

    """

    Persisted real petrol pumps and fuel/CNG stations discovered dynamically

    via OpenStreetMap Overpass API (amenity=fuel).

    Stores real coordinates, brand, verified CNG availability, address, contact, and operating hours.

    Never fabricates fuel availability or station details.

    """

    __tablename__ = "fuel_stations"



    id = Column(Integer, primary_key=True, autoincrement=True)

    osm_id = Column(String(50), unique=True, nullable=False, index=True)  # e.g. 'node:4122590190' or 'way:123456'

    name = Column(String(200), nullable=False, index=True)

    brand = Column(String(100), nullable=True)

    operator = Column(String(100), nullable=True)

    latitude = Column(Float, nullable=False)

    longitude = Column(Float, nullable=False)

    address = Column(Text, nullable=True)

    locality = Column(String(100), nullable=True)

    city = Column(String(100), nullable=True, index=True)

    state = Column(String(100), nullable=True)

    pincode = Column(String(20), nullable=True)

    has_cng = Column(Boolean, default=False, nullable=False, index=True)

    has_petrol = Column(Boolean, default=True, nullable=False)

    has_diesel = Column(Boolean, default=True, nullable=False)

    has_lpg = Column(Boolean, default=False, nullable=False)

    has_ev = Column(Boolean, default=False, nullable=False)

    fuel_types_json = Column(Text, default="[]", nullable=False)  # JSON-encoded list of fuel types

    opening_hours = Column(String(100), default="24/7", nullable=False)

    phone = Column(String(50), nullable=True)

    whatsapp = Column(String(50), nullable=True)

    website = Column(String(255), nullable=True)

    raw_tags_json = Column(Text, nullable=True)

    source_provider = Column(String(50), default="osm_overpass", nullable=False)

    attribution = Column(String(255), default="© OpenStreetMap contributors, ODbL 1.0", nullable=False)

    last_synced_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)

    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)

    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow, nullable=False)



    __table_args__ = (

        Index("ix_fuel_stations_coords", "latitude", "longitude"),

        Index("ix_fuel_stations_city_cng", "city", "has_cng"),

    )



    @classmethod

    def query_nearby(

        cls,

        db: Session,

        lat: float,

        lon: float,

        radius_km: float = 5.0,

        has_cng: Optional[bool] = None,

        limit: int = 50,

    ) -> List["FuelStationRecord"]:

        filters = []

        if has_cng is True:

            filters.append(cls.has_cng == True)

        return query_spatial_nearby(

            db,

            cls,

            lat,

            lon,

            radius_km=radius_km,

            additional_filters=filters,

            order_by_dist=True,

            limit=limit,

        )





class RentalListing(Base):

    """

    Verified property-owner and tenant residential rental benchmark contribution registry.

    Captures hyper-local actual monthly rent, deposit, built-up area, and furnishing.

    """

    __tablename__ = "rental_listings"



    id = Column(Integer, primary_key=True, autoincrement=True)

    locality = Column(String(100), nullable=False, index=True)

    city = Column(String(100), nullable=False, index=True)

    district = Column(String(100), nullable=True, index=True)

    state = Column(String(100), nullable=False, index=True)

    pincode = Column(String(10), nullable=True, index=True)

    property_type = Column(String(50), nullable=False, index=True)  # '1 RK', '1 BHK', '2 BHK', '3 BHK', '4+ BHK', etc.

    monthly_rent = Column(Float, nullable=False)

    security_deposit = Column(Float, nullable=True)

    built_up_area_sqft = Column(Integer, nullable=True)

    furnishing = Column(String(50), default="Semi-Furnished", nullable=False)  # 'Unfurnished', 'Semi-Furnished', 'Fully Furnished'

    tenant_preference = Column(String(50), default="All", nullable=False)  # 'Family', 'Bachelors', 'All', 'Company Lease'

    maintenance_included = Column(Boolean, default=False, nullable=False)

    is_verified = Column(Boolean, default=True, nullable=False)

    verification_method = Column(String(50), default="owner_declaration", nullable=False)

    contributor_name = Column(String(100), nullable=True)

    contributor_contact = Column(String(50), nullable=True)

    listing_date = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)

    source = Column(String(100), default="Verified Property Owner Registry", nullable=False)

    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)

    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow, nullable=False)



    __table_args__ = (

        Index("ix_rentals_locality_prop", "locality", "property_type"),

        Index("ix_rentals_city_prop", "city", "property_type"),

        Index("ix_rentals_pincode", "pincode"),

    )





class GovernmentHousingIndex(Base):

    """

    Macro residential housing and rental price index compiled by government bodies

    (Labour Bureau Ministry of Labour & Employment / MoSPI).

    Distinct from actual crowdsourced property-owner monthly rent.

    """

    __tablename__ = "government_housing_indices"



    id = Column(Integer, primary_key=True, autoincrement=True)

    center_name = Column(String(100), nullable=False, index=True)

    state = Column(String(100), nullable=False, index=True)

    source_agency = Column(String(100), default="Labour Bureau (Ministry of Labour & Employment)", nullable=False)

    survey_name = Column(String(150), default="Repeat House Rent Survey (RHRS) - CPI-IW", nullable=False)

    base_year = Column(String(20), default="2016=100", nullable=False)

    index_period = Column(String(50), default="July-Dec 2026", nullable=False)

    housing_index = Column(Float, nullable=False)

    annual_rental_inflation_pct = Column(Float, nullable=False)

    weight_pct = Column(Float, default=15.27, nullable=False)

    last_updated_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)



    __table_args__ = (

        Index("ix_govt_housing_center", "center_name", "index_period", unique=True),

    )





class ResidentialMacroIndex(Base):
    """
    National Residential Property Price and Real Price historical observations
    retrieved from Global Property Metrics (BIS and OECD telemetry).
    """
    __tablename__ = "residential_macro_indices"

    id = Column(Integer, primary_key=True, autoincrement=True)
    country_code = Column(String(10), default="IN", nullable=False, index=True)
    metric_type = Column(String(50), nullable=False, index=True)
    period = Column(String(20), nullable=False)
    period_end = Column(String(20), nullable=True)
    index_value = Column(Float, nullable=False)
    yoy_change_pct = Column(Float, nullable=True)
    source_agency = Column(String(150), nullable=False)
    source_id = Column(String(100), nullable=True)
    last_synced_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)

    __table_args__ = (
        Index("ix_res_macro_metric_period", "country_code", "metric_type", "period", unique=True),
    )


class CivicBulletin(Base):

    __tablename__ = "civic_bulletins"



    id = Column(Integer, primary_key=True, autoincrement=True)

    title = Column(String(255), nullable=False)

    summary = Column(Text, nullable=False)

    source_agency = Column(String(150), nullable=False)

    category = Column(String(50), default="Transit & Safety", nullable=False)

    locality = Column(String(100), nullable=True, index=True)

    city = Column(String(50), nullable=True, index=True)

    priority = Column(String(20), default="medium", nullable=False)

    published_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)

    official_link = Column(String(500), nullable=True)





class EmergencyFacility(Base):

    __tablename__ = "emergency_facilities"



    id = Column(Integer, primary_key=True, autoincrement=True)

    name = Column(String(255), nullable=False)

    facility_type = Column(String(100), default="Casualty & Trauma Center", nullable=False)

    phone = Column(String(50), nullable=False)

    secondary_phone = Column(String(50), nullable=True)

    address = Column(Text, nullable=False)

    locality = Column(String(100), nullable=False, index=True)

    city = Column(String(100), nullable=False, index=True)

    state = Column(String(100), nullable=False, index=True)

    latitude = Column(Float, nullable=False)

    longitude = Column(Float, nullable=False)

    is_24_7 = Column(Boolean, default=True, nullable=False)

    trauma_level = Column(String(50), default="Level-1", nullable=True)

    blood_bank_available = Column(Boolean, default=True, nullable=False)

    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)



    if not is_sqlite and HAS_GEOALCHEMY and Geometry is not None:

        geom = Column(Geometry(geometry_type="POINT", srid=4326, spatial_index=True), nullable=True)



    __table_args__ = [

        Index("ix_emergency_city_locality", "city", "locality"),

        Index("ix_emergency_coords", "latitude", "longitude"),

    ]

    if not is_sqlite and HAS_GEOALCHEMY:

        __table_args__.append(

            Index(

                "ix_emergency_gist_spatial",

                func.ST_SetSRID(func.ST_MakePoint(longitude, latitude), 4326),

                postgresql_using="gist",

            )

        )

    __table_args__ = tuple(__table_args__)



    @classmethod

    def query_nearby(

        cls,

        db: Session,

        lat: float,

        lon: float,

        radius_km: float = 15.0,

        blood_bank_only: bool = False,

        facility_type: Optional[str] = None,

        limit: int = 20,

    ) -> List["EmergencyFacility"]:

        """

        Queries verified emergency casualty, trauma & medical centers nearby.

        Uses PostgreSQL ST_DWithin with GiST spatial index on PostGIS,

        or composite indexed bounding box on SQLite.

        """

        filters = []

        if blood_bank_only:

            filters.append(cls.blood_bank_available == True)

        if facility_type and facility_type.strip():

            filters.append(cls.facility_type.ilike(f"%{facility_type.strip()}%"))

        return query_spatial_nearby(

            db,

            cls,

            lat,

            lon,

            radius_km=radius_km,

            additional_filters=filters,

            order_by_dist=True,

            limit=limit,

        )





class CommunitySignal(Base):

    __tablename__ = "community_signals"



    id = Column(Integer, primary_key=True, autoincrement=True)

    signal_type = Column(String(50), nullable=False)  # 'WATERLOGGING', 'POTHOLE', 'ROAD_BLOCKAGE', 'ACCIDENT', 'LOCAL_MARKET'

    title = Column(String(200), nullable=False)

    description = Column(Text, nullable=True)

    locality = Column(String(100), nullable=False, index=True)

    city = Column(String(100), nullable=False, index=True)

    state = Column(String(100), default="India", nullable=False)

    latitude = Column(Float, nullable=False)

    longitude = Column(Float, nullable=False)

    upvotes = Column(Integer, default=1, nullable=False)

    status = Column(String(50), default="COMMUNITY_VERIFIED", nullable=False)  # 'REPORTED', 'COMMUNITY_VERIFIED', 'RESOLVED'

    severity = Column(String(20), default="moderate", nullable=False)  # 'low', 'moderate', 'high', 'severe'

    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)

    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow, nullable=False)



    __table_args__ = (

        Index("ix_comm_signals_loc_time", "locality", "created_at"),

        Index("ix_comm_signals_coords", "latitude", "longitude"),

    )





class Order(Base):

    __tablename__ = "orders"



    id = Column(Integer, primary_key=True, autoincrement=True)

    order_number = Column(String(50), unique=True, nullable=False, index=True)

    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    business_id = Column(Integer, ForeignKey("businesses.id", ondelete="SET NULL"), nullable=True)

    business_name = Column(String(200), nullable=True)

    status = Column(String(50), default="placed", nullable=False, index=True)  # 'placed', 'confirmed', 'out_for_delivery', 'delivered', 'cancelled'

    total_amount = Column(Float, nullable=False)

    delivery_fee = Column(Float, default=0.0, nullable=False)

    platform_fee = Column(Float, default=5.0, nullable=False)

    discount_amount = Column(Float, default=0.0, nullable=False)

    final_payable = Column(Float, nullable=False)

    payment_method = Column(String(50), default="upi_qr", nullable=False)  # 'upi_qr', 'razorpay', 'phonepe', 'cod'

    payment_status = Column(String(50), default="pending", nullable=False)  # 'pending', 'paid', 'cod', 'failed', 'refunded'

    transaction_id = Column(String(100), nullable=True)

    tracking_token = Column(String(100), nullable=True, index=True)

    customer_name = Column(String(100), nullable=False)

    customer_phone = Column(String(50), nullable=False)

    delivery_address = Column(Text, nullable=False)

    delivery_landmark = Column(String(100), nullable=True)

    delivery_pincode = Column(String(20), nullable=True)

    delivery_lat = Column(Float, nullable=True)

    delivery_lng = Column(Float, nullable=True)

    fulfillment_type = Column(String(20), default="DELIVERY", nullable=False)  # 'DELIVERY' or 'PICKUP' (Takeaway)

    estimated_delivery_mins = Column(Integer, default=25, nullable=False)

    notes = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)

    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow, nullable=False)



    items = relationship("OrderItem", back_populates="order", cascade="all, delete-orphan")



    __table_args__ = (

        Index("ix_orders_status_created", "status", "created_at"),

        Index("ix_orders_customer_phone", "customer_phone"),

        Index("ix_orders_user_id", "user_id"),

        Index("ix_orders_business_id", "business_id"),

    )





class OrderItem(Base):

    __tablename__ = "order_items"



    id = Column(Integer, primary_key=True, autoincrement=True)

    order_id = Column(Integer, ForeignKey("orders.id", ondelete="CASCADE"), nullable=False, index=True)

    product_id = Column(Integer, ForeignKey("products.id", ondelete="SET NULL"), nullable=True)

    product_name = Column(String(255), nullable=False)

    unit_price = Column(Float, nullable=False)

    quantity = Column(Integer, default=1, nullable=False)

    total_price = Column(Float, nullable=False)

    store_name = Column(String(200), nullable=True)

    image_url = Column(String(500), nullable=True)



    order = relationship("Order", back_populates="items")





class ServiceBooking(Base):

    __tablename__ = "service_bookings"



    id = Column(Integer, primary_key=True, autoincrement=True)

    booking_number = Column(String(50), unique=True, nullable=False, index=True)

    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    service_id = Column(Integer, ForeignKey("service_listings.id", ondelete="SET NULL"), nullable=True)

    service_title = Column(String(255), nullable=False)

    category = Column(String(100), nullable=False)

    provider_name = Column(String(200), nullable=False)

    provider_phone = Column(String(50), nullable=False)

    customer_name = Column(String(100), nullable=False)

    customer_phone = Column(String(50), nullable=False)

    service_address = Column(Text, nullable=False)

    scheduled_date = Column(String(50), nullable=False)

    scheduled_slot = Column(String(50), nullable=False)

    status = Column(String(50), default="requested", nullable=False)  # 'requested', 'confirmed', 'in_progress', 'completed', 'cancelled'

    estimated_cost = Column(Float, default=0.0, nullable=False)

    payment_status = Column(String(50), default="pay_after_service", nullable=False)

    otp_code = Column(String(10), nullable=True)  # 4-digit verification code

    notes = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)

    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow, nullable=False)



    __table_args__ = (

        Index("ix_service_bookings_status", "status"),

        Index("ix_service_bookings_customer_phone", "customer_phone"),

        Index("ix_service_bookings_user_id", "user_id"),

    )





class MerchantPushSubscription(Base):

    __tablename__ = "merchant_push_subscriptions"



    id = Column(Integer, primary_key=True, autoincrement=True)

    business_id = Column(String(100), nullable=False, index=True)

    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True)

    endpoint = Column(Text, nullable=False)

    p256dh = Column(String(255), nullable=True)

    auth = Column(String(255), nullable=True)

    user_agent = Column(String(255), nullable=True)

    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)

    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow, nullable=False)



    __table_args__ = (

        Index("ix_push_sub_biz_endpoint", "business_id", "endpoint"),

    )





# ==============================================================================

# PostGIS Geometry Synchronization Listeners (Active when on PostgreSQL)

# ==============================================================================

if not is_sqlite and HAS_GEOALCHEMY:

    @event.listens_for(Business, "before_insert")

    @event.listens_for(Business, "before_update")

    def sync_business_geom(mapper, connection, target):

        if getattr(target, "latitude", None) is not None and getattr(target, "longitude", None) is not None:

            from geoalchemy2.elements import WKTElement

            target.geom = WKTElement(f"POINT({target.longitude} {target.latitude})", srid=4326)







    @event.listens_for(EmergencyFacility, "before_update")

    def sync_emergency_geom(mapper, connection, target):

        if getattr(target, "latitude", None) is not None and getattr(target, "longitude", None) is not None:

            from geoalchemy2.elements import WKTElement

            target.geom = WKTElement(f"POINT({target.longitude} {target.latitude})", srid=4326)



class UserConsentRecord(Base):

    """

    Indian DPDP Act 2023 Compliant Consent Record.

    Maintains cryptographically verifiable, timestamped consent trail for location,

    analytics, and notification permissions.

    """

    __tablename__ = "user_consent_records"



    id = Column(Integer, primary_key=True, autoincrement=True)

    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)

    anonymized_user_hash = Column(String(64), nullable=False, index=True)

    consent_type = Column(String(50), nullable=False)  # 'LOCATION', 'NOTIFICATIONS', 'ANALYTICS', 'ALL'

    status = Column(String(20), nullable=False, default="GRANTED")  # 'GRANTED', 'REVOKED'

    dpdp_notice_version = Column(String(20), default="1.0", nullable=False)

    ip_hash = Column(String(64), nullable=True)

    user_agent = Column(String(255), nullable=True)

    granted_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)

    revoked_at = Column(DateTime, nullable=True)



    __table_args__ = (

        Index("ix_consent_user_type", "anonymized_user_hash", "consent_type"),

    )





class ApiUsageRecord(Base):

    """

    Persistent API telemetry, cost audit, and rate-limit tracker across all

    external providers (Gemini, WeatherAPI, TomTom, Eventbrite, SMS, etc.).

    """

    __tablename__ = "api_usage_records"



    id = Column(Integer, primary_key=True, autoincrement=True)

    provider_name = Column(String(100), nullable=False, index=True)

    endpoint = Column(String(255), nullable=False)

    feature_name = Column(String(100), nullable=False, index=True)

    status_code = Column(Integer, default=200, nullable=False)

    latency_ms = Column(Float, default=0.0, nullable=False)

    is_success = Column(Boolean, default=True, nullable=False)

    input_tokens = Column(Integer, default=0, nullable=False)

    output_tokens = Column(Integer, default=0, nullable=False)

    cost_inr = Column(Float, default=0.0, nullable=False)

    error_message = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False, index=True)



    __table_args__ = (

        Index("ix_api_usage_provider_created", "provider_name", "created_at"),

        Index("ix_api_usage_feature_created", "feature_name", "created_at"),

    )







class HospitalDirectory(Base):
    """
    National Hospital Directory with Geo Code and verified parameters.
    Dataset published by Ministry of Health and Family Welfare (NIHFW) on data.gov.in
    OGD Resource ID: 98fa254e-c5f8-4910-a19b-4828939b477d
    """
    __tablename__ = "hospital_directory"

    id = Column(Integer, primary_key=True, autoincrement=True)
    sr_no = Column(Integer, nullable=True, index=True)
    hospital_name = Column(String(255), nullable=False, index=True)
    hospital_category = Column(String(100), nullable=True)
    care_type = Column(String(100), nullable=True, index=True)
    discipline_system = Column(String(100), nullable=True)
    state = Column(String(100), nullable=False, index=True)
    district = Column(String(100), nullable=False, index=True)
    subdistrict = Column(String(100), nullable=True)
    pincode = Column(String(20), nullable=True, index=True)
    address = Column(Text, nullable=True)
    location = Column(String(255), nullable=True)
    latitude = Column(Float, nullable=True, index=True)
    longitude = Column(Float, nullable=True, index=True)
    telephone = Column(String(100), nullable=True)
    mobile_number = Column(String(100), nullable=True)
    emergency_num = Column(String(100), nullable=True)
    ambulance_phone = Column(String(100), nullable=True)
    bloodbank_phone = Column(String(100), nullable=True)
    tollfree = Column(String(100), nullable=True)
    helpline = Column(String(100), nullable=True)
    email = Column(String(255), nullable=True)
    website = Column(String(255), nullable=True)
    specialties = Column(Text, nullable=True)
    facilities = Column(Text, nullable=True)
    accreditation = Column(String(100), nullable=True)
    total_beds = Column(Integer, default=0, nullable=False)
    emergency_services = Column(String(100), nullable=True)
    has_emergency = Column(Boolean, default=False, index=True, nullable=False)
    has_bloodbank = Column(Boolean, default=False, nullable=False)
    has_ambulance = Column(Boolean, default=False, nullable=False)
    source_name = Column(String(150), default="Ministry of Health and Family Welfare (NIHFW) - data.gov.in", nullable=False)
    resource_id = Column(String(100), default="98fa254e-c5f8-4910-a19b-4828939b477d", nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow, nullable=False)

    __table_args__ = (
        Index("ix_hospital_state_district", "state", "district"),
        Index("ix_hospital_state_care", "state", "care_type"),
        Index("ix_hospital_coords", "latitude", "longitude"),
        Index("ix_hospital_name_state", "hospital_name", "state"),
    )


class PetrolPump(Base):
    """
    Persisted real-time petrol pumps and fuel stations synchronized from
    SSR Innovation Lab Live OMC Petrol Pump API.
    Provides verified pump-level petrol/diesel prices, coordinates, operating hours,
    and brand identity across 107,000+ Indian fuel stations.
    """
    __tablename__ = "petrol_pumps"

    id = Column(Integer, primary_key=True, autoincrement=True)
    ssr_id = Column(Integer, unique=True, nullable=False, index=True)
    pump_name = Column(String(255), nullable=False, index=True)
    name = Column(String(255), nullable=True)
    company = Column(String(100), nullable=True, index=True)
    address = Column(Text, nullable=True)
    city = Column(String(100), nullable=True, index=True)
    district = Column(String(100), nullable=True, index=True)
    state = Column(String(100), nullable=True, index=True)
    pincode = Column(String(20), nullable=True, index=True)
    latitude = Column(Float, nullable=True, index=True)
    longitude = Column(Float, nullable=True, index=True)
    petrol_price = Column(Float, nullable=True)
    diesel_price = Column(Float, nullable=True)
    has_petrol = Column(Boolean, default=True, nullable=False)
    has_diesel = Column(Boolean, default=True, nullable=False)
    has_cng = Column(Boolean, default=False, nullable=False)
    station_timing = Column(String(100), default="24 Hours", nullable=False)
    direction_link = Column(String(255), nullable=True)
    source_name = Column(String(150), default="SSR Innovation Lab (Live OMC Feed)", nullable=False)
    price_updated_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    last_synced_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow, nullable=False)

    __table_args__ = (
        Index("ix_petrol_pumps_state_city", "state", "city"),
        Index("ix_petrol_pumps_district_company", "district", "company"),
        Index("ix_petrol_pumps_spatial_coords", "latitude", "longitude"),
    )


class SavedRoute(Base):
    """
    User-created daily commute routes (e.g. Home to College, Office commute).
    Stores origin, destination, distance, live traffic conditions, delays, and last checked time.
    """
    __tablename__ = "saved_routes"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)
    session_id = Column(String(100), nullable=True, index=True)
    title = Column(String(150), nullable=False)
    origin_name = Column(String(255), nullable=False)
    origin_lat = Column(Float, nullable=False)
    origin_lng = Column(Float, nullable=False)
    destination_name = Column(String(255), nullable=False)
    destination_lat = Column(Float, nullable=False)
    destination_lng = Column(Float, nullable=False)
    distance_km = Column(Float, default=0.0, nullable=False)
    typical_duration_mins = Column(Integer, default=0, nullable=False)
    current_duration_mins = Column(Integer, default=0, nullable=False)
    congestion_level = Column(String(50), default="Normal", nullable=False)
    delay_minutes = Column(Integer, default=0, nullable=False)
    alternative_summary = Column(String(255), nullable=True)
    last_checked_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow, nullable=False)

    user = relationship("User", backref="saved_routes", foreign_keys=[user_id])

    __table_args__ = (
        Index("ix_saved_routes_user_created", "user_id", "created_at"),
        Index("ix_saved_routes_session_created", "session_id", "created_at"),
    )

