# fast_stress_test.py
import os
import json
import asyncio
import requests
from datetime import datetime, timedelta
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

FASTAPI_URL = "http://127.0.0.1:8000"
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_ANON_KEY")
PROFILE_ID = "default_user"

print("--- SIFT LIGHTNING-FAST BULK SEED ENGINE V2 ---")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("CRITICAL ERROR: Environment keys missing.")
    exit(1)

sb_client: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# --- SPRINT EXHAUSTION & ATHLETIC REJUVENATION DATA POOLS ---
dev_snippets = [
    "Struggling to hook a FastAPI backend router to React elements via local development proxies.",
    "Spent hours debugging asymmetric state loops inside my frontend component file hierarchy.",
    "Wasted an evening manually patching cross-origin credential cookies in the api router layer."
]
dev_deep_diaries = [
    "Today was a grueling full-stack development marathon. I sat at my desk for six hours straight trying to synchronize asynchronous state trees between our React dashboard elements and a Python FastAPI microservice.\n\nEverything kept breaking on the repository branch because the components were mounting before the database client could finish initializing its vector lookups.",
    "I stayed up way too late hacking through system configuration files. Trying to manually design entity-relationship diagrams in StarUML and then instantly translate those entities into rigid Supabase database constraints is causing serious architectural friction.\n\nMy terminal window is flooded with connection pool warnings. I didn't step away from my laptop screen until well past 3:30 AM."
]
academic_crashes = [
    "Felt a massive cognitive wall hitting me hard today during Design and Analysis of Algorithms exam preparation.",
    "My brain is completely fried in the computer science lab. Can't even visualize basic AVL tree adjustments or B-Tree node operations.",
    "Severe conceptual exhaustion today. I am entirely blocked trying to understand complex paging memory allocation algorithms for my B.Tech mid-terms."
]
volleyball_snippets = [
    "Booked a morning beach volleyball slot at Sportivo ECIL using the Playo app.",
    "Just finished an intense session of sand volleyball with the crew down at Sportivo.",
    "Woke up early for a high-intensity outdoor beach volleyball match via Playo."
]
volleyball_deep_diaries = [
    "What an incredible morning down at the Sportivo beach volleyball court. We played three high-intensity outdoor matches under the sand nets, and the physical release was exactly what my nervous system needed.\n\nSweating out all that full-stack engineering stress under the morning sun completely re-calibrated my focus parameters.",
    "There is something magical about stepping away from code frameworks and playing a competitive sand volleyball match via Playo. My body is physically sore from diving across the court, but my mental clarity has hit absolute peak thresholds."
]
dev_triumphs = [
    "Advanced our AgriVeda project layout beautifully today! Code integration runs were highly fluid and 100% stable.",
    "Crushed my full-stack repository feature sprint for the Smart Dine student portal. Focus was completely flawless.",
    "FastAPI backend routes are humming perfectly now. Wrote complex data science aggregation models without a single logical flaw."
]
procrastination_snippets = [
    "Spent 4 hours over-refining deep technical jargon for an upcoming presentation slide deck outline.",
    "Wasted the whole afternoon drafting highly complex, jargon-stuffed summaries for a tech post instead of testing routers.",
    "Endlessly tweaking the vocabulary and bullet layout options on our hackathon presentation overview page."
]
procrastination_deep_diaries = [
    "I spent almost the entire day trapped in a loop of secondary perfectionism. Instead of building out our clean FastAPI backend data router hooks or testing code lines, I spent four hours rewriting a single project outline overview deck.\n\nI kept over-complicating the technical terminology, stuffing it with enterprise jargon.",
    "Our team repository check-ins are falling behind schedule because I am obsessing over presentation aesthetics. I spent the afternoon re-aligning text blocks, shifting color token variables on mockups, and polishing layout structures."
]

