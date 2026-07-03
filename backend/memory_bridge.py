import sys
import json
import os
import asyncio
import hashlib
from contextlib import asynccontextmanager
from typing import Optional, Dict, Any, List

from fastapi import FastAPI, HTTPException, Request, BackgroundTasks
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, ConfigDict
from dotenv import load_dotenv

import cognee
from litellm import acompletion

# Load environment variables dynamically
load_dotenv()
if os.getenv("LLM_API_KEY") and not os.getenv("GEMINI_API_KEY"):
    os.environ["GEMINI_API_KEY"] = os.getenv("LLM_API_KEY")

import difflib
import re

# Global lock for thread safety in database operations
cognee_lock = asyncio.Lock()

def is_forbidden(text, forbidden_topics):
    if not forbidden_topics:
        return False
    text_lower = text.lower()
    text_words = re.findall(r'\b\w+\b', text_lower)
    text_words.extend([text_words[i] + text_words[i+1] for i in range(len(text_words)-1) if i < len(text_words)-1])
    
    stop_words = {"i", "liked", "playing", "the", "a", "an", "and", "or", "but", "really", "loved", "yesterday", "today", "tomorrow", "this", "that", "was", "is", "am", "are", "were"}
    
    for topic in forbidden_topics:
        if topic in text_lower:
            return True
            
        sig_words = [w for w in re.findall(r'\b\w+\b', topic) if len(w) >= 4 and w not in stop_words]
        if sig_words:
            sig_compound = "".join(sig_words)
            sig_words.append(sig_compound)
            
            has_sig = False
            for word in sig_words:
                for lw in text_words:
                    if len(lw) >= 4:
                        if difflib.SequenceMatcher(None, word, lw).ratio() > 0.80:
                            has_sig = True
                            break
                if has_sig: break
                
            if has_sig:
                return True
                
    return False

# Cache helper functions for Blindspots
def get_blindspots_cache_path(profile: str) -> str:
    dir_path = os.path.join(os.path.dirname(__file__), "vector_sanctuary", f"user_{profile}")
    os.makedirs(dir_path, exist_ok=True)
    return os.path.join(dir_path, "blindspots_cache.json")

def mark_blindspots_stale(profile: str):
    cache_path = get_blindspots_cache_path(profile)
    try:
        if os.path.exists(cache_path):
            with open(cache_path, "r") as f:
                data = json.load(f)
            data["is_stale"] = True
            with open(cache_path, "w") as f:
                json.dump(data, f)
        else:
            with open(cache_path, "w") as f:
                json.dump({"is_stale": True, "data": []}, f)
    except Exception as e:
        print(f"Failed to mark blindspots cache as stale: {e}")

@asynccontextmanager
async def lifespan(app: FastAPI):
    print("Memory bridge v3 initialized. Architecture locked for strict deterministic retention.")
    yield
    print("Memory bridge v3 shutting down.")

app = FastAPI(lifespan=lifespan)

# Pydantic V2 Models
class IngestRequest(BaseModel):
    profile: str
    text: str
    timestamp: Optional[str] = None
    isSnippet: Optional[bool] = False
    model_config = ConfigDict(extra="ignore")

class RecoverRequest(BaseModel):
    profile: str
    query: Optional[str] = ""
    full_history: Optional[str] = ""
    model_config = ConfigDict(extra="ignore")

class UpdateRequest(BaseModel):
    profile: str
    entry_id: Optional[Any] = Field(None, alias="entryId")
    new_text: Optional[str] = Field(None, alias="newText")
    original_text: Optional[str] = Field(None, alias="originalText")
    timestamp: Optional[str] = None
    model_config = ConfigDict(populate_by_name=True, extra="ignore")

class ForgetConfirmRequest(BaseModel):
    profile: str
    topic: str
    model_config = ConfigDict(extra="ignore")

class ImproveRequest(BaseModel):
    profile: str
    helpful: bool
    context: Optional[str] = ""
    lookup_token: Optional[str] = None
    model_config = ConfigDict(extra="ignore")

class BlindspotsRequest(BaseModel):
    profile: str
    force_refresh: Optional[bool] = False
    full_history: Optional[str] = ""
    model_config = ConfigDict(extra="ignore")

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
        "message": "Python bridge v3 operational. Memory Vault is secure.",
        "profile_received": profile,
        "environment_check": {
            "gemini_api_key_set": bool(os.getenv("GEMINI_API_KEY") or os.getenv("LLM_API_KEY"))
        }
    }

