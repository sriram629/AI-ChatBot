import os
import google.generativeai as genai
from pymongo import MongoClient

if os.getenv("GOOGLE_API_KEY"):
    genai.configure(api_key=os.getenv("GOOGLE_API_KEY"))

try:
    mongo_url = os.getenv("MONGO_URI") or os.getenv("MONGO_URL")
    mongo_client = MongoClient(mongo_url)
    db = mongo_client["chatdb"]
    collection = db["rag_vectors"]
except Exception:
    mongo_client = None
    collection = None

def get_gemini_embedding(text: str):
    clean_text = text.replace("\n", " ")
    try:
        result = genai.embed_content(
            model="models/text-embedding-004",
            content=clean_text,
            task_type="retrieval_document"
        )
        return result['embedding']
    except Exception as e:
        print(f"Embedding Error: {e}")
        return []

def add_to_vector_db(text: str, filename: str):
    if not collection:
        return

    print(f"Indexing {filename} in MongoDB...")
    
    chunk_size = 1000
    overlap = 100
    chunks = []
    start = 0
    while start < len(text):
        end = start + chunk_size
        chunks.append(text[start:end])
        start += chunk_size - overlap

    documents = []
    for chunk in chunks:
        vector = get_gemini_embedding(chunk)
        if vector:
            documents.append({
                "text": chunk,
                "source": filename,
                "embedding": vector
            })

    if documents:
        try:
            collection.insert_many(documents)
            print(f"Successfully indexed {len(documents)} chunks.")
        except Exception as e:
            print(f"MongoDB Upload Error: {e}")

def search_vector_db(query: str):
    if not collection:
        return None

    try:
        query_vector = genai.embed_content(
            model="models/text-embedding-004",
            content=query,
            task_type="retrieval_query"
        )['embedding']
        
        pipeline = [
            {
                "$vectorSearch": {
                    "index": "vector_index",
                    "path": "embedding",
                    "queryVector": query_vector,
                    "numCandidates": 100,
                    "limit": 3
                }
            },
            {
                "$project": {
                    "_id": 0,
                    "text": 1,
                    "source": 1,
                    "score": { "$meta": "vectorSearchScore" }
                }
            }
        ]
        
        results = list(collection.aggregate(pipeline))
        
        context = ""
        for res in results:
            if res.get('score', 0) > 0.6:
                context += f"---\n[Source: {res['source']}]\n{res['text']}\n"
                
        return context if context else None

    except Exception as e:
        print(f"Search Error: {e}")
        return None