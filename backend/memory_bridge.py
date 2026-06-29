import sys
import json
import os
import asyncio
from dotenv import load_dotenv

import cognee
from litellm import acompletion

# 1. Load environment variables dynamically
load_dotenv()

# Map custom env keys to what litellm expects for Gemini
if os.getenv("LLM_API_KEY") and not os.getenv("GEMINI_API_KEY"):
    os.environ["GEMINI_API_KEY"] = os.getenv("LLM_API_KEY")

async def main():
    # 2. Setup standard system arguments parsing
    if len(sys.argv) < 4:
        raise ValueError("Missing required arguments. Expected: memory_bridge.py <profile> <action> <data_json_string>")

    profile = sys.argv[1]
    action = sys.argv[2]
    
    try:
        data = json.loads(sys.argv[3])
    except json.JSONDecodeError:
        raise ValueError("Data argument must be a valid JSON string.")

    response = {}

    # 4. Operational placeholder match/case or if/else block
    if action == "health_check":
        # Baseline test case action handler to verify environment
        response = {
            "status": "success",
            "message": "Python bridge is operational.",
            "profile_received": profile,
            "action_received": action,
            "data_received": data,
            "environment_check": {
                "gemini_api_key_set": bool(os.getenv("GEMINI_API_KEY") or os.getenv("LLM_API_KEY"))
            }
        }
    elif action == "ingest":
        text = data.get("text")
        if not text:
            raise ValueError("Missing 'text' in data payload for ingest action.")

        dataset_name = f"user_{profile}"
        
        try:
            # Core Ingestion Path
            await cognee.remember(text, dataset_name=dataset_name)
            
            response = {
                "status": "success",
                "message": "Stored!"
            }
        except Exception as e:
            # Wrap ingestion exceptions to ensure the crash is safely stringified
            raise Exception(f"Ingestion failed: {str(e)}")

    elif action == "recover":
        query = data.get("query", "")
        dataset_name = f"user_{profile}"
        try:
            prompt = query if query else "What choices, habits, or preferences matter most to this user?"
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
            user_prompt = f"Historical Context:\n{context_str}\n\nUser Query/State:\n{query}"

            llm_response = await acompletion(
                model=os.getenv("LLM_MODEL", "gemini/gemini-3.1-flash-lite"),
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ]
            )
            
            analysis_result = llm_response.choices[0].message.content.strip()
            
            # Clean up potential markdown formatting block if LLM disobeys
            if analysis_result.startswith("```json"):
                analysis_result = analysis_result[7:-3].strip()
            elif analysis_result.startswith("```"):
                analysis_result = analysis_result[3:-3].strip()
            
            # Make sure it's valid JSON before returning
            try:
                response_json = json.loads(analysis_result)
                response = {
                    "status": "success",
                    "data": response_json
                }
            except json.JSONDecodeError:
                response = {
                    "status": "error",
                    "message": "LLM failed to output valid JSON for the recovery strategy.",
                    "raw_output": analysis_result
                }

        except Exception as e:
            raise Exception(f"Recover Loop failed: {str(e)}")

    elif action == "blindspots":
        dataset_name = f"user_{profile}"
        try:
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
                response = {
                    "status": "success",
                    "data": response_json
                }
            except json.JSONDecodeError:
                response = {
                    "status": "error",
                    "message": "LLM failed to output a valid JSON array for blindspots.",
                    "raw_output": analysis_result
                }

        except Exception as e:
            raise Exception(f"Blindspots Loop failed: {str(e)}")

    elif action == "update":
        new_text = data.get("new_text") or data.get("newText", "")
        original_text = data.get("original_text") or data.get("originalText", "")

        if not new_text or not new_text.strip():
            response = {"status": "error", "message": "Missing or empty 'newText' payload for update action."}
        else:
            dataset_name = f"user_{profile}"
            try:
                # Re-cognify the corrected entry into the user's memory layer
                await cognee.remember(new_text.strip(), dataset_name=dataset_name)
                response = {
                    "status": "success",
                    "message": "Memory successfully updated."
                }
            except OSError as io_err:
                # Suppress file-lock / IO race conditions gracefully
                response = {
                    "status": "error",
                    "message": f"IO error during memory update: {str(io_err)}"
                }
            except Exception as e:
                err_msg = str(e)
                # Suppress known SQLite / DB concurrency lock noise
                if "database is locked" in err_msg.lower() or "lock" in err_msg.lower():
                    response = {
                        "status": "error",
                        "message": "Memory store temporarily locked. Please retry in a moment."
                    }
                else:
                    raise Exception(f"Update pipeline failed: {err_msg}")

    else:
        # Handle unknown actions
        response = {
            "status": "error",
            "message": f"Unknown action: {action}"
        }

    # Print the resulting JSON payload so Express can capture it cleanly
    print(json.dumps(response))

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except Exception as e:
        # 3. Configure structured error catching
        # Print a clean, stringified JSON error object and exit gracefully
        print(json.dumps({"status": "error", "message": str(e)}))
        sys.exit(1)
