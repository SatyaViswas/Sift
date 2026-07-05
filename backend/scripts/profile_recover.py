import asyncio
import time
import os
import json
from litellm import acompletion
from supabase import create_client, ClientOptions

from dotenv import load_dotenv
load_dotenv()

if os.getenv("LLM_API_KEY") and not os.getenv("GEMINI_API_KEY"):
    os.environ["GEMINI_API_KEY"] = os.getenv("LLM_API_KEY")

os.environ["LLM_PROVIDER"] = "gemini"
os.environ["EMBEDDING_PROVIDER"] = "gemini"
os.environ["EMBEDDING_MODEL"] = "gemini/gemini-embedding-001"
os.environ["LLM_MODEL"] = "gemini/gemini-3.1-flash-lite"

import cognee

profile = "2852304f-3a37-4238-91f3-de7a56759fde" # use the user's profile
query = "what are patterns you observed from day 1?"

async def test_timing():
    print("Starting timing test...")
    
    # 1. Supabase Fetch
    t0 = time.time()
    sb = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_ANON_KEY"])
    timeline_res = sb.table("journal_slates")\
        .select("created_at, content")\
        .eq("profile_id", profile)\
        .order("created_at", desc=True)\
        .limit(10000)\
        .execute()
    t1 = time.time()
    print(f"Supabase fetch took {t1-t0:.2f}s, found {len(timeline_res.data)} records")
    
    # 2. String processing
    filtered_full_timeline = []
    for item in reversed(timeline_res.data):
        date_str = item["created_at"].split("T")[0]
        filtered_full_timeline.append(f"[{date_str}] {item['content']}")
    full_timeline_str = "\n".join(filtered_full_timeline) if filtered_full_timeline else "None"
    t2 = time.time()
    print(f"Timeline string building took {t2-t1:.2f}s")
    
    # 3. Cognee specific
    dataset_name = f"user_{profile}"
    try:
        context_specific = await cognee.recall(query, datasets=[dataset_name], only_context=True, top_k=15)
    except Exception as e:
        context_specific = str(e)
    t3 = time.time()
    print(f"Cognee recall (specific) took {t3-t2:.2f}s")
    
    # 4. Cognee broad
    target_broad = "Comprehensive analysis of behavior, recurring thoughts, choices, emotional blocks, and routines."
    try:
        context_broad = await cognee.recall(target_broad, datasets=[dataset_name], only_context=True, top_k=15)
    except Exception as e:
        context_broad = str(e)
    t4 = time.time()
    print(f"Cognee recall (broad) took {t4-t3:.2f}s")
    
    # 5. LLM
    print("Starting LLM generation...")
    system_prompt = "You are a personal journal assistant."
    user_prompt = f"<CONTEXT_DATA>\n<FULL_TIMELINE_FROM_DAY_1>\n{full_timeline_str}\n</FULL_TIMELINE_FROM_DAY_1>\n</CONTEXT_DATA>\n{query}"
    
    try:
        llm_response = await acompletion(
            model=os.environ["LLM_MODEL"],
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            temperature=0.1
        )
        print("LLM length:", len(llm_response.choices[0].message.content))
    except Exception as e:
        print("LLM error:", e)
    t5 = time.time()
    print(f"LLM call took {t5-t4:.2f}s")
    print(f"TOTAL TIME: {t5-t0:.2f}s")

asyncio.run(test_timing())
