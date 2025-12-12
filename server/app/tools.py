import os
import httpx
import base64
from ddgs import DDGS

IMAGE_API_URL = "https://router.huggingface.co/models/stabilityai/stable-diffusion-xl-base-1.0"
HF_HEADERS = {"Authorization": f"Bearer {os.getenv('HF_API_KEY')}"}

def generate_image_tool(prompt: str):
    print(f"🎨 Generating Image for: {prompt}")
    try:
        with httpx.Client() as client:
            response = client.post(
                IMAGE_API_URL, 
                headers=HF_HEADERS, 
                json={"inputs": prompt}, 
                timeout=60.0
            )
            if response.status_code != 200:
                return f"Error: Image generation failed ({response.status_code})"
            
            image_data = base64.b64encode(response.content).decode("utf-8")
            return f"![Generated Image](data:image/jpeg;base64,{image_data})"
    except Exception as e:
        return f"Error creating image: {str(e)}"

def search_web_tool(query: str):
    print(f"🔍 Searching Web for: {query}")
    try:
        # 🟢 INCREASED RESULTS: Fetch 10 results instead of 5
        with DDGS() as ddgs:
            results = list(ddgs.text(query, max_results=10))
            
            if not results:
                print("❌ No results found from DDGS")
                return "No results found."
            
            summary = ""
            for r in results:
                summary += f"- Title: {r['title']}\n  Link: {r['href']}\n  Snippet: {r['body']}\n\n"
            
            print(f"✅ Found {len(results)} results")
            return summary

    except Exception as e:
        print(f"❌ Search Error: {str(e)}")
        return f"Search failed due to technical error: {str(e)}"