def generate_optimized_timeline():
    start_date = datetime(2024, 1, 1)
    end_date = datetime(2026, 6, 1)
    current_date = start_date
    
    supabase_batch = []
    cognee_monthly_logs = {}
    
    idx_snip_dev, idx_deep_dev, idx_crash = 0, 0, 0
    idx_snip_vball, idx_deep_vball, idx_triumph = 0, 0, 0
    idx_snip_proc, idx_deep_proc = 0, 0
    
    while current_date <= end_date:
        timestamp = current_date.strftime("%Y-%m-%dT12:00:00Z")
        month_key = current_date.strftime("%Y-%m")
        day_of_month = current_date.day
        
        if month_key not in cognee_monthly_logs:
            cognee_monthly_logs[month_key] = []
            
        def add_entry(text):
            # Individual row format for clean frontend rendering
            supabase_batch.append({
                "content": text,
                "profile_id": PROFILE_ID,
                "created_at": timestamp
            })
            # Embedded time structural format for Cognee multi-domain tracking
            cognee_text = f"[Timestamp: {timestamp}] [Classification: UserSlateEntry] {text}"
            cognee_monthly_logs[month_key].append(cognee_text)

        # 1. Tuesday/Thursday Engineering to Academic Crash Loop
        if current_date.weekday() in [1, 3]:
            if day_of_month % 2 == 0:
                add_entry(dev_snippets[idx_snip_dev % len(dev_snippets)])
                idx_snip_dev += 1
            else:
                add_entry(dev_deep_diaries[idx_deep_dev % len(dev_deep_diaries)])
                idx_deep_dev += 1
            add_entry(academic_crashes[idx_crash % len(academic_crashes)])
            idx_crash += 1
            
        # 2. Saturday/Sunday Volleyball to Productivity Flywheel
        if current_date.weekday() in [5, 6]:
            if day_of_month % 2 == 0:
                add_entry(volleyball_snippets[idx_snip_vball % len(volleyball_snippets)])
                idx_snip_vball += 1
            else:
                add_entry(volleyball_deep_diaries[idx_deep_vball % len(volleyball_deep_diaries)])
                idx_deep_vball += 1
            add_entry(dev_triumphs[idx_triumph % len(dev_triumphs)])
            idx_triumph += 1
            
        # 3. Monthly Mid-Point Jargon Procrastination Loop
        if day_of_month in [14, 15, 16]:
            if day_of_month == 14:
                add_entry(procrastination_snippets[idx_snip_proc % len(procrastination_snippets)])
                idx_snip_proc += 1
            else:
                add_entry(procrastination_deep_diaries[idx_deep_proc % len(procrastination_deep_diaries)])
                idx_deep_proc += 1
                
        current_date += timedelta(days=1)
        
    return supabase_batch, cognee_monthly_logs

def execute_lightning_seed():
    supabase_batch, cognee_monthly_logs = generate_optimized_timeline()
    
    # 1. Execute Supabase Bulk Upload (1 single operation)
    print(f"Uploading {len(supabase_batch)} cards to Supabase Cloud in bulk...")
    try:
        sb_client.table("journal_slates").insert(supabase_batch).execute()
        print("✅ Supabase cloud tables successfully populated.")
    except Exception as e:
        print(f"Supabase error: {e}")
        
    # 2. Execute Cognee Monthly Aggregation Ingestion
    total_months = len(cognee_monthly_logs)
    print(f"Ingesting {total_months} grouped monthly digests into Cognee DB...")
    
    for i, (month_key, lines) in enumerate(cognee_monthly_logs.items(), 1):
        print(f"Processing month [{i}/{total_months}]: {month_key} ({len(lines)} structured items)")
        combined_digest_payload = "\n".join(lines)
        
        try:
            requests.post(
                f"{FASTAPI_URL}/api/ingest",
                json={"profile": PROFILE_ID, "text": combined_digest_payload}
            )
        except Exception as e:
            print(f"Connection warning at month {month_key}: {e}")
            
    print("\n🎉 Seeding complete! Database fully populated in under 30 seconds.")

if __name__ == "__main__":
    execute_lightning_seed()