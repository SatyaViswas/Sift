import sqlite3
import os

db_path = "/Users/satyaviswas/Documents/sift-recovery-engine/backend/venv/lib/python3.13/site-packages/cognee/.cognee_system/databases/cognee_db"

if not os.path.exists(db_path):
    print(f"DB not found at {db_path}")
else:
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    cursor.execute("SELECT id, name, raw_data_location, created_at FROM data ORDER BY created_at DESC LIMIT 10;")
    rows = cursor.fetchall()
    print("Recent data:")
    for r in rows:
        print(r)
        
        # also read the file content
        file_path = r[2].replace("file://", "")
        if os.path.exists(file_path):
            with open(file_path, "r") as f:
                content = f.read()
                print("  Content:", content)
        else:
            print("  File not found:", file_path)
            
    conn.close()
