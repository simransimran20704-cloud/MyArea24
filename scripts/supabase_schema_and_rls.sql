-- ==============================================================================
-- MyArea24 — Supabase PostgreSQL Schema, PostGIS Extensions & Row Level Security (RLS)
-- Run this script in the Supabase SQL Editor (Dashboard -> SQL Editor)
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- 2. SPATIAL & FULL-TEXT PERFORMANCE INDEXES
-- These indexes ensure sub-millisecond proximity queries across all local facilities
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'businesses') THEN
        EXECUTE 'CREATE INDEX IF NOT EXISTS ix_businesses_gist_spatial ON businesses USING GIST ((ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography));';
        EXECUTE 'CREATE INDEX IF NOT EXISTS ix_businesses_name_trgm ON businesses USING GIN (name gin_trgm_ops);';
        EXECUTE 'CREATE INDEX IF NOT EXISTS ix_businesses_locality ON businesses (locality, city);';
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'emergency_facilities') THEN
        EXECUTE 'CREATE INDEX IF NOT EXISTS ix_emergency_facilities_gist_spatial ON emergency_facilities USING GIST ((ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography));';
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'hospital_directory') THEN
        EXECUTE 'CREATE INDEX IF NOT EXISTS ix_hospital_directory_gist_spatial ON hospital_directory USING GIST ((ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography));';
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'fuel_stations') THEN
        EXECUTE 'CREATE INDEX IF NOT EXISTS ix_fuel_stations_gist_spatial ON fuel_stations USING GIST ((ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography));';
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'products') THEN
        EXECUTE 'CREATE INDEX IF NOT EXISTS ix_products_name_trgm ON products USING GIN (name gin_trgm_ops);';
        EXECUTE 'CREATE INDEX IF NOT EXISTS ix_products_business_id ON products (business_id);';
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'service_listings') THEN
        EXECUTE 'CREATE INDEX IF NOT EXISTS ix_service_listings_business_id ON service_listings (business_id);';
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'offers') THEN
        EXECUTE 'CREATE INDEX IF NOT EXISTS ix_offers_business_id ON offers (business_id);';
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'orders') THEN
        EXECUTE 'CREATE INDEX IF NOT EXISTS ix_orders_user_id ON orders (user_id);';
        EXECUTE 'CREATE INDEX IF NOT EXISTS ix_orders_business_id ON orders (business_id);';
    END IF;
END $$;


-- 3. SUPABASE STORAGE BUCKET CONFIGURATION & POLICIES

-- 3.1 Public Bucket: merchant-media (Product photos, store logos, offer banners)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'merchant-media',
    'merchant-media',
    true,
    5242880, -- 5 MB limit
    ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
SET public = true, file_size_limit = 5242880, allowed_mime_types = ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

-- 3.2 Private Bucket: merchant-documents (KYC, GSTIN, FSSAI certificates, business licenses)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'merchant-documents',
    'merchant-documents',
    false, -- STRICTLY PRIVATE
    10485760, -- 10 MB limit
    ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE
SET public = false, file_size_limit = 10485760, allowed_mime_types = ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf'];

-- Clean legacy / duplicate storage policies
DROP POLICY IF EXISTS "Public Read Access" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Upload Access" ON storage.objects;
DROP POLICY IF EXISTS "Service Role Full Access" ON storage.objects;
DROP POLICY IF EXISTS "Public Read Merchant Media" ON storage.objects;
DROP POLICY IF EXISTS "Merchant Media Authenticated Upload" ON storage.objects;
DROP POLICY IF EXISTS "Merchant Media Owner Update" ON storage.objects;
DROP POLICY IF EXISTS "Merchant Media Owner Delete" ON storage.objects;
DROP POLICY IF EXISTS "Merchant Documents Owner Read" ON storage.objects;
DROP POLICY IF EXISTS "Merchant Documents Owner Upload" ON storage.objects;
DROP POLICY IF EXISTS "Merchant Documents Owner Update" ON storage.objects;
DROP POLICY IF EXISTS "Merchant Documents Owner Delete" ON storage.objects;

-- POLICIES FOR merchant-media (Public Store Assets):
CREATE POLICY "Public Read Merchant Media"
ON storage.objects FOR SELECT
USING (bucket_id = 'merchant-media');

CREATE POLICY "Merchant Media Authenticated Upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'merchant-media');

CREATE POLICY "Merchant Media Owner Update"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'merchant-media' AND (auth.uid() = owner OR owner IS NULL));

CREATE POLICY "Merchant Media Owner Delete"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'merchant-media' AND (auth.uid() = owner OR owner IS NULL));

-- POLICIES FOR merchant-documents (Strictly Private Business KYC):
-- Note: NO public read policy exists. Anonymous/unauthorized requests receive access denied.
CREATE POLICY "Merchant Documents Owner Read"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'merchant-documents' AND auth.uid() = owner);

CREATE POLICY "Merchant Documents Owner Upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'merchant-documents' AND auth.uid() = owner);

CREATE POLICY "Merchant Documents Owner Update"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'merchant-documents' AND auth.uid() = owner)
WITH CHECK (bucket_id = 'merchant-documents' AND auth.uid() = owner);

CREATE POLICY "Merchant Documents Owner Delete"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'merchant-documents' AND auth.uid() = owner);


-- 4. ROW LEVEL SECURITY (RLS) POLICIES ON DATABASE TABLES

-- Enable RLS across sensitive and commercial tables
DO $$
DECLARE
    tbl text;
    tables_to_protect text[] := ARRAY[
        'users',
        'businesses',
        'products',
        'service_listings',
        'offers',
        'orders',
        'order_items',
        'service_bookings',
        'customer_enquiries',
        'saved_items',
        'saved_routes',
        'user_consent_records',
        'merchant_push_subscriptions'
    ];
