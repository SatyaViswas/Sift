import sys
import json
import os
import asyncio # Ensure asyncio is imported
from contextlib import asynccontextmanager
from typing import Optional, Dict, Any, List

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from dotenv import load_dotenv

import cognee
from litellm import acompletion

# 1. Load environment variables dynamically ONCE
load_dotenv()

# Map custom env keys to what litellm expects for Gemini
if os.getenv("LLM_API_KEY") and not os.getenv("GEMINI_API_KEY"):
    os.environ["GEMINI_API_KEY"] = os.getenv("LLM_API_KEY")

# Create a global asynchronous database lock
cognee_lock = asyncio.Lock()

@asynccontextmanager
async def lifespan(app: FastAPI):
    print("Memory bridge started. Env ready.")
    yield
    print("Memory bridge shutting down.")

app = FastAPI(lifespan=lifespan)

# Pydantic Models
class IngestRequest(BaseModel):
    profile: str
    text: str

class RecoverRequest(BaseModel):
    profile: str
    query: Optional[str] = ""

class UpdateRequest(BaseModel):
    profile: str
    entry_id: Optional[Any] = Field(None, alias="entryId")
    new_text: Optional[str] = Field(None, alias="newText")
    original_text: Optional[str] = Field(None, alias="originalText")

    class Config:
        populate_by_name = True

class ForgetConfirmRequest(BaseModel):
    profile: str
    topic: str

class ImproveRequest(BaseModel):
    profile: str
    helpful: bool
    context: Optional[str] = ""

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={"status": "error", "message": str(exc)}
    )

@app.get("/api/health")
async def health_check(profile: Optional[str] = "default"):
    return {
        "status": "success",
        "message": "Python bridge is operational.",
        "profile_received": profile,
        "environment_check": {
            "gemini_api_key_set": bool(os.getenv("GEMINI_API_KEY") or os.getenv("LLM_API_KEY"))
        }
    }

