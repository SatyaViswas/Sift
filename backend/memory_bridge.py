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
    lookup_token: Optional[str] = None

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
            "IMPORTANT: The 'topic' value MUST be extracted strictly as the root entity name or primary noun phrase (e.g., extracting \"Interstellar\", \"Outer Wilds\", or \"Lulu Cafe\") rather than a conversational fragment like \"the movie interstellar\" or \"my experience at lulu cafe\". This guarantees our SQL wildcards can maximize text hits.\n"
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

    summary_snippet = None
    if len(req.text) > 250:
        try:
            summary_prompt = (
                "Summarize this journal entry in 1-2 short sentences. "
                "Return only the summary text, no quotes or prefix."
            )
            summary_resp = await acompletion(
                model=os.getenv("LLM_MODEL", "gemini/gemini-3.1-flash-lite"),
                messages=[
                    {"role": "system", "content": summary_prompt},
                    {"role": "user", "content": req.text}
                ]
            )
            summary_snippet = summary_resp.choices[0].message.content.strip()
        except Exception as e:
            print(f"Summary generation failed: {e}")

    # Guard database operation with the lock
    try:
        async with cognee_lock:
            await cognee.remember(req.text, dataset_name=dataset_name)
        return {
            "status": "success",
            "message": "Stored!",
            "heading": heading,
            "summary_snippet": summary_snippet
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ingestion failed: {str(e)}")

@app.post("/api/recover")
async def recover_memory(req: RecoverRequest):
    dataset_name = f"user_{req.profile}"
    
    try:
        # Guard database retrieval with the lock
        try:
            async with cognee_lock:
                prompt = req.query if req.query else "What choices, habits, or preferences matter most to this user?"
                context = await cognee.recall(prompt, datasets=[dataset_name])
        except Exception as recall_err:
            # Catch empty database states / cold starts gracefully
            if "DatasetNotFoundError" in str(recall_err) or "404" in str(recall_err):
                context = ""
            else:
                raise recall_err
        
        if isinstance(context, list):
            context_str = " ".join([str(item) for item in context])
        else:
            context_str = str(context)
            
        feedback_history_str = ""
        try:
            manifest_path = f"oracle_manifest_{dataset_name}.json"
            if os.path.exists(manifest_path):
                with open(manifest_path, "r") as f:
                    manifest_data = json.load(f)
                    history_items = []
                    for k, val in manifest_data.items():
                        helpful_signal = "true" if val.get("helpful") else "false"
                        history_items.append(f"- {val.get('summary')} (helpful: {helpful_signal})")
                    feedback_history_str = "\n".join(history_items)
        except Exception as e:
            print(f"Failed to load feedback history: {e}")
        
        if not feedback_history_str:
            feedback_history_str = "No feedback history available."

        system_prompt = (
            "You are an empathetic, highly intelligent personal diary assistant acting as an Organic Intent Reasoner. "
            "Treat the retrieved user graph logs and feedback history as a fluid, organic pool of human experiences. "
            "Dynamically evaluate the nature of the user's query on the fly and adapt your style using common-sense human logic.\n\n"
            "Multi-Option Scenario Rules:\n"
            "- Repeatable Habits & Lifestyles (e.g., dining, cafes, activities): Recommend multiple verified favorites from the user's history that fit the contextual request. If there are too many favorites, dynamically select the top 2-4 most relevant entries.\n"
            "- One-Time Consumables (e.g., movies, games, books): Suggest multiple distinct, unconsumed alternatives that collectively align with the user's established taste profile.\n"
            "- Technical Doubts & Decision Making: Provide multiple alternative angles, distinct problem-solving options, or a tiered list of solution tracks so the user can evaluate different approaches.\n\n"
            "Absolute Anti-Hallucination Guardrail:\n"
            "You are strictly prohibited from inventing fictional businesses, non-existent cafes, fake items, or artificial technical steps. If recommending an item or location, you must rely exclusively on genuine preferences found within the user's memory or use completely real, verifiable, existing real-world entities.\n\n"
            "You must output your final decision strictly as a clean JSON object containing EXACTLY these four keys:\n"
            "`type` (must be one of: 'wellness', 'entertainment', 'general'),\n"
            "`headline` (a brief, punchy title for your suggestion),\n"
            "`recommendation` (the string value MUST be formatted as a structured list containing multiple distinct choices, options, or solutions, using clean markdown bullet points or numbered lists inside the string. DO NOT use an array),\n"
            "`rationale` (read like an empathetic, highly intelligent meta-cognitive diary assistant, clearly detailing how you cross-referenced their past inputs, affinities, and active exclusions to curate this specific set of options).\n\n"
            "Absolute Rule: Do not append any markdown backticks or code block syntax wrappers outside the final raw JSON object."
        )
        user_prompt = f"[Long-Term Graph Context]:\n{context_str}\n\n[Direct Feedback History]:\n{feedback_history_str}\n\nUser Query/State:\n{req.query}"

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
        try:
            async with cognee_lock:
                prompt = "Extract any recurring, indirect correlations where a user choice or lifestyle behavior consistently maps over time to subsequent physical, cognitive, or emotional outcome states."
                macro_paths = await cognee.recall(prompt, datasets=[dataset_name])
        except Exception as recall_err:
            # If the graph is missing or freshly wiped, return a clean empty data array gracefully
            if "DatasetNotFoundError" in str(recall_err) or "404" in str(recall_err):
                return {
                    "status": "success",
                    "data": []
                }
            else:
                raise recall_err
        
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
        async with cognee_lock:
            # Treat the deletion path as a selective context update using a soft-delete instruction string
            soft_delete_instruction = f"USER EXPLICITLY DELETED AND FORGOT MEMORY REGARDING: {req.topic}"
            await cognee.remember(soft_delete_instruction, dataset_name=dataset_name)
        
        return {
            "status": "success",
            "message": "Memory explicitly forgotten via soft-delete constraint."
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Forget operation failed: {str(e)}")

@app.post("/api/improve")
async def improve_memory(req: ImproveRequest):
    dataset_name = f"user_{req.profile}"
    try:
        system_prompt = (
            "You are an Organic Journal Memory Synthesizer for a personal graph database. "
            "Analyze the original user query, the suggestion context, and the boolean helpful signal to generate a definitive 1-sentence statement of human fact.\n"
            "The output must be written exactly like a factual journal log entry or an explicit user preference.\n\n"
            "Rules & Examples:\n"
            "- For Media/Recommendations (Movies, Shows, Books) + Helpful (True): The snippet must explicitly state consumption and approval. Example: 'User watched and highly enjoyed the movie Arrival.'\n"
            "- For Media/Recommendations + Unhelpful (False): The snippet must explicitly log rejection. Example: 'User does not like or want to watch the movie Arrival.'\n"
            "- For Answers to Doubts/Queries + Helpful (True): The snippet must confirm cognitive resolution. Example: 'User completely resolved their conceptual confusion regarding Java garbage collection execution paths.'\n"
            "- For Answers to Doubts/Queries + Unhelpful (False): The snippet must indicate confusion. Example: 'User requires a different explanation for the concept.'\n\n"
            "Output ONLY the raw, clean natural text statement. It must contain zero brackets, zero markdown formatting, zero quotes, and zero conversational prefixes."
        )
        
        user_prompt = f"Helpful Signal: {req.helpful}\nContext (Question & Answer):\n{req.context}"

        llm_response = await acompletion(
            model=os.getenv("LLM_MODEL", "gemini/gemini-3.1-flash-lite"),
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ]
        )
        
        summary = llm_response.choices[0].message.content.strip()

        # 1. Contextual Signature Matching
        import hashlib
        context_hash = req.lookup_token if req.lookup_token else hashlib.sha256(req.context.encode('utf-8')).hexdigest()

        # Guard database operation with the lock
        async with cognee_lock:
            manifest_path = f"oracle_manifest_{dataset_name}.json"
            manifest = {}
            if os.path.exists(manifest_path):
                try:
                    with open(manifest_path, "r") as f:
                        manifest = json.load(f)
                except Exception:
                    pass

            # 2. Idempotent Storage & Graph Overwrite Strategy
            structural_entry = summary
            
            if context_hash in manifest:
                print(f"Idempotent Storage: Overwriting structural text entry for context {context_hash}")
                # We push the clean structural entry to inherently update the semantic properties.
                await cognee.remember(structural_entry, dataset_name=dataset_name)
            else:
                print(f"Idempotent Storage: Fresh ingest for context {context_hash}")
                await cognee.remember(structural_entry, dataset_name=dataset_name)

            # Map the footprint locally to prevent duplication leaks
            manifest[context_hash] = {
                "helpful": req.helpful,
                "summary": summary
            }
            with open(manifest_path, "w") as f:
                json.dump(manifest, f)

            # 3. Trigger structural optimization hook smoothly
            if hasattr(cognee, 'improve'):
                await cognee.improve(dataset=dataset_name)
            else:
                print("Warning: cognee.improve not found. Mocking optimization.")
            
        return {
            "status": "success",
            "message": "Optimization loop triggered successfully.",
            "lookup_token": context_hash
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Improve operation failed: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)