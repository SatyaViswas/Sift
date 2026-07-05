import asyncio
import os
import cognee

os.environ["GEMINI_API_KEY"] = "fake_key"
os.environ["OPENAI_API_KEY"] = "fake_key"
os.environ["LLM_PROVIDER"] = "gemini"
os.environ["EMBEDDING_PROVIDER"] = "gemini"

async def test():
    try:
        res = await cognee.recall("Hello", datasets=["test_only_context"], only_context=True, top_k=50)
        print("Success!")
    except Exception as e:
        print("Error:", e)

asyncio.run(test())