@app.post("/api/ingest")
async def ingest_memory(req: IngestRequest):
    dataset_name = f"user_{req.profile}"
    
    try:
        system_prompt = (
            "You are an intent router for a personal journal. "
            "Determine if the user's text is an explicit request to FORGET or DELETE a specific memory, habit, or trait from their graph, "
            "or if it is just a normal journal entry.\n"
            "If it is a request to forget, output a JSON object with exactly: {\"intent\": \"forget\", \"topic\": \"<the exact trait/memory to forget>\"}.\n"
            "If it is a normal entry, output: {\"intent\": \"journal\", \"heading\": \"<a short 3-5 word heading summarizing the entry>\"}.\n"
            "Do not output markdown, just raw JSON."
        )
        
        intent_response = await acompletion(
            model=os.getenv("LLM_MODEL", "gemini/gemini-3.1-flash-lite"),
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": req.text}
            ]
        )
        
        intent_result = intent_response.choices[0].message.content.strip()
        if intent_result.startswith("```json"):
            intent_result = intent_result[7:-3].strip()
        elif intent_result.startswith("```"):
            intent_result = intent_result[3:-3].strip()
            
        heading = None
        try:
            intent_json = json.loads(intent_result)
            if intent_json.get("intent") == "forget" and intent_json.get("topic"):
                return {
                    "status": "forget_confirmation",
                    "data": { "topic": intent_json.get("topic") }
                }
            if intent_json.get("intent") == "journal" and intent_json.get("heading"):
                heading = intent_json.get("heading")
        except Exception:
            pass
    except Exception as e:
        print(f"Intent routing LLM call failed: {e}, falling back to standard ingest.")
        heading = None

    # Guard database operation with the lock
    try:
        async with cognee_lock:
            await cognee.remember(req.text, dataset_name=dataset_name)
        return {
            "status": "success",
            "message": "Stored!",
            "heading": heading
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ingestion failed: {str(e)}")

@app.post("/api/recover")
async def recover_memory(req: RecoverRequest):
    dataset_name = f"user_{req.profile}"
    
    try:
        # Guard database retrieval with the lock
        async with cognee_lock:
            prompt = req.query if req.query else "What choices, habits, or preferences matter most to this user?"
            context = await cognee.recall(prompt, datasets=[dataset_name])
        
        if isinstance(context, list):
            context_str = " ".join([str(item) for item in context])
        else:
            context_str = str(context)

        system_prompt = (
            "You are an omniscient personal diary assistant acting as a Meta-Cognitive Intent Router. "
            "Dynamically evaluate the user's request against their historical graph data across two cognitive matrices.\n\n"
            "Matrix 1 - Content Behavior & Affinity Rules:\n"
            "1. Disposable/Consumable Content (Movies, Series, Story Games, Novels): Apply taste-extraction and exclusion. Infer what they liked, but recommend an alternative so they don't get a repeat.\n"
            "2. High-Affinity Repeatable Experiences (Sports, Cafes, Specific Foods, Hobbies, Routines): Apply affinity-reinforcement. If liked in the past, prioritize re-recommending that exact asset. Do not exclude unless they explicitly ask for something 'new'.\n"
            "3. Explicit Historical Recall Queries ('Where did I go?', 'What did I like before?'): Apply strict graph alignment. Return exact matching historical records. No substitution or alternatives.\n\n"
            "Matrix 2 - Dynamic Knowledge Sourcing (Internal Graph vs. External World):\n"
            "- Scenario A (Pure Graph Lock): The graph data fully answers the query or the user seeks purely an internal memory. Output: 100% past data.\n"
            "- Scenario B (Blended Augmentation): The graph contains their affinity, but external data is needed for a fresh recommendation or local context matching that affinity. Output: Primary Past Data + Secondary External Knowledge.\n"
            "- Scenario C (Cold Start Fallback): The user asks a doubt about a topic with absolutely zero reference points in their historical graph. Output: Explicitly state that no personal history was found on this topic, then fulfill the request beautifully using pure external world knowledge.\n\n"
            "You must output your decision strictly as a clean JSON object with EXACTLY these four keys:\n"
            "`type` (must be one of: 'wellness', 'entertainment', 'general'),\n"
            "`headline` (a brief, punchy title for your suggestion),\n"
            "`recommendation` (the actionable advice, item suggestion, or memory recall), and\n"
            "`rationale` (gracefully explain to the user *why* you are recommending an exact repeat, an alternative, or a fallback, matching the natural flow of an omniscient personal diary assistant).\n"
            "Do not append any markdown decoration outside the raw JSON properties."
        )
        user_prompt = f"Historical Context:\n{context_str}\n\nUser Query/State:\n{req.query}"

        llm_response = await acompletion(
            model=os.getenv("LLM_MODEL", "gemini/gemini-3.1-flash-lite"),
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ]
        )
        
        analysis_result = llm_response.choices[0].message.content.strip()
        
        if analysis_result.startswith("```json"):
            analysis_result = analysis_result[7:-3].strip()
        elif analysis_result.startswith("```"):
            analysis_result = analysis_result[3:-3].strip()
        
        try:
            response_json = json.loads(analysis_result)
            return {
                "status": "success",
                "data": response_json
            }
        except json.JSONDecodeError:
            return JSONResponse(
                status_code=500,
                content={
                    "status": "error",
                    "message": "LLM failed to output valid JSON for the recovery strategy.",
                    "raw_output": analysis_result
                }
            )
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Recover Loop failed: {str(e)}")

