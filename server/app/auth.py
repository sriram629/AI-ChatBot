from datetime import datetime, timedelta
import secrets
import os
import httpx
from fastapi import APIRouter, HTTPException, Depends, status
from fastapi.security import OAuth2PasswordBearer
from passlib.context import CryptContext
from jose import jwt, JWTError
from pydantic import BaseModel, EmailStr, Field
from .models import User
from .email_service import send_otp_email

SECRET_KEY = os.getenv("SECRET_KEY")
if not SECRET_KEY or SECRET_KEY == "fallback_secret":
    raise RuntimeError("Set a private SECRET_KEY before starting the server")
ALGORITHM = os.getenv("ALGORITHM", "HS256")

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")
router = APIRouter()

class UserRegister(BaseModel):
    email: EmailStr
    password: str
    first_name: str
    last_name: str

class VerifyOTP(BaseModel):
    email: EmailStr
    otp: str = Field(pattern=r"^[0-9]{6}$")

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class OAuthLoginRequest(BaseModel):
    token: str = None
    code: str = None

class ResetPasswordRequest(BaseModel):
    email: EmailStr
    new_password: str | None = None

class ResetPasswordConfirm(BaseModel):
    email: EmailStr
    otp: str = Field(pattern=r"^[0-9]{6}$")
    new_password: str

class Resend_OTP(BaseModel):
    email: EmailStr

def get_password_hash(password):
    return pwd_context.hash(password)

def verify_password(plain, hashed):
    if not hashed or hashed == "oauth":
        return False
    return pwd_context.verify(plain, hashed)

ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def generate_otp():
    return str(secrets.randbelow(900000) + 100000)

async def get_current_user(token: str = Depends(oauth2_scheme)):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email = payload.get("sub")
        if email is None: raise HTTPException(status_code=401)
    except JWTError:
        raise HTTPException(status_code=401)
    
    user = await User.find_one(User.email == email)
    if not user: raise HTTPException(status_code=401)
    if not user.is_verified: raise HTTPException(status_code=403)
    return user

async def get_ws_user(token: str):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email = payload.get("sub")
        if email is None: return None
    except JWTError:
        return None
    
    user = await User.find_one(User.email == email)
    if user and not user.is_verified: return None
    return user

async def validate_otp(user, otp: str, purpose: str):
    if (not user or not user.otp_code or user.otp_purpose != purpose
            or not user.otp_expires_at or user.otp_expires_at <= datetime.utcnow()
            or user.otp_attempts >= 5):
        raise HTTPException(400, "Invalid or expired OTP. Request a new code.")
    if not secrets.compare_digest(user.otp_code, otp):
        await user.inc({User.otp_attempts: 1})
        raise HTTPException(400, "Invalid OTP")


@router.post("/register", tags=["Authentication"])
async def register(user_data: UserRegister):
    if await User.find_one(User.email == user_data.email):
        raise HTTPException(status_code=400, detail="Email already registered")
    
    otp = generate_otp()
    new_user = User(
        email=user_data.email,
        hashed_password=get_password_hash(user_data.password),
        first_name=user_data.first_name,
        last_name=user_data.last_name,
        is_verified=False,
        otp_code=otp,
        otp_purpose="verification",
        otp_expires_at=datetime.utcnow() + timedelta(minutes=10)
    )
    await new_user.insert()
    
    try:
        print("user:", user_data.email)
        await send_otp_email(user_data.email, otp)
    except Exception as e:
        print(f"EMAIL ERROR: {e}")
        await new_user.delete()
        raise HTTPException(status_code=500, detail="Failed to send email.")
        
    return {"message": "OTP sent"}

@router.post("/verify-email", tags=["Authentication"])
async def verify_email(data: VerifyOTP):
    user = await User.find_one(User.email == data.email)
    if not user: raise HTTPException(400, "User not found")
    
    await validate_otp(user, data.otp, "verification")
    
    user.is_verified = True
    user.otp_code = None
    user.otp_purpose = None
    user.otp_expires_at = None
    await user.save()
    
    token = create_access_token({"sub": user.email})
    return {"access_token": token, "token_type": "bearer"}

@router.post("/login", tags=["Authentication"])
async def login(data: LoginRequest):
    user = await User.find_one(User.email == data.email)
    if not user or not verify_password(data.password, user.hashed_password):
        raise HTTPException(400, "Invalid credentials")
    
    if not user.is_verified:
        raise HTTPException(403, "Email not verified")
        
    token = create_access_token({"sub": user.email})
    return {"access_token": token, "token_type": "bearer"}

