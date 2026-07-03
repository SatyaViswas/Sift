import asyncio
import cognee
import os
import shutil

async def wipe():
    print("Wiping Cognee vector graph data...")
    # First use the official API
    try:
        await cognee.prune.prune_system()
        print("Cognee system pruned successfully.")
    except Exception as e:
        print(f"Error pruning cognee system via API: {e}")
    
    # Then manually wipe the directories just to be absolutely sure
    cognee_sys = os.path.join(os.getcwd(), 'venv/lib/python3.13/site-packages/cognee/.cognee_system')
    cognee_cache = os.path.join(os.getcwd(), 'venv/lib/python3.13/site-packages/cognee/.cognee_cache')
    cognee_home = os.path.expanduser('~/.cognee')
    
    for path in [cognee_sys, cognee_cache, cognee_home]:
        if os.path.exists(path):
            try:
                shutil.rmtree(path)
                print(f"Manually deleted {path}")
            except Exception as e:
                print(f"Failed to delete {path}: {e}")

if __name__ == "__main__":
    asyncio.run(wipe())
