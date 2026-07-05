import sqlite3
import os

db_path = "/Users/satyaviswas/Documents/sift-recovery-engine/backend/venv/lib/python3.13/site-packages/cognee/.cognee_system/databases/cognee_db"

if not os.path.exists(db_path):
    print(f"DB not found at {db_path}")
else:
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    cursor.execute("PRAGMA table_info(data);")
    print("Columns of 'data':", cursor.fetchall())
    
    cursor.execute("SELECT * FROM data LIMIT 5;")
    print("Sample data from 'data':", cursor.fetchall())
    
    # Try to find pickel ball
    cursor.execute("SELECT * FROM data WHERE raw_data LIKE '%pickel ball%';")
    print("Matches for pickel ball:", cursor.fetchall())
    
    conn.close()
