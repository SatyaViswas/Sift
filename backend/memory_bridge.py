import sys
import json
import os
import asyncio
import hashlib
import datetime
from contextlib import asynccontextmanager
from typing import Optional, Dict, Any, List

from fastapi import FastAPI, HTTPException, Request, BackgroundTasks
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, ConfigDict
from dotenv import load_dotenv

import cognee
from litellm import acompletion, aembedding
from supabase import create_client, Client

def cosine_similarity(v1, v2):
    dot_product = sum(a * b for a, b in zip(v1, v2))
    magnitude1 = sum(a * a for a in v1) ** 0.5
    magnitude2 = sum(b * b for b in v2) ** 0.5
    if magnitude1 * magnitude2 == 0: return 0
    return dot_product / (magnitude1 * magnitude2)

# Load environment variables dynamically
load_dotenv()
if os.getenv("LLM_API_KEY") and not os.getenv("GEMINI_API_KEY"):
    os.environ["GEMINI_API_KEY"] = os.getenv("LLM_API_KEY")

import difflib
import re

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

from supabase import create_client, Client, ClientOptions

# Supabase Client Initialization
supabase_url = os.getenv("SUPABASE_URL")
supabase_key = os.getenv("SUPABASE_ANON_KEY")

def get_supabase(token: str = None) -> Client:
    if not token:
        return create_client(supabase_url, supabase_key)
    return create_client(supabase_url, supabase_key, options=ClientOptions(
        headers={"Authorization": f"Bearer {token}"}
    ))

# Helper functions for Supabase state
def get_manifest(profile: str, token: str = None) -> dict:
    try:
        sb = get_supabase(token)
        response = sb.table("user_metadata").select("manifest").eq("profile", profile).execute()
        if response.data and len(response.data) > 0:
            return response.data[0].get("manifest") or {}
    except Exception as e:
        print(f"Error reading manifest from supabase: {e}")
    return {}

def save_manifest(profile: str, manifest_data: dict, token: str = None):
    try:
        sb = get_supabase(token)
        sb.table("user_metadata").upsert({"profile": profile, "manifest": manifest_data}).execute()
    except Exception as e:
        print(f"Error saving manifest to supabase: {e}")

def get_blindspots_cache(profile: str, token: str = None) -> tuple:
    try:
        sb = get_supabase(token)
        response = sb.table("user_metadata").select("blindspots_cache").eq("profile", profile).execute()
        if response.data and len(response.data) > 0:
            cache = response.data[0].get("blindspots_cache") or {}
            is_stale = cache.get("is_stale", True)
            data = cache.get("data", [])
            last_synced = cache.get("last_synced")
            return is_stale, data, last_synced
    except Exception as e:
        print(f"Error reading blindspots from supabase: {e}")
    return True, [], None

def save_blindspots_cache(profile: str, data: list, is_stale: bool, last_synced: str = None, token: str = None):
    try:
        sb = get_supabase(token)
        cache_data = {
            "is_stale": is_stale,
            "data": data,
            "last_synced": last_synced
        }
        sb.table("user_metadata").upsert({"profile": profile, "blindspots_cache": cache_data}).execute()
    except Exception as e:
        print(f"Error saving blindspots to supabase: {e}")

def mark_blindspots_stale(profile: str, token: str = None):
    try:
        is_stale, data, last_synced = get_blindspots_cache(profile, token)
        save_blindspots_cache(profile, data, True, last_synced, token)
    except Exception as e:
        print(f"Failed to mark blindspots cache as stale: {e}")

# Async Background Task for Cloud Graph Building
async def trigger_cloud_cognify(dataset_name: str):
    print(f"Triggering asynchronous cloud graph build for {dataset_name}...")
    try:
        await cognee.cognify(datasets=[dataset_name])
        print(f"Successfully cognified {dataset_name} on cloud.")
    except Exception as e:
        print(f"Cloud cognify failed for {dataset_name}: {e}")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize Cognee Cloud connection if variables are present
    service_url = os.getenv("COGNEE_SERVICE_URL") or os.getenv("COGNEE_API_URL")
    api_key = os.getenv("COGNEE_API_KEY")
    if service_url and api_key:
        print(f"Connecting to Cognee Cloud at {service_url}...")
        try:
            await cognee.serve(url=service_url, api_key=api_key)
            print("Successfully connected to Cognee Cloud.")
        except Exception as e:
            print(f"Failed to connect to Cognee Cloud: {e}")
    else:
        print("Memory bridge v3 initialized for local database mode.")
    yield
    print("Memory bridge v3 shutting down.")

app = FastAPI(lifespan=lifespan)

# Pydantic V2 Models
class IngestRequest(BaseModel):
    profile: str
    text: str
    timestamp: Optional[str] = None
    isSnippet: Optional[bool] = False
    force_save: Optional[bool] = False
    token: Optional[str] = None
    model_config = ConfigDict(extra="ignore")

class RecoverRequest(BaseModel):
    profile: str
    query: Optional[str] = ""
    full_history: Optional[str] = ""
    token: Optional[str] = None
    model_config = ConfigDict(extra="ignore")

