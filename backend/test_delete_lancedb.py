import lancedb
import os

db_path = "/Users/satyaviswas/Documents/sift-recovery-engine/backend/venv/lib/python3.13/site-packages/cognee/.cognee_system/databases/679cb15b-ff96-4cb2-b7fc-84f5729815cd"

if os.path.exists(db_path):
    print("Connecting to db_path:", db_path)
    db = lancedb.connect(db_path)
    
    # The directory has d00e27d9-9975-52cb-877e-c5ba0a600064.lance.db
    # In LanceDB, the table name is usually without the .lance or .lance.db
    tables = [d for d in os.listdir(db_path) if d.endswith(".lance.db") or d.endswith(".lance")]
    print("Found lance directories:", tables)
    
    for t_dir in tables:
        table_name = t_dir.replace(".lance.db", "").replace(".lance", "")
        print(f"Opening table: {table_name}")
        try:
            table = db.open_table(table_name)
            df = table.to_pandas()
            print("Columns:", df.columns.tolist())
            print("Total rows:", len(df))
            
            # Print a sample text if it exists
            if 'text' in df.columns:
                print("Sample text:", df['text'].iloc[0] if len(df)>0 else "No text")
                
                # Search for pickelball or pickleball
                matches = df[df['text'].str.contains('pickel|pickle', case=False, na=False)]
                print(f"Matches for pickle in {table_name}: {len(matches)}")
                for idx, row in matches.iterrows():
                    print("Match ID:", row.get('id'), "Text:", row.get('text'))
        except Exception as e:
            print("Error opening table:", e)
