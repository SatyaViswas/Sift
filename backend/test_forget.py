import asyncio
import os
import cognee
from dotenv import load_dotenv
import inspect

load_dotenv()
if os.getenv("LLM_API_KEY") and not os.getenv("GEMINI_API_KEY"):
    os.environ["GEMINI_API_KEY"] = os.getenv("LLM_API_KEY")

async def main():
    print("Testing cognee forget...")
    if hasattr(cognee, "forget"):
        print("cognee.forget signature:")
        print(inspect.signature(cognee.forget))
    else:
        print("cognee.forget not found.")

if __name__ == "__main__":
    asyncio.run(main())