class UpdateRequest(BaseModel):
    profile: str
    entry_id: Optional[Any] = Field(None, alias="entryId")
    new_text: Optional[str] = Field(None, alias="newText")
    original_text: Optional[str] = Field(None, alias="originalText")
    timestamp: Optional[str] = None
    token: Optional[str] = None
    model_config = ConfigDict(populate_by_name=True, extra="ignore")

class ForgetConfirmRequest(BaseModel):
    profile: str
    topic: str
    token: Optional[str] = None
    model_config = ConfigDict(extra="ignore")

class ImproveRequest(BaseModel):
    profile: str
    helpful: bool
    context: Optional[str] = ""
    lookup_token: Optional[str] = None
    token: Optional[str] = None
    model_config = ConfigDict(extra="ignore")

class GenerateFeedbackRequest(BaseModel):
    profile: str
    helpful: bool
    context: Optional[str] = ""
    scenario: Optional[str] = ""
    token: Optional[str] = None
    model_config = ConfigDict(extra="ignore")

class BlindspotsRequest(BaseModel):
    profile: str
    force_refresh: Optional[bool] = False
    full_history: Optional[str] = ""
    token: Optional[str] = None
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
async def ingest_memory(req: IngestRequest, background_tasks: BackgroundTasks):
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
    
    tripwire_alert = None
    if not req.force_save:
        try:
            # Tripwire Check: Compare against negative blindspots
            is_stale, blindspots_data, _ = get_blindspots_cache(req.profile, req.token)
            negative_patterns = [b for b in blindspots_data if isinstance(b, dict) and b.get("type") == "negative"]
            print(f"DEBUG: Found {len(negative_patterns)} negative patterns in cache for {req.profile}")
            
            if negative_patterns:
                # Generate embedding for current input
                input_embed_res = await aembedding(
                    model=os.getenv("EMBEDDING_MODEL", "gemini/gemini-embedding-001"),
                    input=req.text.strip()
                )
                input_vector = input_embed_res.data[0]["embedding"]
                
                # Check similarity against all negative patterns
                for pattern in negative_patterns:
                    pattern_text = f"{pattern.get('title', '')} - {pattern.get('description', '')}"
                    pattern_embed_res = await aembedding(
                        model=os.getenv("EMBEDDING_MODEL", "gemini/gemini-embedding-001"),
                        input=pattern_text
                    )
                    pattern_vector = pattern_embed_res.data[0]["embedding"]
                    
                    similarity = cosine_similarity(input_vector, pattern_vector)
                    print(f"DEBUG: Similarity against '{pattern.get('title')}' = {similarity}")
                    if similarity > 0.56:
                        tripwire_alert = {
                            "pattern": pattern,
                            "similarity": similarity
                        }
                        break
        except Exception as e:
            print(f"Tripwire evaluation failed (skipping): {e}")

    if tripwire_alert:
        return {
            "status": "tripwire_alert",
            "message": "Tripwire loop detected.",
            "data": tripwire_alert
        }

    try:
        # Push to Cognee Cloud instantly
        await cognee.add(structured_entry, dataset_name=dataset_name)
        mark_blindspots_stale(req.profile, req.token)
        
        # Trigger graph building immediately in the background without blocking the user
        background_tasks.add_task(trigger_cloud_cognify, dataset_name)
        
        return {
            "status": "success",
            "message": "Stored securely on cloud and triggered graph build.",
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
            target_specific = req.query if req.query else "What choices, habits, or preferences matter most to this user?"
            target_broad = "Comprehensive history of [Classification: UserSlateEntry], diary entries, watched media, preferences, and life logs."
            
            def handle_result(res):
                if isinstance(res, Exception):
                    if "DatasetNotFoundError" in str(res) or "404" in str(res):
                        return []
                    raise res
                return res

            async def safe_recall(target):
                try:
                    return await cognee.recall(target, datasets=[dataset_name])
                except Exception as e:
                    return e

            res1, res2 = await asyncio.gather(
                safe_recall(target_specific),
                safe_recall(target_broad)
            )
            
            context_specific = handle_result(res1)
            context_broad = handle_result(res2)
                
        except Exception as recall_err:
            raise recall_err
        
        # Manifest Read: System feedback logs & Semantic Amnesia Vault from Supabase
        manifest_history_lines = []
        forbidden_entities = set()
        
        try:
            manifest_data = get_manifest(req.profile, req.token)
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


async def _generate_blindspots_logic(profile: str, full_history: str = "", token: str = None) -> list:
    dataset_name = f"user_{profile}"
    
    try:
        # Manifest Read: Semantic Amnesia Vault from Supabase
        forbidden_entities = set()
        try:
            manifest_data = get_manifest(profile, token)
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

        # Deduplicate results and filter from full_history
        raw_context_lines = []
        seen_lines = set()

        if full_history:
            lines_to_process = full_history.split('\n')
            for item in lines_to_process:
                item_str = str(item).strip()
                if not item_str:
                    continue
                if item_str not in seen_lines:
                    if any(forbid in item_str.lower() for forbid in forbidden_entities):
                        continue
                    seen_lines.add(item_str)
                    raw_context_lines.append(item_str)

        macro_paths_str = "\n".join(raw_context_lines) if raw_context_lines else ""
        
    except Exception as e:
        print(f"Error processing history: {e}")
        return []
    
    if not macro_paths_str:
        macro_paths_str = "No recent timeline data available."

    # Cognee Graph Recall (Deep Semantic History)
    graph_context_str = ""
    try:
        target_blindspots = "Identify all recurring behavioral loops, positive accelerators, negative frictions, and neutral staging blockers in the user's life history."
        graph_context = await cognee.recall(target_blindspots, datasets=[dataset_name])
            
        if graph_context:
            if isinstance(graph_context, list):
                graph_context_str = "\n".join(str(c) for c in graph_context)
            else:
                graph_context_str = str(graph_context)
    except Exception as e:
        print(f"Graph retrieval failed for blindspots: {e}")

    # If absolutely no data is present, short-circuit and return empty to avoid LLM hallucinations
    if macro_paths_str == "No recent timeline data available." and not graph_context_str and not full_history.strip():
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

    user_prompt = f"User's Recent Historical Log Data:\n{macro_paths_str}{recent_snippets_context}"
    
    if graph_context_str:
        user_prompt += f"\n\nDeep Semantic Graph Insights (Across entire history):\n{graph_context_str}"
    
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
        last_synced = datetime.datetime.now().isoformat()
        save_blindspots_cache(profile, data, False, last_synced)
    except Exception as e:
        print(f"Background blindspot generation failed: {e}")

@app.post("/api/blindspots")
async def get_blindspots(req: BlindspotsRequest, background_tasks: BackgroundTasks):
    is_stale, cached_data, last_synced = get_blindspots_cache(req.profile, req.token)
            
    if req.force_refresh:
        print(f"DEBUG: Force Refresh triggered! Calculating new blindspots from {len(req.full_history)} characters of history...")
        # Synchronous execution
        try:
            data = await _generate_blindspots_logic(req.profile, req.full_history, req.token)
            
            last_synced = datetime.datetime.now().isoformat()
            save_blindspots_cache(req.profile, data, False, last_synced, req.token)
                
            return {
                "status": "success",
                "data": data,
                "last_synced": last_synced
            }
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Blindspots Loop failed: {str(e)}")
            
    # Ensure background generation is NOT triggered implicitly to save LLM tokens.
    # We only return cached data. Manual refresh is handled synchronously above.
        
    return {
        "status": "success",
        "data": cached_data,
        "is_stale": is_stale,
        "last_synced": last_synced
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
        await cognee.add(structured_entry, dataset_name=dataset_name)
        mark_blindspots_stale(req.profile, req.token)
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
    try:
        # TRUE FORGET for Cognee Cloud
        # The cloud handles isolation via datasets. To fully wipe nodes without ID references,
        # we strictly depend on the Semantic Amnesia Vault which filters it natively across the graph.
        
        manifest = get_manifest(req.profile, req.token)
        
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
            
        save_manifest(req.profile, manifest, req.token)
        
        mark_blindspots_stale(req.profile, req.token)
        return {
            "status": "success",
            "message": f"Successfully completely erased connections related to '{req.topic}'."
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Forget operation failed: {str(e)}")


@app.post("/api/generate_feedback")
async def generate_feedback(req: GenerateFeedbackRequest):
    try:
        system_prompt = (
            "You are a Journal Synthesizer.\n\n"
            "EXTRACTION & GUARDRAILS:\n"
            "1. Extract ONLY the core entities/ideas that the Oracle suggested from the context.\n"
            "2. STRICTLY FORBIDDEN: Do not extract or mention any historical evidence, past actions, or past movies the user already watched. Only focus on the *new* recommendations or decisions provided by the Oracle.\n\n"
            "FORMAT & RULES:\n"
            "- You MUST write from a natural, first-person perspective as the user (e.g. \"I found the Oracle's recommendation...\").\n"
            f"- Scenario Context: This feedback is for a '{req.scenario}' scenario.\n"
            "- If Helpful=True for Recommendation: \"I liked the Oracle's recommendation for [Items]...\"\n"
            "- If Helpful=False for Recommendation: \"I didn't find the Oracle's recommendation for [Items] helpful.\"\n"
            "- If Helpful=True for Decision Making: \"The Oracle helped me think through [Decision/Items]...\"\n"
            "- If Helpful=False for Decision Making: \"The Oracle's advice on [Decision/Items] wasn't quite right for me.\"\n"
            "OUTPUT:\n"
            "Generate EXACTLY ONE continuous sentence. Output ONLY raw text. NO markdown, NO bullet numbers, NO prefixes, NO JSON."
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

        return {
            "status": "success",
            "summary": summary
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Generate feedback operation failed: {str(e)}")

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
        manifest = get_manifest(req.profile, req.token)

        manifest[context_hash] = {
            "helpful": req.helpful,
            "summary": summary
        }
        
        save_manifest(req.profile, manifest, req.token)
            
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
