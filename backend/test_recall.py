import asyncio
import os
import cognee
from cognee.api.v1.search import SearchType

os.environ["GEMINI_API_KEY"] = "fake_key"
os.environ["OPENAI_API_KEY"] = "fake_key"
os.environ["LLM_PROVIDER"] = "gemini"
os.environ["EMBEDDING_PROVIDER"] = "gemini"

async def test():
    await cognee.add("Hello world", dataset_name="test_only_context")
    await cognee.cognify(datasets=["test_only_context"])
    try:
        res = await cognee.recall("Hello", datasets=["test_only_context"], query_type=SearchType.GRAPH_COMPLETION, only_context=True)
        print("Success! Result:", res)
    except Exception as e:
        print("Error:", e)

asyncio.run(test())
