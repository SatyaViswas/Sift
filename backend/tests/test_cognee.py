import asyncio
import os
import cognee
from dotenv import load_dotenv

load_dotenv()
if os.getenv("LLM_API_KEY") and not os.getenv("GEMINI_API_KEY"):
    os.environ["GEMINI_API_KEY"] = os.getenv("LLM_API_KEY")

async def main():
    dataset_name = "test_dataset"
    print("Testing cognee remember without cognify...")
    await cognee.remember("I liked football and I play it every day.", dataset_name=dataset_name)
    
    print("Recalling without cognify...")
    result1 = await cognee.recall("football", datasets=[dataset_name])
    print(f"Result without cognify: {result1}")
    
    print("Running cognify...")
    try:
        if hasattr(cognee, "cognify"):
            await cognee.cognify()
            print("Cognify successful!")
        else:
            print("No cognify function.")
    except Exception as e:
        print(f"Cognify failed: {e}")
        
    print("Recalling after cognify...")
    result2 = await cognee.recall("football", datasets=[dataset_name])
    print(f"Result after cognify: {result2}")

if __name__ == "__main__":
    asyncio.run(main())
