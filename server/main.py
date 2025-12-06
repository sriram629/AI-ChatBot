from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from dotenv import load_dotenv

load_dotenv()

from app.database import init_db
from app import auth, chat

@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    print("✅ Database Connected")
    yield

app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/auth")
app.include_router(chat.router, prefix="/api/chat")

@app.get("/")
def home():
    return {"message": "AI Chatbot API Running"}