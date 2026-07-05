import asyncio
import os
from supabase import create_client

url = os.environ.get("SUPABASE_URL", "https://leyasyhwsefnchhomhtr.supabase.co")
key = os.environ.get("SUPABASE_ANON_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxleWFzeWh3c2VmbmNoaG9taHRyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI4ODI3NDUsImV4cCI6MjA5ODQ1ODc0NX0.r6OZFUX2ix7ynwmlrKcqkggB5CJkmjr4B7S3HSNZKZI")
supabase = create_client(url, key)

res = supabase.table('journal_slates').select('*').limit(5).execute()
for r in res.data:
    print(r)
