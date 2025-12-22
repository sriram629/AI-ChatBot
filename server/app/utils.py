import os
import cloudinary
import cloudinary.uploader
from fastapi import UploadFile
import PyPDF2

cloudinary.config( 
  cloud_name = os.getenv("CLOUDINARY_CLOUD_NAME"), 
  api_key = os.getenv("CLOUDINARY_API_KEY"), 
  api_secret = os.getenv("CLOUDINARY_API_SECRET"),
  secure = True
)

async def handle_file_upload(file: UploadFile):
    extension = file.filename.split(".")[-1].lower()
    
    if extension in ["jpg", "jpeg", "png", "webp", "gif"]:
        try:
            upload_result = cloudinary.uploader.upload(file.file, folder="ai_chat_uploads")
            return {
                "type": "image",
                "url": upload_result["secure_url"],
                "filename": file.filename,
                "file_path": None
            }
        except Exception as e:
            return {"error": f"Cloud Upload Failed: {str(e)}"}

    elif extension == "pdf":
        text_content = ""
        try:
            pdf_reader = PyPDF2.PdfReader(file.file)
            for page in pdf_reader.pages:
                text = page.extract_text()
                if text:
                    text_content += text + "\n"
        except Exception as e:
            return {"error": f"PDF Read Error: {str(e)}"}
            
        return {
            "type": "text",
            "content": text_content.strip(),
            "filename": file.filename,
            "preview": f"PDF: {file.filename}"
        }
        
    return {"error": "Unsupported file type"}

def get_image_object(file_path_or_url):
    return None