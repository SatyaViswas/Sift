import asyncio
import os
import cognee
from dotenv import load_dotenv

load_dotenv()
if os.getenv("LLM_API_KEY") and not os.getenv("GEMINI_API_KEY"):
    os.environ["GEMINI_API_KEY"] = os.getenv("LLM_API_KEY")

async def main():
    print("Testing cognee remember return value...")
    dataset_name = "test_dataset_return"
    try:
        res = await cognee.remember("Just a test memory.", dataset_name=dataset_name)
        print("Return value:", res)
        print("Type:", type(res))
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(main())
