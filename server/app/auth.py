from datetime import datetime, timedelta
import random
import os
import httpx
from fastapi import APIRouter, HTTPException, Depends, status
from fastapi.security import OAuth2PasswordBearer
from passlib.context import CryptContext
from jose import jwt, JWTError
from pydantic import BaseModel, EmailStr
from .models import User
from .email_service import send_otp_email

SECRET_KEY = os.getenv("SECRET_KEY", "fallback_secret")
ALGORITHM = os.getenv("ALGORITHM", "HS256")

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")
router = APIRouter()

# --- SCHEMAS ---
class UserRegister(BaseModel):
    email: EmailStr
    password: str
    first_name: str
    last_name: str

class VerifyOTP(BaseModel):
    email: EmailStr
    otp: str

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class OAuthLoginRequest(BaseModel):
    token: str = None
    code: str = None

class ResetPasswordRequest(BaseModel):
    email: EmailStr
    new_password: str

class ResetPasswordConfirm(BaseModel):
    email: EmailStr
    otp: str
    new_password: str

# --- HELPERS ---
def get_password_hash(password):
    return pwd_context.hash(password)

def verify_password(plain, hashed):
    return pwd_context.verify(plain, hashed)

ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def generate_otp():
    return str(random.randint(100000, 999999))

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

# --- AUTHENTICATION ENDPOINTS ---

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
        otp_expires_at=datetime.utcnow() + timedelta(minutes=10)
    )
    await new_user.insert()
    
    try:
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
    
    if user.otp_code != data.otp: raise HTTPException(400, "Invalid OTP")
    
    user.is_verified = True
    user.otp_code = None
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

@router.post("/forgot-password", tags=["Authentication"])
async def forgot_password(data: ResetPasswordRequest):
    user = await User.find_one(User.email == data.email)
    if user:
        otp = generate_otp()
        user.otp_code = otp
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
    if not user or user.otp_code != data.otp:
        raise HTTPException(400, "Invalid OTP")
        
    user.hashed_password = get_password_hash(data.new_password)
    user.otp_code = None
    await user.save()
    return {"message": "Password updated"}

# --- OAUTH ENDPOINTS ---

@router.post("/google", tags=["OAuth"])
async def google_login(data: OAuthLoginRequest):
    async with httpx.AsyncClient() as client:
        resp = await client.get("https://www.googleapis.com/oauth2/v3/userinfo", headers={"Authorization": f"Bearer {data.token}"})
        user_info = resp.json()

    if "email" not in user_info: raise HTTPException(400, "Invalid Google Token")
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
        
        primary_email = next((e['email'] for e in email_resp.json() if e['primary']), None)
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
    return user