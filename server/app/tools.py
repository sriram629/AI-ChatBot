import urllib.parse
import random
from ddgs import DDGS


def search_web_tool(query: str):
    print(f"Searching Web for: {query}")
    try:
        results = DDGS().text(query, max_results=4)

        if not results:
            return "No results found."

        formatted = ""
        for r in results:
            formatted += (
                f"- {r.get('title', 'No title')}: "
                f"{r.get('body', 'No description')} "
                f"(Source: {r.get('href', 'N/A')})\n"
            )

        return formatted

    except Exception as e:
        print(f"Search Warning: {e}")
        return "Couldn't search the web right now."


def generate_image_tool(prompt: str):
    print(f"Generating Image for: {prompt}")
    try:
        clean_prompt = prompt.replace('"', "").replace("'", "")
        encoded_prompt = urllib.parse.quote(clean_prompt)
        seed = random.randint(0, 100000)

        image_url = (
            "https://image.pollinations.ai/prompt/"
            f"{encoded_prompt}?seed={seed}&nologo=true&width=1024&height=768"
        )

        return f"![Generated Image]({image_url})"

    except Exception as e:
        return f"Image Generation failed: {str(e)}"
