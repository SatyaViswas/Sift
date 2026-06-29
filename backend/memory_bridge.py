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
            
            # Immediate Paradox Analysis Loop
            prompt = "Identify any specific rules, past outcomes, or behavioral loops in this user's history that directly relate to or conflict with the topics mentioned in the current text input."
            historical_context = await cognee.recall(prompt, datasets=[dataset_name])
            
            if isinstance(historical_context, list):
                historical_context_str = " ".join([str(item) for item in historical_context])
            else:
                historical_context_str = str(historical_context)

            # The Conflict Evaluation Logic
            system_prompt = (
                "You are a Cognitive Guard. Your job is to review a user's new journal entry alongside their historical context. "
                "Analyze the entry strictly for true behavioral loops, contradictions, or critical lifestyle patterns. "
                "If no meaningful contradiction or pattern is found, you MUST return exactly: {\"status\": \"saved\"}. "
                "If a contradiction or loop is found, return {\"status\": \"conflict\", \"message\": \"<conversational warning>\"}. "
                "If a meaningful positive insight is found, return {\"status\": \"insight\", \"message\": \"<conversational feedback>\"}. "
                "Output ONLY valid JSON, with no markdown formatting."
            )
            
            user_prompt = f"Historical Context:\n{historical_context_str}\n\nNew Entry:\n{text}"

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
                parsed = json.loads(analysis_result)
                if parsed.get("status") in ["insight", "conflict"]:
                    response = {
                        "status": parsed["status"],
                        "message": parsed.get("message", "Pattern detected.")
                    }
                else:
                    response = {
                        "status": "success", 
                        "message": "Your thoughts are safely stored."
                    }
            except json.JSONDecodeError:
                # Fallback if LLM didn't return valid JSON
                response = {
                    "status": "success",
                    "message": "Your thoughts are safely stored."
                }
        except Exception as e:
            # Wrap ingestion exceptions to ensure the crash is safely stringified
            raise Exception(f"Ingestion or Paradox Loop failed: {str(e)}")

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
                "You are a Conversational Pattern Analyst. Analyze the user's input query to determine their true intent "
                "(e.g., Wellness/Anxiety relief, Entertainment/Boredom, Productivity optimization, or General recall). "
                "Based on the historical graph data provided, infer their tastes and preferences. "
                "STRICT DEDUPLICATION RULE: Identify what they have already explicitly tried, watched, or consumed in their history, "
                "and EXCLUDE those exact items from your recommendation. Suggest a new, highly similar alternative instead. "
                "You must output your decision strictly as a clean JSON object with EXACTLY these four keys: "
                "`type` (must be one of: 'wellness', 'entertainment', 'general'), "
                "`headline` (a brief, punchy title for your suggestion), "
                "`recommendation` (the actionable advice or item suggestion), and "
                "`rationale` (why this fits their pattern based on history). "
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
