import asyncio
import time
import os
import cognee

from dotenv import load_dotenv
load_dotenv()

if os.getenv("LLM_API_KEY") and not os.getenv("GEMINI_API_KEY"):
    os.environ["GEMINI_API_KEY"] = os.getenv("LLM_API_KEY")

os.environ["LLM_PROVIDER"] = "gemini"
os.environ["EMBEDDING_PROVIDER"] = "gemini"
os.environ["EMBEDDING_MODEL"] = "gemini/gemini-embedding-001"
os.environ["LLM_MODEL"] = "gemini/gemini-3.1-flash-lite"

async def test():
    print("Testing cognee recall speed...")
    start = time.time()
    try:
        res = await cognee.recall("What choices, habits, or preferences matter most to this user?", datasets=["user_2852304f-3a37-4238-91f3-de7a56759fde"], only_context=True, top_k=15)
        print(f"Recall 1 finished in {time.time() - start:.2f} seconds")
    except Exception as e:
        print("Recall 1 error:", e)

    start = time.time()
    try:
        res = await cognee.recall("Comprehensive history of [Classification: UserSlateEntry], diary entries, watched media, preferences, and life logs.", datasets=["user_2852304f-3a37-4238-91f3-de7a56759fde"], only_context=True, top_k=15)
        print(f"Recall 2 finished in {time.time() - start:.2f} seconds")
    except Exception as e:
        print("Recall 2 error:", e)

asyncio.run(test())