@router.post("/resend-otp", tags=["Authentication"])
async def resend_otp(data: Resend_OTP):
    user = await User.find_one(User.email == data.email)
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if user.is_verified:
        return {"message": "Email already verified"}
    new_otp = generate_otp()
    user.otp_code = new_otp
    user.otp_purpose = "verification"
    user.otp_attempts = 0
    user.otp_expires_at = datetime.utcnow() + timedelta(minutes=10)
    await user.save()
    
    try:
        await send_otp_email(user.email, new_otp)
    except Exception as e:
        print(f"RESEND EMAIL ERROR: {e}")
        raise HTTPException(status_code=500, detail="Failed to send email.")
        
    return {"message": "A new OTP has been sent to your email"}

@router.post("/forgot-password", tags=["Authentication"])
async def forgot_password(data: ResetPasswordRequest):
    user = await User.find_one(User.email == data.email)
    if user:
        otp = generate_otp()
        user.otp_code = otp
        user.otp_purpose = "password_reset"
        user.otp_attempts = 0
        user.otp_expires_at = datetime.utcnow() + timedelta(minutes=10)
        await user.save()
        try:
            await send_otp_email(data.email, otp)
        except:
            pass
    return {"message": "OTP sent if email exists"}

@router.post("/reset-password-confirm", tags=["Authentication"])
async def reset_password_confirm(data: ResetPasswordConfirm):
    user = await User.find_one(User.email == data.email)
    await validate_otp(user, data.otp, "password_reset")
        
    user.hashed_password = get_password_hash(data.new_password)
    user.otp_code = None
    user.otp_purpose = None
    user.otp_expires_at = None
    await user.save()
    return {"message": "Password updated"}


@router.post("/google", tags=["OAuth"])
async def google_login(data: OAuthLoginRequest):
    async with httpx.AsyncClient() as client:
        resp = await client.get("https://www.googleapis.com/oauth2/v3/userinfo", headers={"Authorization": f"Bearer {data.token}"})
        user_info = resp.json()

    if not user_info.get("email_verified") or "email" not in user_info: raise HTTPException(400, "Invalid Google Token")
    email = user_info["email"]
    
    user = await User.find_one(User.email == email)
    if not user:
        user = User(
            email=email, 
            hashed_password="oauth", 
            first_name=user_info.get("given_name",""), 
            last_name=user_info.get("family_name",""), 
            is_verified=True
        )
        await user.insert()
    elif not user.is_verified:
        user.is_verified = True
        await user.save()
    
    token = create_access_token({"sub": user.email})
    return {"access_token": token, "token_type": "bearer"}

@router.post("/github", tags=["OAuth"])
async def github_login(data: OAuthLoginRequest):
    async with httpx.AsyncClient() as client:
        token_resp = await client.post("https://github.com/login/oauth/access_token", 
            headers={"Accept": "application/json"},
            json={
                "client_id": os.getenv("GITHUB_CLIENT_ID"), 
                "client_secret": os.getenv("GITHUB_CLIENT_SECRET"), 
                "code": data.code
            }
        )
        token_json = token_resp.json()
        gh_token = token_json.get("access_token")
        
        if not gh_token: raise HTTPException(400, "Invalid GitHub Code")

        headers = {"Authorization": f"Bearer {gh_token}", "User-Agent": "AI-Chatbot"}
        
        email_resp = await client.get("https://api.github.com/user/emails", headers=headers)
        if email_resp.status_code != 200: raise HTTPException(400, "Failed to fetch GitHub emails")
        
        primary_email = next((e['email'] for e in email_resp.json() if e['primary'] and e.get('verified')), None)
        if not primary_email: raise HTTPException(400, "No email found")

        user_resp = await client.get("https://api.github.com/user", headers=headers)
        user_json = user_resp.json()
        name_parts = (user_json.get("name") or "GitHub User").split(" ")
    
    user = await User.find_one(User.email == primary_email)
    if not user:
        user = User(
            email=primary_email, 
            hashed_password="oauth", 
            first_name=name_parts[0], 
            last_name=" ".join(name_parts[1:]), 
            is_verified=True
        )
        await user.insert()
    elif not user.is_verified:
        user.is_verified = True
        await user.save()
        
    token = create_access_token({"sub": user.email})
    return {"access_token": token, "token_type": "bearer"}

@router.get("/me", tags=["Authentication"])
async def read_users_me(user: User = Depends(get_current_user)):
    return {"email": user.email, "first_name": user.first_name,
            "last_name": user.last_name, "is_verified": user.is_verified,
            "is_active": user.is_active}
