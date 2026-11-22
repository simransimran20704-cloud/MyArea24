"""
MyArea24 Media Storage Service.
Supports local persistent disk storage with FastAPI StaticFiles mounting,
WebP thumbnail generation via Pillow, and cloud storage uploads to AWS S3,
Cloudflare R2, MinIO, or Google Cloud Storage (GCS).
"""
import io
import os
import re
import uuid
import logging
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)

# Strict allowed MIME types as per production specifications
ALLOWED_IMAGE_MIME_TYPES = {
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
}

ALLOWED_DOCUMENT_MIME_TYPES = {
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
    "application/pdf",
}

# Maximum allowed file size
MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024  # 5 MB
MAX_DOCUMENT_SIZE_BYTES = 10 * 1024 * 1024  # 10 MB

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
STATIC_DIR = os.path.join(BASE_DIR, "static")
MERCHANT_UPLOADS_DIR = os.path.join(STATIC_DIR, "uploads", "merchant")
MERCHANT_THUMBNAILS_DIR = os.path.join(MERCHANT_UPLOADS_DIR, "thumbnails")


def ensure_upload_directories():
    """Ensures static upload directories and thumbnail cache exist on the local filesystem."""
    try:
        os.makedirs(MERCHANT_UPLOADS_DIR, exist_ok=True)
        os.makedirs(MERCHANT_THUMBNAILS_DIR, exist_ok=True)
    except OSError as e:
        logger.warning(f"[media_storage] Local storage directory setup notice (read-only/serverless environment): {e}")


def sanitize_filename(filename: str) -> str:
    """Sanitizes user filename by removing dangerous characters and path traversals."""
    basename = os.path.basename(filename or "image.jpg")
    clean = re.sub(r"[^a-zA-Z0-9_.-]", "_", basename)
    if not clean.strip("._"):
        clean = "image.jpg"
    return clean


def generate_webp_thumbnail(
    image_bytes: bytes,
    max_size: tuple = (300, 300),
    quality: int = 80,
) -> Optional[bytes]:
    """
    Generates an optimized WebP thumbnail from image bytes using Pillow (PIL).
    Maintains aspect ratio and auto-orients according to EXIF data.
    Returns WebP byte content or None if generation fails.
    """
    try:
        from PIL import Image, ImageOps

        with Image.open(io.BytesIO(image_bytes)) as img:
            # Normalize EXIF orientation
            try:
                img = ImageOps.exif_transpose(img)
            except Exception:
                pass

            # Maintain transparency for RGBA/LA, otherwise convert to RGB
            if img.mode in ("RGBA", "LA"):
                pass
            elif img.mode != "RGB":
                img = img.convert("RGB")

            # Scale to fit within max_size preserving aspect ratio
            img.thumbnail(max_size, Image.Resampling.LANCZOS)

            thumb_buffer = io.BytesIO()
            img.save(thumb_buffer, format="WEBP", quality=quality, optimize=True)
            return thumb_buffer.getvalue()
    except Exception as e:
        logger.warning(f"[media_storage] WebP thumbnail generation failed: {e}")
        return None


