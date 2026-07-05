import asyncio
import os
import lancedb

async def main():
    db_path = "/Users/satyaviswas/Documents/sift-recovery-engine/backend/venv/lib/python3.13/site-packages/cognee/.cognee_system/databases/lancedb"
    if not os.path.exists(db_path):
        print(f"LanceDB not found at {db_path}")
        return
        
    db = lancedb.connect(db_path)
    print("Tables in LanceDB:", db.table_names())
    
    for table_name in db.table_names():
        try:
            table = db.open_table(table_name)
            df = table.to_pandas()
            print(f"\n--- Table {table_name} ---")
            print("Columns:", df.columns.tolist())
            print(f"Total rows: {len(df)}")
            
            # Find any row containing 'pickel' or 'pickle'
            matches = []
            for idx, row in df.iterrows():
                row_str = str(row.to_dict()).lower()
                if 'pickel' in row_str or 'pickle' in row_str:
                    matches.append(row)
                    
            print(f"Matches for pickle: {len(matches)}")
            for m in matches:
                print(m)
        except Exception as e:
            print(f"Error reading table {table_name}: {e}")

if __name__ == "__main__":
    asyncio.run(main())
