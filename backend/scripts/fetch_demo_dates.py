import os
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_ANON_KEY")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# Fetch a positive trigger
res1 = supabase.table("journal_slates").select("*").ilike("content", "%meditation before opening%").limit(1).execute()
print("Meditation:", res1.data[0]['created_at'] if res1.data else "Not found")

# Fetch a negative trigger
res2 = supabase.table("journal_slates").select("*").ilike("content", "%Valorant%").limit(1).execute()
print("Valorant:", res2.data[0]['created_at'] if res2.data else "Not found")

# Fetch an effect of Valorant
res3 = supabase.table("journal_slates").select("*").ilike("content", "%destroyed. Missed my morning classes%").limit(1).execute()
print("Missed Class:", res3.data[0]['created_at'] if res3.data else "Not found")
