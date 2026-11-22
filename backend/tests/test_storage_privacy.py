"""
Unit & Security Test for Supabase Storage Privacy & Policy Enforcement
Verifies that merchant-documents is strictly private, KYC files do not generate
public URLs, and storage access policies enforce owner-only access.
"""
import pytest
import os
import re
from pathlib import Path

from backend.app.services.media_storage import (
    save_merchant_media,
    save_merchant_document,
    ALLOWED_IMAGE_MIME_TYPES,
    ALLOWED_DOCUMENT_MIME_TYPES,
)


@pytest.mark.asyncio
async def test_01_merchant_media_is_public():
    """Verify that merchant media (product images, logos) are flagged as public store assets."""
    fake_png = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15c4\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82"
    res = await save_merchant_media(fake_png, "sample_product.png", "image/png", merchant_id=1)
    assert res["status"] == "success"
    assert "thumbnail_url" in res
    assert res.get("is_private") is not True


@pytest.mark.asyncio
async def test_02_merchant_documents_is_strictly_private():
    """Verify that KYC verification documents are flagged as private and never generate public CDN URLs."""
    fake_pdf = b"%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF"
    res = await save_merchant_document(fake_pdf, "gst_certificate.pdf", "application/pdf", merchant_id=1, doc_type="gst")
    assert res["status"] == "success"
    assert res["is_private"] is True
    assert "cdn_url" not in res
    assert res["bucket"] in ("merchant-documents", "local_private")


def test_03_sql_schema_storage_buckets_configuration():
    """Verify that the SQL schema strictly configures merchant-documents as public=false and merchant-media as public=true."""
    sql_path = Path("scripts/supabase_schema_and_rls.sql").resolve()
    assert sql_path.exists(), "scripts/supabase_schema_and_rls.sql must exist"
    sql = sql_path.read_text(encoding="utf-8")

    # Verify merchant-media is public: true
    assert "merchant-media" in sql
    media_match = re.search(r"VALUES\s*\(\s*'merchant-media',\s*'merchant-media',\s*true", sql, re.IGNORECASE)
    assert media_match is not None, "merchant-media bucket must be defined with public = true"

    # Verify merchant-documents is public: false
    assert "merchant-documents" in sql
    docs_match = re.search(r"VALUES\s*\(\s*'merchant-documents',\s*'merchant-documents',\s*false", sql, re.IGNORECASE)
    assert docs_match is not None, "merchant-documents bucket must be defined with public = false (STRICTLY PRIVATE)"


def test_04_sql_schema_storage_rls_policies_privacy():
    """Verify that no public SELECT policy exists for merchant-documents and owner check is enforced."""
    sql_path = Path("scripts/supabase_schema_and_rls.sql").resolve()
    sql = sql_path.read_text(encoding="utf-8")

    # merchant-media has public read
    assert "Public Read Merchant Media" in sql

    # merchant-documents must NOT have a public read policy
    assert "Public Read Merchant Documents" not in sql

    # merchant-documents policies must enforce auth.uid() = owner
    assert "CREATE POLICY \"Merchant Documents Owner Read\"" in sql
    assert "USING (bucket_id = 'merchant-documents' AND auth.uid() = owner)" in sql
    assert "CREATE POLICY \"Merchant Documents Owner Upload\"" in sql
    assert "WITH CHECK (bucket_id = 'merchant-documents' AND auth.uid() = owner)" in sql
    assert "CREATE POLICY \"Merchant Documents Owner Update\"" in sql
    assert "CREATE POLICY \"Merchant Documents Owner Delete\"" in sql


def test_05_unauthorized_extension_rejection():
    """Verify that dangerous executable files (e.g. .exe, .sh, .py, .php) are rejected for both media and documents."""
    assert "application/x-msdownload" not in ALLOWED_IMAGE_MIME_TYPES
    assert "application/x-sh" not in ALLOWED_IMAGE_MIME_TYPES
    assert "text/x-python" not in ALLOWED_IMAGE_MIME_TYPES
    assert "application/x-msdownload" not in ALLOWED_DOCUMENT_MIME_TYPES
    assert "application/x-sh" not in ALLOWED_DOCUMENT_MIME_TYPES
    assert "application/pdf" in ALLOWED_DOCUMENT_MIME_TYPES
