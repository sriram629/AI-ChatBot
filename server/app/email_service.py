from fastapi_mail import FastMail, MessageSchema, ConnectionConfig, MessageType
from pydantic import EmailStr
import os
from dotenv import load_dotenv

load_dotenv()

conf = ConnectionConfig(
    MAIL_USERNAME=os.getenv("MAIL_USERNAME"),
    MAIL_PASSWORD=os.getenv("MAIL_PASSWORD"),
    MAIL_FROM=os.getenv("MAIL_FROM"),
    MAIL_PORT=int(os.getenv("MAIL_PORT", 587)),
    MAIL_SERVER=os.getenv("MAIL_SERVER", "smtp.gmail.com"),
    MAIL_STARTTLS=True, 
    MAIL_SSL_TLS=False, 
    USE_CREDENTIALS=True,
    VALIDATE_CERTS=False
)

html_template = """
<!DOCTYPE html>
<html>
<head>
<style>
    body {{ font-family: Arial, sans-serif; background-color: #f4f4f4; padding: 20px; }}
    .container {{ max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 0 10px rgba(0,0,0,0.1); }}
    .header {{ text-align: center; margin-bottom: 20px; }}
    .code {{ font-size: 32px; font-weight: bold; color: #0ea5e9; letter-spacing: 5px; text-align: center; margin: 20px 0; }}
    .footer {{ text-align: center; font-size: 12px; color: #888; margin-top: 20px; }}
</style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h2>Verify Your Account</h2>
        </div>
        <p>Hello,</p>
        <p>Thank you for registering with AI Chat. Please use the verification code below to complete your registration:</p>
        <div class="code">{otp}</div>
        <p>This code will expire in 10 minutes.</p>
        <div class="footer">
            If you didn't request this, please ignore this email.
        </div>
    </div>
</body>
</html>
"""

async def send_otp_email(email: EmailStr, otp: str):
    message = MessageSchema(
        subject="Your Verification Code",
        recipients=[email],
        body=html_template.format(otp=otp),
        subtype=MessageType.html
    )

    fm = FastMail(conf)
    await fm.send_message(message)