import asyncio
import base64
import binascii
import io
from pathlib import Path
from fastapi import UploadFile, HTTPException
from PIL import Image, UnidentifiedImageError
import PyPDF2

MAX_UPLOAD = 2 * 1024 * 1024

def image_part(content):
    try:
        data = base64.b64decode(content, validate=True)
        if len(data) > MAX_UPLOAD:
            raise ValueError("Image too large")
        with Image.open(io.BytesIO(data)) as img:
            mime = Image.MIME.get(img.format)
            if mime not in ("image/png", "image/jpeg", "image/webp", "image/gif"):
                raise ValueError("Unsupported image")
            img.verify()
        return {"mime_type": mime, "data": data}
    except (ValueError, TypeError, binascii.Error, UnidentifiedImageError, OSError, Image.DecompressionBombError):
        raise HTTPException(400, "Invalid image or image larger than 2 MB")

def parse_upload(data, filename):
    extension = Path(filename).suffix.lower()
    if extension in (".jpg", ".jpeg", ".png", ".webp", ".gif"):
        content = base64.b64encode(data).decode("ascii")
        part = image_part(content)
        return {"type": "image", "content": content, "filename": filename,
                "preview": filename, "url": f"data:{part['mime_type']};base64,{content}"}
    try:
        if extension == ".pdf":
            reader = PyPDF2.PdfReader(io.BytesIO(data))
            text = "\n".join(page.extract_text() or "" for page in reader.pages)
        elif extension in (".txt", ".md", ".py", ".js"):
            text = data.decode("utf-8-sig")
        else:
            raise HTTPException(415, "Unsupported file type")
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(400, "Cannot read this file. Use a text-based PDF or UTF-8 text.")
    if not text.strip():
        raise HTTPException(400, "No readable text found. Scanned PDFs require OCR.")
    if len(text) > 200000:
        raise HTTPException(413, "Document is too long (maximum 200,000 characters)")
    return {"type": "text", "content": text.strip(), "filename": filename, "preview": filename}

async def handle_file_upload(file: UploadFile):
    try:
        data = await file.read(MAX_UPLOAD + 1)
        if len(data) > MAX_UPLOAD:
            raise HTTPException(413, "Maximum upload size is 2 MB")
        return await asyncio.to_thread(parse_upload, data, file.filename or "upload")
    finally:
        await file.close()
