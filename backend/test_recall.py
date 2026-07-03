import asyncio
import os
import cognee
from dotenv import load_dotenv

load_dotenv()
if os.getenv("LLM_API_KEY") and not os.getenv("GEMINI_API_KEY"):
    os.environ["GEMINI_API_KEY"] = os.getenv("LLM_API_KEY")

async def main():
    dataset_name = "user_default_user"
    res = await cognee.recall("pickel ball", datasets=[dataset_name])
    print(res)

if __name__ == "__main__":
    asyncio.run(main())
