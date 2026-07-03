import asyncio
import os
import cognee
from dotenv import load_dotenv

load_dotenv()
if os.getenv("LLM_API_KEY") and not os.getenv("GEMINI_API_KEY"):
    os.environ["GEMINI_API_KEY"] = os.getenv("LLM_API_KEY")

async def main():
    dataset_name = "user_default_user"
    try:
        # We need to find the raw data chunks
        results = await cognee.search("CHUNKS", "pickel ball", datasets=[dataset_name])
        for r in results:
            print(f"Chunk: {r}")
            
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(main())
