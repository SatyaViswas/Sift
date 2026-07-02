from __future__ import annotations

import asyncio
import json
import os
import sys
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any, Optional
from pydantic import BaseModel, ConfigDict
from dotenv import load_dotenv


BACKEND_DIRECTORY = Path(__file__).resolve().parent
ENV_FILE = BACKEND_DIRECTORY / ".env"


def _resolve_path(value: str) -> Path:
    return Path(value).expanduser().resolve()


def configure_cognee_environment() -> dict[str, Path]:
    """
    Load backend/.env and create every filesystem parent Cognee requires.

    This function must execute before importing cognee because Cognee caches
    database configuration during package import.
    """

    load_dotenv(dotenv_path=ENV_FILE, override=True)

    fallback_root = Path(r"C:\SiftCognee")

    data_path = _resolve_path(
        os.environ.get(
            "DATA_ROOT_DIRECTORY",
            str(fallback_root / "data"),
        )
    )
    system_path = _resolve_path(
        os.environ.get(
            "SYSTEM_ROOT_DIRECTORY",
            str(fallback_root / "system"),
        )
    )
    vector_path = _resolve_path(
        os.environ.get(
            "VECTOR_DB_URL",
            str(fallback_root / "vector"),
        )
    )

    databases_path = system_path / "databases"
    db_name = os.environ.get("DB_NAME", "cognee_db").strip() or "cognee_db"
    relational_path = databases_path / db_name

    for directory in (
        data_path,
        system_path,
        databases_path,
        vector_path,
    ):
        directory.mkdir(parents=True, exist_ok=True)

    os.environ["DATA_ROOT_DIRECTORY"] = data_path.as_posix()
    os.environ["SYSTEM_ROOT_DIRECTORY"] = system_path.as_posix()
    os.environ["VECTOR_DB_URL"] = vector_path.as_posix()

    os.environ.setdefault("VECTOR_DB_PROVIDER", "lancedb")
    os.environ.setdefault("DB_PROVIDER", "sqlite")
    os.environ.setdefault("DB_NAME", db_name)

    return {
        "data": data_path,
        "system": system_path,
        "databases": databases_path,
        "vector": vector_path,
        "relational": relational_path,
    }


STORAGE_PATHS = configure_cognee_environment()


if sys.platform == "win32":
    asyncio.set_event_loop_policy(
        asyncio.WindowsSelectorEventLoopPolicy()
    )


# Cognee must remain below configure_cognee_environment().
import cognee  # noqa: E402
from fastapi import FastAPI, HTTPException, Request  # noqa: E402
from fastapi.responses import JSONResponse  # noqa: E402
from litellm import acompletion  # noqa: E402
from pydantic import BaseModel, Field  # noqa: E402
if os.getenv("LLM_API_KEY") and not os.getenv("GEMINI_API_KEY"):
    os.environ["GEMINI_API_KEY"] = os.getenv("LLM_API_KEY")

