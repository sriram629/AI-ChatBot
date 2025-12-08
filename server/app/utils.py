import os
import shutil
from pathlib import Path
from fastapi import UploadFile
import PyPDF2
from PIL import Image

UPLOAD_DIR = Path("temp_uploads")
UPLOAD_DIR.mkdir(exist_ok=True)

async def handle_file_upload(file: UploadFile):
    extension = file.filename.split(".")[-1].lower()
    safe_filename = file.filename.replace(" ", "_")
    file_path = UPLOAD_DIR / safe_filename
    
    if extension in ["jpg", "jpeg", "png", "webp"]:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        return {
            "type": "image",
            "file_path": str(file_path),
            "filename": safe_filename,
            "preview": f"Image: {file.filename}"
        }

    elif extension == "pdf":
        text_content = ""
        try:
            pdf_reader = PyPDF2.PdfReader(file.file)
            for page in pdf_reader.pages:
                text_content += page.extract_text() + "\n"
        except Exception as e:
            return {"error": f"Failed to read PDF: {str(e)}"}
            
        return {
            "type": "text",
            "content": text_content.strip(),
            "filename": safe_filename,
            "preview": f"PDF: {file.filename} ({len(text_content)} chars)"
        }
    
    elif extension in ["txt", "md", "py", "js", "json"]:
        content = (await file.read()).decode("utf-8")
        return {
            "type": "text",
            "content": content,
            "filename": safe_filename,
            "preview": f"File: {file.filename}"
        }

    else:
        return {"error": "Unsupported file type"}

def get_image_object(file_path: str):
    try:
        return Image.open(file_path)
    except:
        return None