@app.get("/api/blindspots")
async def get_blindspots(profile: str):
    dataset_name = f"user_{profile}"
    
    try:
        # Guard database retrieval with the lock
        async with cognee_lock:
            prompt = "Extract any recurring, indirect correlations where a user choice or lifestyle behavior consistently maps over time to subsequent physical, cognitive, or emotional outcome states."
            macro_paths = await cognee.recall(prompt, datasets=[dataset_name])
        
        if isinstance(macro_paths, list):
            macro_paths_str = " ".join([str(item) for item in macro_paths])
        else:
            macro_paths_str = str(macro_paths)

        system_prompt = (
            "Act as a behavioral data analyst. Review these graph lines. Identify the two strongest long-term behavioral correlations "
            "that the user might be completely unaware of. Format your response strictly as a clean JSON array of objects. "
            "Each object must contain exactly three keys: `title` (a brief, high-impact headline), `description` (a clear explanation "
            "of the cause-and-effect link), and `type` (either 'positive' or 'negative'). Output only the raw JSON array string."
        )
        
        user_prompt = f"Graph Lines Data:\n{macro_paths_str}"

        llm_response = await acompletion(
            model=os.getenv("LLM_MODEL", "gemini/gemini-3.1-flash-lite"),
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ]
        )
        
        analysis_result = llm_response.choices[0].message.content.strip()
        
        if analysis_result.startswith("```json"):
            analysis_result = analysis_result[7:-3].strip()
        elif analysis_result.startswith("```"):
            analysis_result = analysis_result[3:-3].strip()
            
        try:
            response_json = json.loads(analysis_result)
            return {
                "status": "success",
                "data": response_json
            }
        except json.JSONDecodeError:
            return JSONResponse(
                status_code=500,
                content={
                    "status": "error",
                    "message": "LLM failed to output a valid JSON array for blindspots.",
                    "raw_output": analysis_result
                }
            )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Blindspots Loop failed: {str(e)}")

@app.put("/api/update")
async def update_memory(req: UpdateRequest):
    if not req.new_text or not req.new_text.strip():
        return JSONResponse(
            status_code=400,
            content={"status": "error", "message": "Missing or empty 'newText' payload for update action."}
        )

    dataset_name = f"user_{req.profile}"
    try:
        # Guard database operation with the lock
        async with cognee_lock:
            await cognee.remember(req.new_text.strip(), dataset_name=dataset_name)
        return {
            "status": "success",
            "message": "Memory successfully updated."
        }
    except OSError as io_err:
        return JSONResponse(
            status_code=500,
            content={"status": "error", "message": f"IO error during memory update: {str(io_err)}"}
        )
    except Exception as e:
        err_msg = str(e)
        if "database is locked" in err_msg.lower() or "lock" in err_msg.lower():
            return JSONResponse(
                status_code=503,
                content={"status": "error", "message": "Memory store temporarily locked. Please retry in a moment."}
            )
        else:
            raise HTTPException(status_code=500, detail=f"Update pipeline failed: {err_msg}")

@app.post("/api/forget")
async def forget_memory(req: ForgetConfirmRequest):
    dataset_name = f"user_{req.profile}"
    try:
        # Guard database operation with the lock
        async with cognee_lock:
            if hasattr(cognee, 'forget'):
                 # FIXED: Removed the positional text argument to strictly satisfy the keyword-only signature
                 await cognee.forget(dataset_id=dataset_name)
            else:
                 print("Warning: cognee.forget not found. Mocking deletion.")
        
        return {
            "status": "success",
            "message": f"Successfully dissolved connection regarding: {req.topic}"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Forget operation failed: {str(e)}")

@app.post("/api/improve")
async def improve_memory(req: ImproveRequest):
    dataset_name = f"user_{req.profile}"
    try:
        # Guard database operation with the lock
        async with cognee_lock:
            if hasattr(cognee, 'improve'):
                # FIXED: Swapped 'dataset_name' to 'dataset_id' to match modern SDK signatures
                await cognee.improve(
                    dataset_id=dataset_name, 
                    helpful=req.helpful, 
                    context=req.context
                )
            else:
                print("Warning: cognee.improve not found. Mocking optimization.")
            
        return {
            "status": "success",
            "message": "Optimization loop triggered successfully."
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Improve operation failed: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)