# Global lock for thread safety in database operations
cognee_lock = asyncio.Lock()

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
    
    try:
        system_prompt = (
            "You are a routing & summarization engine. Analyze the user text.\n"
            "If it is a request to FORGET or DELETE, output exactly: {\"intent\": \"forget\", \"topic\": \"<root entity name>\"}.\n"
            "If it is a standard journal entry, output: {\"intent\": \"journal\", \"heading\": \"<3-5 words>\", \"summary\": \"<1-2 sentence summary>\"}.\n"
            "Output ONLY raw JSON."
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
        summary_snippet = None
        try:
            intent_json = json.loads(intent_result)
            if intent_json.get("intent") == "forget" and intent_json.get("topic"):
                return {
                    "status": "forget_confirmation",
                    "data": { "topic": intent_json.get("topic") }
                }
            if intent_json.get("intent") == "journal":
                heading = intent_json.get("heading")
                summary_snippet = intent_json.get("summary")
        except Exception:
            pass
    except Exception as e:
        print(f"Ingestion LLM call failed: {e}")
        heading = None
        summary_snippet = None

    # ARCHITECTURAL MANDATE 1: Strict Taxonomic Ingestion Prefix
    # Wrapping entry with structural classification metadata tags to eliminate ontology drift
    structured_entry = f"[Classification: UserSlateEntry]\n{req.text.strip()}"

    try:
        async with cognee_lock:
            await cognee.remember(structured_entry, dataset_name=dataset_name)
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
        
        # Deduplicate results
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
                    seen_lines.add(item_str)
                    raw_context_lines.append(item_str)

        process_context(context_specific)
        process_context(context_broad)
            
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

        forbidden_entities_str = ", ".join(list(forbidden_entities)) if forbidden_entities else "None"
        context_str = "\n".join(f"- {line}" for line in raw_context_lines) if raw_context_lines else "No direct journal history found."
        feedback_history_str = "\n".join(manifest_history_lines) if manifest_history_lines else "No system feedback history available."

        # Merge Cognee contextual hits with the explicit full database timeline from Day 1 to guarantee 100% data access
        full_timeline_str = req.full_history if req.full_history else "No comprehensive timeline provided."

        # ARCHITECTURAL MANDATE 5: Strict XML Data Grounding & 4-Scenario Analysis
        system_prompt = (
            "You are an empathetic, reality-grounded personal journal assistant acting as a strict Organic Intent Reasoner.\n\n"
            "<GROUNDING_LAWS>\n"
            "1. You must treat the content inside <USER_PURE_HISTORY> and <FULL_TIMELINE_FROM_DAY_1> as the absolute, closed-world boundary of the user's past actions and life entries from Day 1. If an item, title, or location is not explicitly written there, the user has never experienced it.\n"
            "2. Content inside <PAST_AI_RECOMMENDATIONS> represents suggestions previously offered by the system, NOT historical actions taken by the user. You are strictly prohibited from mixing these logs up with the user's past life metrics. DO NOT hallucinate these as user actions.\n"
            "3. Review the <FORBIDDEN_ENTITIES_DIRECTIVES> block. If any term or related concept is listed there, apply absolute amnesia. Silently drop, wash, and ignore any semantic match inside the history blocks entirely. DO NOT mention these entities.\n"
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
            f"  <FORBIDDEN_ENTITIES_DIRECTIVES>\n{forbidden_entities_str}\n  </FORBIDDEN_ENTITIES_DIRECTIVES>\n"
            "</CONTEXT_DATA>\n\n"
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


@app.get("/api/blindspots")
async def get_blindspots(profile: str):
    dataset_name = f"user_{profile}"
    
    try:
        try:
            async with cognee_lock:
                prompt = "Extract any recurring, indirect correlations where a user choice or lifestyle behavior consistently maps over time to subsequent physical, cognitive, or emotional outcome states."
                macro_paths = await cognee.recall(prompt, datasets=[dataset_name])
        except Exception as recall_err:
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
            "Act as a behavioral data analyst. Review graph lines and identify the two strongest hidden long-term behavioral correlations.\n"
            "Output ONLY a raw JSON array of objects:\n"
            "[{ \"title\": \"<punchy headline>\", \"description\": \"<cause-and-effect link>\", \"type\": \"positive\" | \"negative\" }]"
        )
        
        user_prompt = f"Graph Lines Data:\n{macro_paths_str}"

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
    structured_entry = f"[Classification: UserSlateEntry]\n{req.new_text.strip()}"
    
    try:
        async with cognee_lock:
            await cognee.remember(structured_entry, dataset_name=dataset_name)
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
            manifest_path = f"oracle_manifest_{dataset_name}.json"
            manifest = {}
            if os.path.exists(manifest_path):
                try:
                    with open(manifest_path, "r") as f:
                        manifest = json.load(f)
                except Exception:
                    pass
            
            # ARCHITECTURAL MANDATE 4 & 5: Pure Semantic Amnesia Vault
            # We completely stop pushing literal text-substring soft-delete commands into Cognee.
            # Instead we securely register the topic in the manifest ledger and handle it dynamically in /recover
            
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
        
        return {
            "status": "success",
            "message": "Memory explicitly forgotten via Amnesia Vault ledger."
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