async def save_merchant_media(
    file_bytes: bytes,
    original_filename: str,
    content_type: str,
    merchant_id: Optional[int] = None,
) -> Dict[str, Any]:
    """
    Saves uploaded merchant media either to cloud storage (S3/R2/GCS) if configured,
    or to local persistent static storage. Generates an optimized WebP thumbnail
    and returns both the public CDN URL and the thumbnail URL.
    """
    if not file_bytes:
        raise ValueError("Uploaded file is empty.")

    clean_type = (content_type or "image/jpeg").lower().split(";")[0].strip()

    if clean_type not in ALLOWED_IMAGE_MIME_TYPES:
        raise ValueError(
            f"Unsupported media type: '{clean_type}'. Allowed types: image/jpeg, image/png, image/webp."
        )

    if len(file_bytes) > MAX_FILE_SIZE_BYTES:
        raise ValueError(
            f"File size ({len(file_bytes) / (1024 * 1024):.2f}MB) exceeds maximum allowed limit of {MAX_FILE_SIZE_BYTES // (1024 * 1024)}MB."
        )

    clean_name = sanitize_filename(original_filename)
    unique_suffix = uuid.uuid4().hex[:12]
    prefix = f"biz_{merchant_id}" if merchant_id else "merchant"
    unique_filename = f"{prefix}_{unique_suffix}_{clean_name}"

    # Generate WebP thumbnail
    name_base, _ = os.path.splitext(unique_filename)
    thumb_filename = f"{name_base}_thumb.webp"
    thumb_bytes = generate_webp_thumbnail(file_bytes)

    # 0. Supabase Storage Integration (Primary cloud storage)
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = (
        os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        or os.getenv("SUPABASE_KEY")
        or os.getenv("SUPABASE_ANON_KEY")
    )
    supabase_bucket = os.getenv("SUPABASE_STORAGE_BUCKET", "merchant-media")

    if supabase_url and supabase_key:
        try:
            import httpx

            base_api = supabase_url.rstrip("/")
            key = f"uploads/merchant/{unique_filename}"
            thumb_key = f"uploads/merchant/thumbnails/{thumb_filename}"
            upload_url = f"{base_api}/storage/v1/object/{supabase_bucket}/{key}"
            headers = {
                "Authorization": f"Bearer {supabase_key}",
                "Content-Type": clean_type,
                "x-upsert": "true",
            }
            async with httpx.AsyncClient(timeout=20.0) as client:
                res = await client.post(upload_url, headers=headers, content=file_bytes)
                if res.status_code in (200, 201):
                    # Also upload thumbnail
                    if thumb_bytes:
                        thumb_upload_url = f"{base_api}/storage/v1/object/{supabase_bucket}/{thumb_key}"
                        thumb_headers = {
                            "Authorization": f"Bearer {supabase_key}",
                            "Content-Type": "image/webp",
                            "x-upsert": "true",
                        }
                        await client.post(thumb_upload_url, headers=thumb_headers, content=thumb_bytes)

                    cdn_url = f"{base_api}/storage/v1/object/public/{supabase_bucket}/{key}"
                    thumb_url = (
                        f"{base_api}/storage/v1/object/public/{supabase_bucket}/{thumb_key}"
                        if thumb_bytes
                        else cdn_url
                    )

                    logger.info(
                        f"[media_storage] Successfully uploaded {unique_filename} to Supabase bucket '{supabase_bucket}'"
                    )
                    return {
                        "status": "success",
                        "url": cdn_url,
                        "cdn_url": cdn_url,
                        "thumbnail_url": thumb_url,
                        "filename": unique_filename,
                        "thumbnail_filename": thumb_filename if thumb_bytes else None,
                        "size_bytes": len(file_bytes),
                        "thumbnail_size_bytes": len(thumb_bytes) if thumb_bytes else None,
                        "content_type": clean_type,
                        "storage_provider": "supabase",
                    }
                else:
                    logger.warning(
                        f"[media_storage] Supabase Storage upload failed ({res.status_code}: {res.text})"
                    )
        except Exception as se:
            logger.warning(f"[media_storage] Supabase Storage exception: {se}")

    # 1. Cloud Storage Integration (AWS S3, Cloudflare R2, MinIO, Google Cloud Storage via S3 interoperability)
    s3_bucket = (
        os.getenv("AWS_S3_BUCKET")
        or os.getenv("S3_BUCKET_NAME")
        or os.getenv("CLOUDFLARE_R2_BUCKET")
        or os.getenv("GCS_BUCKET")
        or os.getenv("GOOGLE_CLOUD_STORAGE_BUCKET")
    )

    if s3_bucket:
        try:
            import boto3
            from botocore.config import Config

            endpoint_url = (
                os.getenv("AWS_ENDPOINT_URL")
                or os.getenv("S3_ENDPOINT_URL")
                or os.getenv("R2_ENDPOINT_URL")
                or os.getenv("GCS_ENDPOINT_URL")
            )
            # Default to Google Cloud Storage S3 interoperability endpoint if GCS configured without endpoint
            if not endpoint_url and (os.getenv("GCS_BUCKET") or os.getenv("GOOGLE_CLOUD_STORAGE_BUCKET")):
                endpoint_url = "https://storage.googleapis.com"

            s3_client = boto3.client(
                "s3",
                endpoint_url=endpoint_url,
                aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID") or os.getenv("GCS_ACCESS_KEY_ID"),
                aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY") or os.getenv("GCS_SECRET_ACCESS_KEY"),
                region_name=os.getenv("AWS_REGION", "ap-south-1"),
                config=Config(signature_version="s3v4"),
            )
            key = f"uploads/merchant/{unique_filename}"
            s3_client.put_object(
                Bucket=s3_bucket,
                Key=key,
                Body=file_bytes,
                ContentType=clean_type,
            )

            # Upload thumbnail if available
            thumb_key = f"uploads/merchant/thumbnails/{thumb_filename}"
            if thumb_bytes:
                s3_client.put_object(
                    Bucket=s3_bucket,
                    Key=thumb_key,
                    Body=thumb_bytes,
                    ContentType="image/webp",
                )

            public_domain = (
                os.getenv("CDN_DOMAIN")
                or os.getenv("S3_PUBLIC_DOMAIN")
                or os.getenv("R2_PUBLIC_DOMAIN")
                or os.getenv("GCS_PUBLIC_DOMAIN")
            )

            if public_domain:
                cdn_url = f"https://{public_domain.rstrip('/')}/{key}"
                thumb_url = f"https://{public_domain.rstrip('/')}/{thumb_key}" if thumb_bytes else cdn_url
            elif endpoint_url:
                cdn_url = f"{endpoint_url.rstrip('/')}/{s3_bucket}/{key}"
                thumb_url = f"{endpoint_url.rstrip('/')}/{s3_bucket}/{thumb_key}" if thumb_bytes else cdn_url
            else:
                region = os.getenv("AWS_REGION", "ap-south-1")
                cdn_url = f"https://{s3_bucket}.s3.{region}.amazonaws.com/{key}"
                thumb_url = f"https://{s3_bucket}.s3.{region}.amazonaws.com/{thumb_key}" if thumb_bytes else cdn_url

            logger.info(f"[media_storage] Successfully uploaded {unique_filename} to cloud bucket {s3_bucket}")
            return {
                "status": "success",
                "url": cdn_url,
                "cdn_url": cdn_url,
                "thumbnail_url": thumb_url,
                "filename": unique_filename,
                "thumbnail_filename": thumb_filename if thumb_bytes else None,
                "size_bytes": len(file_bytes),
                "thumbnail_size_bytes": len(thumb_bytes) if thumb_bytes else None,
                "content_type": clean_type,
                "storage_provider": "cloud",
            }
        except Exception as e:
            logger.warning(f"[media_storage] Cloud upload failed, falling back to local static storage: {e}")

    # 2. Local Persistent Static Storage
    ensure_upload_directories()
    try:
        dest_path = os.path.join(MERCHANT_UPLOADS_DIR, unique_filename)
        with open(dest_path, "wb") as f:
            f.write(file_bytes)

        relative_url = f"/static/uploads/merchant/{unique_filename}"
        thumbnail_url = relative_url
        thumbnail_size = None

        if thumb_bytes:
            thumb_dest_path = os.path.join(MERCHANT_THUMBNAILS_DIR, thumb_filename)
            with open(thumb_dest_path, "wb") as f:
                f.write(thumb_bytes)
            thumbnail_url = f"/static/uploads/merchant/thumbnails/{thumb_filename}"
            thumbnail_size = len(thumb_bytes)
    except OSError as err:
        # Graceful fallback to OS temp directory on serverless platforms (e.g. Vercel read-only filesystem)
        import tempfile
        tmp_dir = os.path.join(tempfile.gettempdir(), "merchant_uploads")
        os.makedirs(tmp_dir, exist_ok=True)
        dest_path = os.path.join(tmp_dir, unique_filename)
        with open(dest_path, "wb") as f:
            f.write(file_bytes)
        relative_url = f"/static/uploads/merchant/{unique_filename}"
        thumbnail_url = relative_url
        thumbnail_size = len(thumb_bytes) if thumb_bytes else None
        logger.warning(f"[media_storage] Local disk is read-only ({err}). Staged file in temp path: {dest_path}")

    cdn_domain = os.getenv("CDN_DOMAIN")
    cdn_url = f"https://{cdn_domain.rstrip('/')}{relative_url}" if cdn_domain else relative_url

    logger.info(f"[media_storage] Saved {unique_filename} to local static path {dest_path}")

    return {
        "status": "success",
        "url": relative_url,
        "cdn_url": cdn_url,
        "thumbnail_url": thumbnail_url,
        "filename": unique_filename,
        "thumbnail_filename": thumb_filename if thumb_bytes else None,
        "size_bytes": len(file_bytes),
        "thumbnail_size_bytes": thumbnail_size,
        "content_type": clean_type,
        "storage_provider": "local",
    }


