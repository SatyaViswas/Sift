import os
import getpass
import asyncio
from dotenv import load_dotenv
from supabase import create_client, Client, ClientOptions
import cognee

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_ANON_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("CRITICAL ERROR: Supabase credentials missing in .env")
    exit(1)

async def main():
    print("--- DÉJÀ ACCOUNT WIPE PROTOCOL ---")
    
    # Initialize Cognee Cloud connection if variables are present
    service_url = os.getenv("COGNEE_SERVICE_URL") or os.getenv("COGNEE_API_URL")
    api_key = os.getenv("COGNEE_API_KEY")
    if service_url and api_key:
        print(f"Connecting to Cognee Cloud at {service_url}...")
        try:
            await cognee.serve(url=service_url, api_key=api_key)
            print("Successfully connected to Cognee Cloud.")
        except Exception as e:
            print(f"Failed to connect to Cognee Cloud: {e}")
            return
    else:
        print("Running in local database mode.")
        
    print("This will completely erase all your memories and vector cache from both Supabase and Cognee DB.")

    email = input("Email: ").strip()
    password = getpass.getpass("Password: ")

    print("\nAuthenticating...")
    auth_client = create_client(SUPABASE_URL, SUPABASE_KEY)

    try:
        response = auth_client.auth.sign_in_with_password({"email": email, "password": password})
        user_id = response.user.id
        access_token = response.session.access_token
        print(f"✅ Successfully authenticated as {email} (UUID: {user_id})")
    except Exception as e:
        print(f"❌ Authentication failed: {e}")
        exit(1)

    # Now create an authenticated client using the JWT
    sb_client: Client = create_client(SUPABASE_URL, SUPABASE_KEY, options=ClientOptions(
        headers={"Authorization": f"Bearer {access_token}"}
    ))

    print("\n1. Executing Supabase Wipe...")

    # Delete journal_slates
    try:
        res = sb_client.table("journal_slates").delete().eq("profile_id", user_id).execute()
        print(f"   ✅ Deleted {len(res.data)} journal entries from database.")
    except Exception as e:
        print(f"   ❌ Failed to delete journal_slates: {e}")

    # Reset user_metadata
    try:
        res = sb_client.table("user_metadata").delete().eq("profile", user_id).execute()
        print(f"   ✅ Reset user_metadata config/manifest.")
    except Exception as e:
        print(f"   ❌ Failed to reset user_metadata: {e}")

    print("\n2. Executing Cognee Vector Graph Wipe...")
    try:
        all_datasets = await cognee.datasets.list_datasets()
        target_name = f"user_{user_id}"
        target_ds = None
        for ds in all_datasets:
            if getattr(ds, "name", None) == target_name:
                target_ds = ds
                break
                
        if target_ds:
            print(f"   Found dataset {target_name} (ID: {target_ds.id}). Clearing...")
            await cognee.datasets.empty_dataset(target_ds.id)
            print(f"   ✅ Successfully wiped Cognee dataset.")
        else:
            print(f"   ℹ️ No Cognee graph found for {target_name} (already clean).")
    except Exception as e:
        print(f"   ❌ Failed to clear Cognee graph: {e}")

    print("\n🎉 Wipe complete! The account is now a clean slate on both SQL and Vector databases.")

if __name__ == "__main__":
    asyncio.run(main())
