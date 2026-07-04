import os
import asyncio
from dotenv import load_dotenv

# Load your local configurations
load_dotenv()

async def verify_local_sdk():
    print("🚀 Initializing Local Open-Source Cognee SDK...")
    
    # We import cognee here to ensure environment variables are processed first
    import cognee
    
    print(f"• Brain Engine: {os.getenv('LLM_MODEL')}")
    print(f"• Map Engine:   {os.getenv('EMBEDDING_MODEL')}")
    
    try:
        # A simple string ingestion to force Cognee to initialize its local databases
        # This will create local database storage folders inside your directory automatically.
        print("\nTesting local database initialization & relationship engine...")
        await cognee.remember("Déjà is an ambient cognitive recovery engine.")
        
        print("\n🎉 SUCCESS! Your local Cognee SDK is fully initialized.")
        print("The database pipelines are generated locally on your machine.")
        print("You are officially ready to begin development.")
        
    except Exception as e:
        print(f"\n❌ Setup Verification Failed: {e}")
        print("Check that your Google Gemini API key is correct and active.")

if __name__ == "__main__":
    asyncio.run(verify_local_sdk())