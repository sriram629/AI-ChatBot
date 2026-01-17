import httpx
import os
from pydantic import EmailStr

async def send_otp_email(email: EmailStr, otp: str):
    print(email)
    url = "https://api.emailjs.com/api/v1.0/email/send"

    payload = {
        "service_id": os.getenv("EMAILJS_SERVICE_ID"),
        "template_id": os.getenv("EMAILJS_TEMPLATE_ID"),
        "user_id": os.getenv("EMAILJS_PUBLIC_KEY"),
        "accessToken": os.getenv("EMAILJS_PRIVATE_KEY"),
        "template_params": {
            "to_email": email,
            "otp": otp        
        }
    }

    async with httpx.AsyncClient() as client:
        response = await client.post(url, json=payload)
        
    if response.status_code == 200:
        print("Email sent successfully!")
    else:
        print(f"Failed to send email: {response.text}")