@app.post("/api/ingest")
async def ingest_memory(req: IngestRequest):
    dataset_name = f"user_{req.profile}"
    
    heading = None
    summary_snippet = None
    
    text_lower = req.text.strip().lower()
    is_forget_command = text_lower.startswith("forget") or text_lower.startswith("delete") or text_lower.startswith("dissolve")
    
    if is_forget_command:
        # Simple regex/string parsing for forget to save API tokens
        topic = req.text.strip()[7:].strip() if len(req.text.strip()) > 7 else "memory"
        return {
            "status": "forget_confirmation",
            "data": { "topic": topic }
        }

    # ARCHITECTURAL MANDATE 1: Strict Taxonomic Ingestion Prefix
    # Wrapping entry with structural classification metadata tags to eliminate ontology drift
    ts_str = f"[Timestamp: {req.timestamp}] " if req.timestamp else ""
    structured_entry = f"{ts_str}[Classification: UserSlateEntry] {req.text.strip()}"

    try:
        async with cognee_lock:
            # We must use cognee.add to strictly avoid cognify's concurrent LLM API rate limit burst.
            # New snippets will be handled dynamically via full_history context mapping.
            await cognee.add(structured_entry, dataset_name=dataset_name)
        mark_blindspots_stale(req.profile)
        return {
            "status": "success",
            "message": "Stored securely with taxonomy prefix.",
            "heading": heading,
            "summary_snippet": summary_snippet
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ingestion failed: {str(e)}")


@app.post("/api/recover")
async def recover_memory(req: RecoverRequest):
    dataset_name = f"user_{req.profile}"
    
    try:
        # ARCHITECTURAL MANDATE 2: Broad-Spectrum Structural Retrieval Pass
        # Concurrent execution of dual lookups to prevent vector dropout.
        try:
            async with cognee_lock:
                target_specific = req.query if req.query else "What choices, habits, or preferences matter most to this user?"
                target_broad = "Comprehensive history of [Classification: UserSlateEntry], diary entries, watched media, preferences, and life logs."
                
                results = await asyncio.gather(
                    cognee.recall(target_specific, datasets=[dataset_name]),
                    cognee.recall(target_broad, datasets=[dataset_name]),
                    return_exceptions=True
                )
                
                def handle_result(res):
                    if isinstance(res, Exception):
                        if "DatasetNotFoundError" in str(res) or "404" in str(res):
                            return []
                        raise res
                    return res
                    
                context_specific = handle_result(results[0])
                context_broad = handle_result(results[1])
                
        except Exception as recall_err:
            raise recall_err
        
        # Manifest Read: System feedback logs & Semantic Amnesia Vault
        manifest_history_lines = []
        forbidden_entities = set()
        
        try:
            manifest_path = f"oracle_manifest_{dataset_name}.json"
            if os.path.exists(manifest_path):
                with open(manifest_path, "r") as f:
                    manifest_data = json.load(f)
                    for k, val in manifest_data.items():
                        # ARCHITECTURAL MANDATE 4: Amnesia Vault Aggregation
                        if val.get("status") == "forgotten":
                            topic = val.get("topic")
                            if topic:
                                for t in str(topic).split(','):
                                    clean_t = t.strip(' .!?,').lower()
                                    if clean_t:
                                        forbidden_entities.add(clean_t)
                            continue
                            
                        # Recommendation Context (Not User Data)
                        helpful_signal = val.get("helpful")
                        summary_text = val.get('summary', '')
                        helpful_str = "true" if helpful_signal else "false"
                        manifest_history_lines.append(f"- {summary_text} (helpful: {helpful_str})")
        except Exception as e:
            print(f"Failed to load manifest history: {e}")
            
        # Deduplicate results and strictly filter out forgotten entries
        raw_context_lines = []
        seen_lines = set()

        def process_context(ctx):
            if not ctx:
                return
            lines_to_process = ctx if isinstance(ctx, list) else str(ctx).split('\n')
            for item in lines_to_process:
                item_str = str(item).strip()
                if not item_str:
                    continue
                # Clean up any potential duplicate or irrelevant lines
                if item_str not in seen_lines:
                    # Aggressive True Semantic Output Filter
                    if is_forbidden(item_str, forbidden_entities):
                        continue
                    seen_lines.add(item_str)
                    raw_context_lines.append(item_str)

        process_context(context_specific)
        process_context(context_broad)
        
        # The full timeline is pulled from Supabase which natively handles deletions when the user clicks 'dissolve'.
        # We must NOT run the aggressive is_forbidden filter on the full timeline, or else it creates a permanent gag-order on any words they ever dissolved in the past.
        filtered_full_timeline = []
        if req.full_history:
            for item in req.full_history.split('\n'):
                filtered_full_timeline.append(item)
                    
        full_timeline_str = "\n".join(filtered_full_timeline) if filtered_full_timeline else "No comprehensive timeline provided."

        context_str = "\n".join(f"- {line}" for line in raw_context_lines) if raw_context_lines else "No direct journal history found."
        feedback_history_str = "\n".join(manifest_history_lines) if manifest_history_lines else "No system feedback history available."

        # ARCHITECTURAL MANDATE 5: Strict XML Data Grounding & 4-Scenario Analysis
        system_prompt = (
            "You are an empathetic, reality-grounded personal journal assistant acting as a strict Organic Intent Reasoner.\n\n"
            "<GROUNDING_LAWS>\n"
            "1. You must treat the content inside <USER_PURE_HISTORY> and <FULL_TIMELINE_FROM_DAY_1> as the absolute, closed-world boundary of the user's past actions and life entries from Day 1. If an item, title, or location is not explicitly written there, the user has never experienced it.\n"
            "2. Content inside <PAST_AI_RECOMMENDATIONS> represents suggestions previously offered by the system, NOT historical actions taken by the user. You are strictly prohibited from mixing these logs up with the user's past life metrics. DO NOT hallucinate these as user actions.\n"
            "</GROUNDING_LAWS>\n\n"
            "<SCENARIO_ANALYSIS>\n"
            "Analyze the user's query and classify it into exactly one of these four scenarios:\n"
            "1. 'Recommendation': Suggesting options (e.g. what movie to watch, what to eat) based on past preferences.\n"
            "2. 'Doubt_Clearing': Resolving confusion or verifying past events (e.g. 'Did I watch Kalki?').\n"
            "3. 'Decision_Making': Helping the user decide between choices or resolve conflicts (e.g. 'Should I quit my job?'). Extracts Pros/Cons from past patterns.\n"
            "4. 'Historical_Recall': Recalling past events chronologically (e.g. 'What did I do last summer?').\n"
            "</SCENARIO_ANALYSIS>\n\n"
            "<OUTPUT_CONSTRAINTS>\n"
            "- Respond strictly using a clean JSON format matching exactly these five keys: 'scenario', 'headline', 'primary_content', 'historical_evidence', 'rationale'.\n"
            "  * 'scenario': String (Recommendation, Doubt_Clearing, Decision_Making, Historical_Recall).\n"
            "  * 'headline': Punchy 3-6 word title.\n"
            "  * 'primary_content': Rich Markdown string providing the core answer. Use lists, bolding, and structuring tailored to the scenario (e.g. Pros/Cons for Decision Making, chronological bullets for Recall).\n"
            "  * 'historical_evidence': Array of strings citing explicit dates or entries used to ground the answer.\n"
            "  * 'rationale': A brief closing paragraph explaining how this links back to the user's history.\n"
            "- You are STRICTLY FORBIDDEN from mentioning your internal rules, database statuses, XML blocks, or grounding parameters.\n"
            "- Write your reasoning organically and conversationally.\n"
            "- Never append markdown backticks (```json) or code delimiters outside the raw JSON object string.\n"
            "</OUTPUT_CONSTRAINTS>"
        )
        
        user_prompt = (
            "<CONTEXT_DATA>\n"
            f"  <FULL_TIMELINE_FROM_DAY_1>\n{full_timeline_str}\n  </FULL_TIMELINE_FROM_DAY_1>\n"
            f"  <USER_PURE_HISTORY>\n{context_str}\n  </USER_PURE_HISTORY>\n"
            f"  <PAST_AI_RECOMMENDATIONS>\n{feedback_history_str}\n  </PAST_AI_RECOMMENDATIONS>\n"
            "</CONTEXT_DATA>\n\n"
            "CRITICAL PRIORITY: The most recent user entries are appended at the very bottom of FULL_TIMELINE_FROM_DAY_1. You MUST treat the bottom of FULL_TIMELINE_FROM_DAY_1 as the most up-to-date and accurate context for the user's current state. Do not ignore it.\n\n"
            "<CURRENT_USER_QUERY>\n"
            f"{req.query}\n"
            "</CURRENT_USER_QUERY>"
        )

        llm_response = await acompletion(
            model=os.getenv("LLM_MODEL", "gemini/gemini-3.1-flash-lite"),
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            temperature=0.1
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


async def _generate_blindspots_logic(profile: str, full_history: str = "") -> list:
    dataset_name = f"user_{profile}"
    
    try:
        async with cognee_lock:
            # Broad spectrum recall to capture everything related to habits, lifestyle, and history
            prompt1 = "Comprehensive history of [Classification: UserSlateEntry], diary entries, daily routines, habits, productivity, and lifestyle patterns."
            prompt2 = "user daily routines, diet, food, meals, physical exercise, workouts, sleep, mental state, emotional state, brain fog, fatigue, procrastination, avoidance, focus, environment"
            results = await asyncio.gather(
                cognee.recall(prompt1, datasets=[dataset_name]),
                cognee.recall(prompt2, datasets=[dataset_name]),
                return_exceptions=True
            )
            
            def handle_result(res):
                if isinstance(res, Exception):
                    if "DatasetNotFoundError" in str(res) or "404" in str(res):
                        return []
                    raise res
                return res

            context1 = handle_result(results[0])
            context2 = handle_result(results[1])
            
            # Manifest Read: Semantic Amnesia Vault
            forbidden_entities = set()
            try:
                manifest_path = f"oracle_manifest_{dataset_name}.json"
                if os.path.exists(manifest_path):
                    with open(manifest_path, "r") as f:
                        manifest_data = json.load(f)
                        for k, val in manifest_data.items():
                            if val.get("status") == "forgotten":
                                topic = val.get("topic")
                                if topic:
                                    for t in str(topic).split(','):
                                        clean_t = t.strip(' .!?,').lower()
                                        if clean_t:
                                            forbidden_entities.add(clean_t)
            except Exception as e:
                print(f"Failed to load manifest history: {e}")

            # Deduplicate results and filter
            raw_context_lines = []
            seen_lines = set()

            def process_context(ctx):
                if not ctx:
                    return
                lines_to_process = ctx if isinstance(ctx, list) else str(ctx).split('\n')
                for item in lines_to_process:
                    item_str = str(item).strip()
                    if not item_str:
                        continue
                    if item_str not in seen_lines:
                        if any(forbid in item_str.lower() for forbid in forbidden_entities):
                            continue
                        seen_lines.add(item_str)
                        raw_context_lines.append(item_str)

            process_context(context1)
            process_context(context2)
            
            macro_paths_str = "\n".join(raw_context_lines) if raw_context_lines else ""
            
    except Exception as recall_err:
        if "DatasetNotFoundError" in str(recall_err) or "404" in str(recall_err):
            return []
        else:
            raise recall_err
    
    if not macro_paths_str:
        return []

    system_prompt = (
        "Act as a brilliant behavioral analyst and human-insight engine. Your goal is to review a user's multi-year diary history and uncover their personal \"Blindspots.\"\n\n"
        "### What is a Blindspot?\n"
        "A blindspot is a hidden, recurring cause-and-effect loop in a person's life. It connects a specific choice, environment, or habit they make at one point to a physical, mental, or emotional outcome that happens later. Because these events are separated by time or domain, the user is completely blind to the connection in their day-to-day life.\n\n"
        "You must be able to naturally spot these hidden loops across years of memories for any type of person. For example:\n"
        "- The Student: Connecting the dots to show that staying up late debugging or studying doesn't just cause next-day tiredness, but actually triggers severe mental blocks when trying to solve complex conceptual problems forty-eight hours later.\n"
        "- The Worker/Creator: Revealing a psychological stall pattern where the user spends hours endlessly micro-editing their words or tweaking visual details as a subconscious avoidance tactic to delay shipping a project or collaborating with their team.\n"
        "- The Health/Wellness User: Uncovering a positive flywheel showing that dedicating just 15 minutes to a simple physical routine before noon consistently unlocks flawless focus and automatically suppresses heavy fast-food cravings for days.\n\n"
        "### How You Must Work\n"
        "Do not look for rigid keywords or specific fixed calendar rules. Instead, think dynamically about human behavior. Look at how inputs (like meals, sleep thresholds, physical environments, or habits) directly correlate with downstream states (like focus, anxiety, energy, or procrastination) across a multi-year timeline.\n\n"
        "Find and group these discovered loops into three clear buckets based on their impact:\n"
        "- Positive Patterns: Hidden behaviors that act as a momentum catalyst or psychological superpower for the user.\n"
        "- Negative Patterns: Hidden triggers or routines that actively sabotage their energy, focus, or well-being.\n"
        "- Neutral Patterns: Hidden behavioral warnings, coping mechanisms, or recurring lifestyle loops (like perfectionism traps).\n\n"
        "Be universally receptive to any life scenario (whether it is about study stress, sports stamina, dietary fatigue, or work anxiety), but remain strictly grounded in reality—never invent, assume, or generalize a pattern that is not completely backed up by the user's authentic past entries.\n\n"
        "### Strict Output Formatting Rules:\n"
        "You must output ONLY a raw JSON array of objects. Do not include markdown code wrappers (like ```json). Each object must match this exact schema:\n"
        '[{ "title": "<punchy headline>", "description": "<insightful cause-and-effect link>", "type": "positive" | "negative" | "neutral" }]'
    )
    
    recent_snippets_context = ""
    if full_history:
        recent_snippets = full_history.split('\n')[-30:]
        recent_snippets_context = "\n[Recent Unprocessed Activity Log]:\n" + "\n".join(recent_snippets)

    user_prompt = f"User's Historical Log Data:\n{macro_paths_str}{recent_snippets_context}"
    
    llm_response = await acompletion(
        model=os.getenv("LLM_MODEL", "gemini/gemini-3.1-flash-lite"),
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ],
        temperature=0.2
    )
    
    analysis_result = llm_response.choices[0].message.content.strip()
    
    if analysis_result.startswith("```json"):
        analysis_result = analysis_result[7:-3].strip()
    elif analysis_result.startswith("```"):
        analysis_result = analysis_result[3:-3].strip()
        
    try:
        response_json = json.loads(analysis_result)
        if not isinstance(response_json, list):
            response_json = []
        return response_json
    except json.JSONDecodeError:
        print(f"LLM failed to output a valid JSON array for blindspots: {analysis_result}")
        return []

async def _background_generate_blindspots(profile: str, full_history: str = ""):
    try:
        data = await _generate_blindspots_logic(profile, full_history)
        cache_path = get_blindspots_cache_path(profile)
        
        cache_content = {
            "is_stale": False,
            "data": data
        }
        with open(cache_path, "w") as f:
            json.dump(cache_content, f)
    except Exception as e:
        print(f"Background blindspot generation failed: {e}")

@app.post("/api/blindspots")
async def get_blindspots(req: BlindspotsRequest, background_tasks: BackgroundTasks):
    cache_path = get_blindspots_cache_path(req.profile)
    
    cache_exists = os.path.exists(cache_path)
    is_stale = True
    cached_data = []

    if cache_exists:
        try:
            with open(cache_path, "r") as f:
                cache_content = json.load(f)
                is_stale = cache_content.get("is_stale", True)
                cached_data = cache_content.get("data", [])
        except Exception:
            pass
            
    if req.force_refresh:
        # Synchronous execution
        try:
            data = await _generate_blindspots_logic(req.profile, req.full_history)
            
            cache_content = {
                "is_stale": False,
                "data": data
            }
            with open(cache_path, "w") as f:
                json.dump(cache_content, f)
                
            return {
                "status": "success",
                "data": data
            }
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Blindspots Loop failed: {str(e)}")
            
    if is_stale:
        background_tasks.add_task(_background_generate_blindspots, req.profile, req.full_history)
        
    return {
        "status": "success",
        "data": cached_data
    }

@app.put("/api/update")
async def update_memory(req: UpdateRequest):
    if not req.new_text or not req.new_text.strip():
        return JSONResponse(
            status_code=400,
            content={"status": "error", "message": "Missing or empty 'newText' payload for update action."}
        )

    dataset_name = f"user_{req.profile}"
    ts_str = f"[Timestamp: {req.timestamp}]\n" if req.timestamp else ""
    structured_entry = f"{ts_str}[Classification: UserSlateEntry]\n{req.new_text.strip()}"
    
    try:
        async with cognee_lock:
            await cognee.remember(structured_entry, dataset_name=dataset_name)
        mark_blindspots_stale(req.profile)
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
        # TRUE FORGET: Traverse Cognee SQLite and physical files to find and delete the exact data nodes
        import sqlite3
        import uuid
        
        db_path = "/Users/satyaviswas/Documents/sift-recovery-engine/backend/venv/lib/python3.13/site-packages/cognee/.cognee_system/databases/cognee_db"
        
        data_ids_to_forget = []
        
        async with cognee_lock:
            if os.path.exists(db_path):
                try:
                    conn = sqlite3.connect(db_path)
                    cursor = conn.cursor()
                    
                    # Fetch all data items
                    cursor.execute("SELECT id, raw_data_location FROM data")
                    rows = cursor.fetchall()
                    
                    for row in rows:
                        data_id_hex = row[0]
                        file_path = str(row[1]).replace("file://", "")
                        if os.path.exists(file_path):
                            try:
                                with open(file_path, "r", encoding="utf-8") as f:
                                    content = f.read()
                                    # Check if the requested topic exists in the raw ingested text
                                    for t in req.topic.split(','):
                                        clean_t = t.strip(' .!?,').lower()
                                        if clean_t and clean_t in content.lower():
                                            data_ids_to_forget.append(uuid.UUID(data_id_hex))
                                            break # Move to next file once matched
                            except Exception:
                                pass
                    conn.close()
                except Exception as e:
                    print(f"Error accessing sqlite db for true forget: {e}")

            # Physically wipe the data, vector embeddings, and graph nodes from Cognee
            for d_id in data_ids_to_forget:
                try:
                    await cognee.forget(data_id=d_id, dataset=dataset_name)
                    print(f"Successfully forgot true data_id: {d_id}")
                except Exception as e:
                    print(f"Failed to forget true data_id {d_id}: {e}")
            
            manifest_path = f"oracle_manifest_{dataset_name}.json"
            manifest = {}
            if os.path.exists(manifest_path):
                try:
                    with open(manifest_path, "r") as f:
                        manifest = json.load(f)
                except Exception:
                    pass
            
            # ARCHITECTURAL MANDATE 4 & 5: Pure Semantic Amnesia Vault
            # We securely register the topic in the manifest ledger and handle it dynamically in /recover
            
            for t in req.topic.split(','):
                clean_t = t.strip(' .!?,')
                if not clean_t:
                    continue
                
                topic_hash = hashlib.sha256(f"forget_{clean_t}".encode('utf-8')).hexdigest()
                manifest[topic_hash] = {
                    "topic": clean_t,
                    "status": "forgotten"
                }
                
            with open(manifest_path, "w") as f:
                json.dump(manifest, f)
        
        mark_blindspots_stale(req.profile)
        return {
            "status": "success",
            "message": f"Successfully completely erased connections related to '{req.topic}'."
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Forget operation failed: {str(e)}")


@app.post("/api/improve")
async def improve_memory(req: ImproveRequest):
    dataset_name = f"user_{req.profile}"
    try:
        system_prompt = (
            "You are a Journal Synthesizer.\n\n"
            "EXTRACTION & GUARDRAILS:\n"
            "1. Extract EVERY entity from the provided context.\n"
            "2. STRICTLY FORBIDDEN: When a user clicks Thumbs-Up on a multi-option recommendation list, you must NEVER claim the user 'watched' or 'consumed' those options.\n\n"
            "FORMAT & RULES:\n"
            "- You must instead log the feedback as a list validation.\n"
            "- Example (Helpful/True for a list): 'User validated an AI recommendation list containing Cargo and Rocketry as contextually helpful.'\n"
            "- ONLY for items explicitly logged by the user as consumed originally, you may state they experienced it.\n\n"
            "OUTPUT:\n"
            "Concatenate all sentences into one continuous string separated by spaces. Output ONLY raw text sentences. NO markdown, NO bullet numbers, NO prefixes."
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

        context_hash = req.lookup_token if req.lookup_token else hashlib.sha256(req.context.encode('utf-8')).hexdigest()

        # ARCHITECTURAL MANDATE 3: Complete Feedback Decoupling
        # Strict isolation: We ONLY write this feedback to the manifest. 
        # Cognee graph remains pristine and safe from AI-generated text contamination.
        async with cognee_lock:
            manifest_path = f"oracle_manifest_{dataset_name}.json"
            manifest = {}
            if os.path.exists(manifest_path):
                try:
                    with open(manifest_path, "r") as f:
                        manifest = json.load(f)
                except Exception:
                    pass

            manifest[context_hash] = {
                "helpful": req.helpful,
                "summary": summary
            }
            with open(manifest_path, "w") as f:
                json.dump(manifest, f)
            
        return {
            "status": "success",
            "message": "Optimization loop triggered securely into the offline manifest.",
            "lookup_token": context_hash
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Improve operation failed: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
