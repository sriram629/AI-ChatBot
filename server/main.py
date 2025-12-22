from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
from dotenv import load_dotenv
import os
import shutil

from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

load_dotenv()

from app.database import init_db
from app import auth, chat

limiter = Limiter(key_func=get_remote_address)

if not os.path.exists("temp_uploads"):
    os.makedirs("temp_uploads")

@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    print("✅ Database Connected")
    
    yield
    
    if os.path.exists("temp_uploads"):
        shutil.rmtree("temp_uploads")
        print("🧹 Cleaned up temporary files")

app = FastAPI(lifespan=lifespan)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

allowed_hosts = os.getenv("ALLOWED_HOSTS", "localhost,127.0.0.1").split(",")
app.add_middleware(TrustedHostMiddleware, allowed_hosts=allowed_hosts)

origins = os.getenv("FRONTEND_URL", "http://localhost:5173").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response: Response = await call_next(request)
    response.headers["X-Frame-Options"] = "DENY" 
    response.headers["X-Content-Type-Options"] = "nosniff" 
    response.headers["X-XSS-Protection"] = "1; mode=block" 
    return response

app.mount("/static", StaticFiles(directory="temp_uploads"), name="static")

app.include_router(auth.router, prefix="/api/auth")
app.include_router(chat.router, prefix="/api/chat")

@app.get("/")
@limiter.limit("5/minute")
def home(request: Request):
    return {"message": "AI Chatbot API Secure & Running"}