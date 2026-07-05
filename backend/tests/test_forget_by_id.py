import asyncio
import os
import sqlite3
import uuid
import cognee
from dotenv import load_dotenv

load_dotenv()
if os.getenv("LLM_API_KEY") and not os.getenv("GEMINI_API_KEY"):
    os.environ["GEMINI_API_KEY"] = os.getenv("LLM_API_KEY")

async def main():
    dataset_name = "user_default_user"
    db_path = "/Users/satyaviswas/Documents/sift-recovery-engine/backend/venv/lib/python3.13/site-packages/cognee/.cognee_system/databases/cognee_db"
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    cursor.execute("SELECT id, raw_data_location FROM data")
    rows = cursor.fetchall()
    
    data_ids_to_forget = []
    
    for row in rows:
        data_id_hex = row[0]
        file_path = row[1].replace("file://", "")
        if os.path.exists(file_path):
            try:
                with open(file_path, "r", encoding="utf-8") as f:
                    content = f.read()
                    if "pickel ball" in content.lower() or "picket ball" in content.lower():
                        print(f"Found match in {data_id_hex}: {content}")
                        data_ids_to_forget.append(uuid.UUID(data_id_hex))
            except Exception as e:
                pass
                
    conn.close()
    
    print(f"Forgetting {len(data_ids_to_forget)} items...")
    for d_id in data_ids_to_forget:
        res = await cognee.forget(data_id=d_id, dataset=dataset_name)
        print("Forget result:", res)
        
if __name__ == "__main__":
    asyncio.run(main())
