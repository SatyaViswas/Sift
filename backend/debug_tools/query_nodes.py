import sqlite3
import os

db_path = "/Users/satyaviswas/Documents/sift-recovery-engine/backend/venv/lib/python3.13/site-packages/cognee/.cognee_system/databases/cognee_db"

if not os.path.exists(db_path):
    print(f"DB not found at {db_path}")
else:
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    cursor.execute("PRAGMA table_info(nodes);")
    print("Columns of 'nodes':", cursor.fetchall())
    
    # search for pickel ball or pickleball
    cursor.execute("SELECT * FROM nodes WHERE attributes LIKE '%pickel%' OR attributes LIKE '%pickle%';")
    matches = cursor.fetchall()
    print("Matches for pickle:", len(matches))
    for m in matches:
        print(m)
        
    conn.close()
