import asyncio
import os
import cognee
from dotenv import load_dotenv
import time

load_dotenv()
if os.getenv("LLM_API_KEY") and not os.getenv("GEMINI_API_KEY"):
    os.environ["GEMINI_API_KEY"] = os.getenv("LLM_API_KEY")

async def main():
    dataset_name = "user_default_user"
    print("Forgetting memory only...")
    start = time.time()
    await cognee.forget(dataset=dataset_name, memory_only=True)
    print(f"Memory wiped in {time.time() - start:.2f}s")
    
    print("Re-cognifying dataset...")
    start = time.time()
    await cognee.cognify(datasets=[dataset_name])
    print(f"Rebuilt graph in {time.time() - start:.2f}s")

if __name__ == "__main__":
    asyncio.run(main())
