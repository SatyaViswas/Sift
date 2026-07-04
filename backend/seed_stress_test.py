import os
import time
import asyncio
import getpass
import random
from datetime import datetime, timedelta
from dotenv import load_dotenv
from supabase import create_client, Client, ClientOptions
import cognee

load_dotenv()
if os.getenv("LLM_API_KEY") and not os.getenv("GEMINI_API_KEY"):
    os.environ["GEMINI_API_KEY"] = os.getenv("LLM_API_KEY")

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_ANON_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("CRITICAL ERROR: Environment credentials missing.")
    exit(1)

# --- REALISTIC DATA POOLS ---

snippets = [
    "Tired today.",
    "Had a massive lunch, feeling so sleepy now.",
    "Finished the React assignment finally.",
    "Just watched some YouTube to chill.",
    "Good workout today.",
    "Feeling pretty good.",
    "Too much caffeine today, feeling jittery.",
    "Need to buy groceries later.",
    "Skipped the gym, too tired.",
    "Weather is nice, took a short walk."
]

diaries = [
    "I've been feeling immense pressure about my placement interviews lately. The constant need to balance academics with coding practice is burning me out. I need to find a better structure.",
    "Feeling completely stuck in this project. Sometimes I feel like I'm just copying things without understanding the core concepts. Need to reset my mindset.",
    "Had a long conversation with a friend today about our future careers. It made me realize I need to focus more on backend systems rather than jumping between frameworks.",
    "I am constantly worried that I am falling behind my peers. Everyone seems to have a startup or an internship. I need to stop comparing myself and just focus on my own path."
]

# Pattern 1 (Negative): Late night gaming -> Missed morning class 1-2 days later
p1_trigger = ["Stayed up until 3 AM playing Valorant.", "Got caught in a TikTok doomscrolling loop until 2:30 AM.", "Played BGMI with the squad until way past midnight."]
p1_effect = ["Woke up feeling completely destroyed. Missed my morning classes again.", "Slept through my alarm and completely missed the morning Data Science lecture.", "Feeling terrible and sluggish. Skipped morning engineering class."]

# Pattern 2 (Negative): Junk food lunch -> Afternoon brain fog / skipped coding
p2_trigger = ["Had a massive double burger and fries for lunch.", "Ate a huge pizza for lunch.", "Stuffed myself with heavy fast food at noon."]
p2_effect = ["Severe afternoon brain fog. Couldn't write a single line of code.", "Food coma hit hard. Skipped my afternoon coding session completely.", "Feeling lethargic all afternoon. Totally blew off my Leetcode practice."]

# Pattern 3 (Positive): Morning meditation -> High focus flow state
p3_trigger = ["Started the day perfectly. 15 minutes of quiet meditation before opening my laptop.", "Did my morning meditation routine. Head feels incredibly clear.", "Woke up and sat in silence for 15 minutes to clear my mind."]
p3_effect = ["My focus is razor-sharp today. Solved three complex algorithmic problems flawlessly.", "Total flow state this afternoon. Built out the entire backend logic effortlessly.", "Brain feels incredibly responsive. Crushed my Java midterm prep."]

# Pattern 4 (Neutral/Staging): Customizing IDE -> Procrastinating on actual hard task
p4_trigger = ["Spent two hours downloading new color themes for VS Code and organizing my desktop.", "Wasted a lot of time tweaking my terminal colors and organizing playlists.", "Fell down a rabbit hole installing new extensions and customizing my React IDE layout."]
p4_effect = ["Ended up pushing my actual Java studying to tomorrow because I 'ran out of time'.", "Didn't actually get any real project work done today. Kept delaying the hard coding part.", "Postponed my DevOps lab preparation again. Keep finding excuses."]

