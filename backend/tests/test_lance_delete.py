import os
import lance

def main():
    table_dir = "/Users/satyaviswas/Documents/sift-recovery-engine/backend/venv/lib/python3.13/site-packages/cognee/.cognee_system/databases/679cb15b-ff96-4cb2-b7fc-84f5729815cd/d00e27d9-9975-52cb-877e-c5ba0a600064.lance.db"
    
    if os.path.exists(table_dir):
        print(f"Opening lance dataset at: {table_dir}")
        try:
            ds = lance.dataset(table_dir)
            print("Columns:", ds.schema.names)
            print("Total rows:", ds.count_rows())
            
            # Print a few rows
            if 'text' in ds.schema.names:
                df = ds.to_table().to_pandas()
                matches = df[df['text'].str.contains('pickel|pickle', case=False, na=False)]
                print(f"Matches for pickle: {len(matches)}")
                for idx, row in matches.iterrows():
                    print("ID:", row.get('id'), "Text:", row.get('text'))
                    
                # Delete test
                # ds.delete("text LIKE '%pickle%'")
        except Exception as e:
            print("Error:", e)

if __name__ == "__main__":
    main()