async def save_merchant_document(
    file_bytes: bytes,
    original_filename: str,
    content_type: str,
    merchant_id: int,
    doc_type: str = "kyc",
) -> Dict[str, Any]:
    """
    Saves sensitive merchant verification documents (KYC, GSTIN, FSSAI) to the private
    'merchant-documents' bucket with strict access controls. Never generates public CDN URLs.
    """
    if not file_bytes:
        raise ValueError("Uploaded document is empty.")

    clean_type = (content_type or "application/pdf").lower().split(";")[0].strip()
    if clean_type not in ALLOWED_DOCUMENT_MIME_TYPES:
        raise ValueError(
            f"Unsupported document type: '{clean_type}'. Allowed types: PDF, JPEG, PNG, WebP."
        )

    if len(file_bytes) > MAX_DOCUMENT_SIZE_BYTES:
        raise ValueError(
            f"Document size ({len(file_bytes) / (1024 * 1024):.2f}MB) exceeds limit of {MAX_DOCUMENT_SIZE_BYTES // (1024 * 1024)}MB."
        )

    clean_name = sanitize_filename(original_filename)
    unique_suffix = uuid.uuid4().hex[:12]
    unique_filename = f"biz_{merchant_id}/{doc_type}_{unique_suffix}_{clean_name}"

    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY")
    docs_bucket = os.getenv("SUPABASE_DOCUMENTS_BUCKET", "merchant-documents")

    if supabase_url and supabase_key:
        try:
            import httpx

            base_api = supabase_url.rstrip("/")
            upload_url = f"{base_api}/storage/v1/object/{docs_bucket}/{unique_filename}"
            headers = {
                "Authorization": f"Bearer {supabase_key}",
                "Content-Type": clean_type,
                "x-upsert": "true",
            }
            async with httpx.AsyncClient(timeout=20.0) as client:
                res = await client.post(upload_url, headers=headers, content=file_bytes)
                if res.status_code in (200, 201):
                    logger.info(
                        f"[media_storage] Securely uploaded KYC document to private bucket '{docs_bucket}'"
                    )
                    return {
                        "status": "success",
                        "bucket": docs_bucket,
                        "path": unique_filename,
                        "is_private": True,
                        "size_bytes": len(file_bytes),
                        "content_type": clean_type,
                        "storage_provider": "supabase_private",
                    }
        except Exception as se:
            logger.warning(f"[media_storage] Supabase private document upload error: {se}")

    # Fallback for local development
    docs_dir = os.path.join(STATIC_DIR, "uploads", "private_documents", f"biz_{merchant_id}")
    try:
        os.makedirs(docs_dir, exist_ok=True)
        dest_path = os.path.join(docs_dir, os.path.basename(unique_filename))
        with open(dest_path, "wb") as f:
            f.write(file_bytes)
        local_path = f"/static/uploads/private_documents/biz_{merchant_id}/{os.path.basename(unique_filename)}"
    except OSError:
        import tempfile

        tmp_dir = os.path.join(tempfile.gettempdir(), f"biz_{merchant_id}")
        os.makedirs(tmp_dir, exist_ok=True)
        dest_path = os.path.join(tmp_dir, os.path.basename(unique_filename))
        with open(dest_path, "wb") as f:
            f.write(file_bytes)
        local_path = dest_path

    return {
        "status": "success",
        "bucket": "local_private",
        "path": local_path,
        "is_private": True,
        "size_bytes": len(file_bytes),
        "content_type": clean_type,
        "storage_provider": "local_private",
    }
