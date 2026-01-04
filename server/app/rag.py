import os
import asyncio
import httpx
from motor.motor_asyncio import AsyncIOMotorClient
from typing import List, Optional

MONGO_URL = os.getenv("MONGO_URI")
client = AsyncIOMotorClient(MONGO_URL)
db = client.ai_chat_db
vector_collection = db.vector_storage

HF_TOKEN = os.getenv("HF_API_KEY")
# Added explicit task routing to the URL to force Feature Extraction
EMBEDDING_MODEL_URL = "https://router.huggingface.co/hf-inference/models/sentence-transformers/all-MiniLM-L6-v2/pipeline/feature-extraction"

async def get_embedding(text: str):
    if not HF_TOKEN:
        print("[ERROR] HF_TOKEN missing in environment variables.")
        return None

    headers = {
        "Authorization": f"Bearer {HF_TOKEN}",
        "Content-Type": "application/json",
        "X-Wait-For-Model": "true"
    }
    
    # Payload is kept simple to avoid pipeline confusion
    payload = {"inputs": text}

    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(EMBEDDING_MODEL_URL, headers=headers, json=payload, timeout=30.0)
            
            if response.status_code == 200:
                result = response.json()
                # Handle nested list structure from feature-extraction
                if isinstance(result, list) and len(result) > 0:
                    if isinstance(result[0], list): return result[0]
                    return result
                return result
            else:
                print(f"[ERROR] HF Embedding failed: {response.status_code} - {response.text}")
                return None
    except Exception as e:
        print(f"[EXCEPTION] get_embedding: {e}")
        return None

async def add_to_vector_db(content: str, filename: str, session_id: str):
    chunks = [content[i:i+1000] for i in range(0, len(content), 800)]
    tasks = [process_and_save_chunk(chunk, filename, session_id, i) for i, chunk in enumerate(chunks)]
    await asyncio.gather(*tasks)

async def process_and_save_chunk(chunk: str, filename: str, session_id: str, index: int):
    embedding = await get_embedding(chunk)
    if embedding:
        doc = {
            "session_id": session_id,
            "filename": filename,
            "chunk_index": index,
            "content": chunk,
            "embedding": embedding
        }
        await vector_collection.insert_one(doc)
    else:
        print(f"[SKIP] Embedding failed for chunk {index}")

async def search_vector_db(session_id: str, query: str, top_k: int = 5):
    query_embedding = await get_embedding(query)
    if not query_embedding: return "RAG: Search skipped due to embedding error."
    
    pipeline = [
        {
            "$vectorSearch": {
                "index": "vector_index", 
                "path": "embedding",
                "queryVector": query_embedding,
                "numCandidates": 100,
                "limit": top_k,
                "filter": {"session_id": {"$eq": session_id}}
            }
        },
        {
            "$project": {
                "content": 1,
                "score": {"$meta": "vectorSearchScore"}
            }
        }
    ]
    
    results = []
    try:
        async for doc in vector_collection.aggregate(pipeline):
            results.append(doc["content"])
    except Exception as e:
        print(f"[MONGODB ERROR]: {e}")
        return None
    
    return "\n---\n".join(results) if results else "RAG: No relevant local documents found."