def generate_timeline(user_id):
    start_date = datetime(2023, 1, 1)
    end_date = datetime(2026, 7, 4)
    current_date = start_date
    
    supabase_rows = []
    cognee_monthly_logs = {}
    
    p1_active = False; p1_delay = 0
    p2_active = False
    p3_active = False
    p4_active = False
    
    while current_date <= end_date:
        timestamp = current_date.strftime("%Y-%m-%dT12:00:00Z")
        month_key = current_date.strftime("%Y-%m")
        
        if month_key not in cognee_monthly_logs:
            cognee_monthly_logs[month_key] = []
            
        def add_entry(text):
            supabase_rows.append({
                "content": text,
                "profile_id": user_id,
                "created_at": timestamp
            })
            cognee_text = f"[{timestamp}] {text}"
            cognee_monthly_logs[month_key].append(cognee_text)

        day_of_week = current_date.weekday()
        entry_text = ""
        
        if p1_active and p1_delay <= 0:
            entry_text = random.choice(p1_effect)
            p1_active = False
        elif p1_active:
            p1_delay -= 1
            entry_text = random.choice(snippets)
        elif random.random() < 0.15:
            pattern_choice = random.randint(1, 4)
            if pattern_choice == 1:
                entry_text = random.choice(p1_trigger)
                p1_active = True
                p1_delay = random.randint(0, 1)
            elif pattern_choice == 2:
                entry_text = f"{random.choice(p2_trigger)} {random.choice(p2_effect)}"
            elif pattern_choice == 3:
                entry_text = f"{random.choice(p3_trigger)} {random.choice(p3_effect)}"
            elif pattern_choice == 4:
                entry_text = f"{random.choice(p4_trigger)} {random.choice(p4_effect)}"
        else:
            if random.random() < 0.15:
                entry_text = random.choice(diaries)
            else:
                entry_text = random.choice(snippets)
                
        add_entry(entry_text)
        current_date += timedelta(days=1)
        
    return supabase_rows, cognee_monthly_logs

async def run_authentic_seeder():
    print("--- DÉJÀ AUTHENTIC TIMELINE SEEDER (RATE-LIMIT PROTECTED) ---")
    
    email = input("Email: ").strip()
    password = getpass.getpass("Password: ")

    print("\nAuthenticating...")
    auth_client = create_client(SUPABASE_URL, SUPABASE_KEY)
    try:
        response = auth_client.auth.sign_in_with_password({"email": email, "password": password})
        user_id = response.user.id
        access_token = response.session.access_token
        print(f"✅ Authenticated as {email} (UUID: {user_id})")
    except Exception as e:
        print(f"❌ Authentication failed: {e}")
        return

    sb_client: Client = create_client(SUPABASE_URL, SUPABASE_KEY, options=ClientOptions(
        headers={"Authorization": f"Bearer {access_token}"}
    ))
    
    print("\n1. Generating 3.5 Years of Authentic Human Data...")
    supabase_rows, cognee_monthly_logs = generate_timeline(user_id)
    print(f"Generated {len(supabase_rows)} daily entries.")
    
    print("\n2. Skipping Supabase Upload (Already populated)...")
    # chunk_size = 200
    # for i in range(0, len(supabase_rows), chunk_size):
    #     chunk = supabase_rows[i:i+chunk_size]
    #     try:
    #         sb_client.table("journal_slates").insert(chunk).execute()
    #         print(f"   Inserted rows {i} to {i+len(chunk)}...")
    #     except Exception as e:
    #         print(f"❌ Failed to insert chunk: {e}")
    #         return
            
    # print("✅ Supabase Upload Complete.")
    
    print("\n3. Building Vector Knowledge Graph via Cognee (Resuming at Month 5)...")
    dataset_name = f"user_{user_id}"
    total_months = len(cognee_monthly_logs)
    
    # Batch entries into monthly summary logs to prevent parallel LLM requests per entry
    for idx, (month, entries) in enumerate(cognee_monthly_logs.items(), 1):
        if idx < 35:
            print(f"👉 Skipping Month {idx}/{total_months} [{month}] (Already processed)")
            continue
            
        print(f"👉 Processing Month {idx}/{total_months} [{month}] ({len(entries)} entries)")
        
        # Combine all daily entries for this month into one single document
        monthly_summary_doc = f"Journal Log Summary for {month}:\n" + "\n".join(entries)
        
        # Upload as a single combined document
        await cognee.add(monthly_summary_doc, dataset_name=dataset_name)
            
        # Compile graph structure for this month
        try:
            await cognee.cognify(datasets=[dataset_name])
            print("   ✅ Graph chunk compiled successfully.")
        except Exception as e:
            if "429" in str(e) or "rate limit" in str(e).lower():
                print("   ⚠️ Hit Rate Limits! Taking a 75s recovery breathing room...")
                time.sleep(75)
                try:
                    await cognee.cognify(datasets=[dataset_name])
                    print("   ✅ Graph chunk compiled successfully after retry.")
                except Exception as retry_err:
                    print(f"   ❌ Retry failed: {retry_err}")
            else:
                print(f"   ❌ Cognify failed: {e}")
        
        # Add a mandatory sleep to respect the 15 RPM Gemini limit
        if idx < total_months:
            cooldown = 15
            print(f"   ⏳ Pacing cooldown: Waiting {cooldown}s...")
            time.sleep(cooldown)
            
    print(f"\n🎉 3.5-Year Timeline Successfully Seeded for {email}!")

if __name__ == "__main__":
    asyncio.run(run_authentic_seeder())