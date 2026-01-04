import os
import asyncio
import uuid
import httpx
import random
import urllib.parse
from ddgs import DDGS

async def search_google_serper(query: str):
    url = "https://google.serper.dev/search"
    api_key = os.getenv("SERPER_API_KEY")
    if not api_key:
        return "Google Search Error: Missing SERPER_API_KEY"
    headers = {"X-API-KEY": api_key, "Content-Type": "application/json"}
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(url, json={"q": query}, headers=headers, timeout=10.0)
            response.raise_for_status()
            data = response.json()
        results = data.get("organic", [])[:3]
        if not results: return "Google: No results found."
        return "\n".join(f"- {r.get('title')}: {r.get('snippet')} (Source: {r.get('link')})" for r in results)
    except Exception as e:
        return f"Google Search Error: {str(e)}"

async def search_ddg_async(query: str):
    def _search():
        with DDGS() as ddgs:
            return list(ddgs.text(query, max_results=3))
    try:
        results = await asyncio.to_thread(_search)
        if not results: return "DuckDuckGo: No results found."
        return "\n".join(f"- {r.get('title')}: {r.get('body')} (Source: {r.get('href')})" for r in results)
    except Exception as e:
        return f"DuckDuckGo Error: {str(e)}"

async def search_web_consensus(query: str):
    google_res, ddg_res = await asyncio.gather(
        search_google_serper(query),
        search_ddg_async(query),
        return_exceptions=True
    )
    return f"### GOOGLE\n{google_res}\n\n### DUCKDUCKGO\n{ddg_res}"

AI_HORDE_API_KEY = "0000000000"
BASE_URL = "https://stablehorde.net/api/v2"

HEADERS = {
    "apikey": AI_HORDE_API_KEY,
    "Content-Type": "application/json",
    "Accept": "application/json",
    "Client-Agent": "MyChatbot:1.0 (free-image-tool)",
    "User-Agent": "MyChatbot/1.0",
}

async def generate_image_tool(prompt: str) -> str | None:
    print("[AI-HORDE] Starting image generation")
    start_time = asyncio.get_event_loop().time()
    timeout_limit = 120  # Strict 2 minute limit

    try:
        async with httpx.AsyncClient(timeout=60) as client:
            try:
                submit = await client.post(
                    f"{BASE_URL}/generate/async",
                    headers=HEADERS,
                    json={
                        "prompt": prompt,
                        "params": {
                            "width": 576,
                            "height": 576,
                            "steps": 20,
                            "sampler_name": "k_euler",
                        },
                    },
                )
                submit.raise_for_status()
                job_id = submit.json().get("id")
                if not job_id:
                    return "I am unable to start the image generation right now."
            except Exception as e:
                print(f"[AI-HORDE][ERROR] Submission failed: {e}")
                return "The image generation service is currently unavailable."

            while (asyncio.get_event_loop().time() - start_time) < timeout_limit:
                try:
                    status = await client.get(
                        f"{BASE_URL}/generate/status/{job_id}",
                        headers=HEADERS,
                    )

                    if status.status_code == 429:
                        await asyncio.sleep(10)
                        continue

                    status.raise_for_status()
                    data = status.json()

                    if data.get("done"):
                        generations = data.get("generations", [])
                        if generations and generations[0].get("img"):
                            image_url = generations[0].get("img")
                            return f"![Generated Image]({image_url})"
                        return "Generation complete, but no image was found."

                    await asyncio.sleep(5)

                except Exception as e:
                    print(f"[AI-HORDE][ERROR] Polling error: {e}")
                    await asyncio.sleep(5)

            return "Image generation timed out after 2 minutes. The queue is currently too long."

    except Exception as global_e:
        print(f"[CRITICAL ERROR] {global_e}")
        return "An unexpected error occurred during image generation."