BEGIN
    FOREACH tbl IN ARRAY tables_to_protect LOOP
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = tbl) THEN
            EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', tbl);
        END IF;
    END LOOP;
END $$;


-- Policy 4.0: Users Profile Isolation (Zero Public Access to Password Hashes / PII)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users') THEN
        DROP POLICY IF EXISTS "Public Read Users" ON users;
        DROP POLICY IF EXISTS "Service Role Manage Users" ON users;
        DROP POLICY IF EXISTS "Users Read Own Profile" ON users;
        DROP POLICY IF EXISTS "Users Update Own Profile" ON users;

        -- Authenticated users can only read their own profile record
        CREATE POLICY "Users Read Own Profile" ON users
            FOR SELECT TO authenticated
            USING (auth.uid()::text = id::text);

        -- Authenticated users can only update their own profile record
        CREATE POLICY "Users Update Own Profile" ON users
            FOR UPDATE TO authenticated
            USING (auth.uid()::text = id::text)
            WITH CHECK (auth.uid()::text = id::text);
        -- Anonymous users: ZERO access (cannot SELECT, INSERT, UPDATE, or DELETE)
    END IF;
END $$;


-- Policy 4.1: Public read for businesses, products, services, offers
DO $$
BEGIN
    -- Businesses
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'businesses') THEN
        DROP POLICY IF EXISTS "Public Read Businesses" ON businesses;
        DROP POLICY IF EXISTS "Service Role Manage Businesses" ON businesses;
        CREATE POLICY "Public Read Businesses" ON businesses
            FOR SELECT USING (true);
    END IF;

    -- Products
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'products') THEN
        DROP POLICY IF EXISTS "Public Read Products" ON products;
        DROP POLICY IF EXISTS "Service Role Manage Products" ON products;
        CREATE POLICY "Public Read Products" ON products
            FOR SELECT USING (true);
    END IF;

    -- Services
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'service_listings') THEN
        DROP POLICY IF EXISTS "Public Read Services" ON service_listings;
        DROP POLICY IF EXISTS "Service Role Manage Services" ON service_listings;
        CREATE POLICY "Public Read Services" ON service_listings
            FOR SELECT USING (is_available = true);
    END IF;

    -- Offers
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'offers') THEN
        DROP POLICY IF EXISTS "Public Read Offers" ON offers;
        DROP POLICY IF EXISTS "Service Role Manage Offers" ON offers;
        CREATE POLICY "Public Read Offers" ON offers
            FOR SELECT USING (is_active = true);
    END IF;
END $$;


-- Policy 4.2: Saved Items & Saved Routes (Per-User Isolation)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'saved_items') THEN
        DROP POLICY IF EXISTS "User Access Own Saved Items" ON saved_items;
        CREATE POLICY "User Access Own Saved Items" ON saved_items
            FOR ALL TO authenticated
            USING (auth.uid()::text = user_id::text)
            WITH CHECK (auth.uid()::text = user_id::text);
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'saved_routes') THEN
        DROP POLICY IF EXISTS "User Access Own Saved Routes" ON saved_routes;
        CREATE POLICY "User Access Own Saved Routes" ON saved_routes
            FOR ALL TO authenticated
            USING (auth.uid()::text = user_id::text)
            WITH CHECK (auth.uid()::text = user_id::text);
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_consent_records') THEN
        DROP POLICY IF EXISTS "User Access Own Consent Records" ON user_consent_records;
        CREATE POLICY "User Access Own Consent Records" ON user_consent_records
            FOR ALL TO authenticated
            USING (auth.uid()::text = user_id::text)
            WITH CHECK (auth.uid()::text = user_id::text);
    END IF;
END $$;


-- Policy 4.3: Orders & Bookings (User and Store Isolation)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'orders') THEN
        DROP POLICY IF EXISTS "User Access Own Orders" ON orders;
        CREATE POLICY "User Access Own Orders" ON orders
            FOR ALL TO authenticated
            USING (
                auth.uid()::text = user_id::text 
                OR EXISTS (
                    SELECT 1 FROM businesses b 
                    WHERE b.id = orders.business_id AND b.owner_id::text = auth.uid()::text
                )
            );
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'service_bookings') THEN
        DROP POLICY IF EXISTS "User Access Own Bookings" ON service_bookings;
        CREATE POLICY "User Access Own Bookings" ON service_bookings
            FOR ALL TO authenticated
            USING (auth.uid()::text = user_id::text);
    END IF;
END $$;

-- 5. PUBLIC TELEMETRY TABLES (Read Access for All Citizens)
DO $$
DECLARE
    telemetry_tbl text;
    telemetry_tables text[] := ARRAY[
        'emergency_facilities',
        'hospital_directory',
        'fuel_stations',
        'mandi_prices',
        'events',
        'weather_observations',
        'air_quality_observations',
        'traffic_observations',
        'government_notices',
        'civic_bulletins',
        'intelligence_insights',
        'rental_listings',
        'government_housing_indices'
    ];
BEGIN
    FOREACH telemetry_tbl IN ARRAY telemetry_tables LOOP
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = telemetry_tbl) THEN
            EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', telemetry_tbl);
            EXECUTE format('DROP POLICY IF EXISTS "Public Read %I" ON %I;', telemetry_tbl, telemetry_tbl);
            EXECUTE format('CREATE POLICY "Public Read %I" ON %I FOR SELECT USING (true);', telemetry_tbl, telemetry_tbl);
            EXECUTE format('DROP POLICY IF EXISTS "Service Role Manage %I" ON %I;', telemetry_tbl, telemetry_tbl);
        END IF;
    END LOOP;
END $$;
