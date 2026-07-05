import asyncio
import cognee

async def wipe():
    print("Wiping cognee data...")
    try:
        await cognee.prune.prune_data()
        await cognee.prune.prune_system(metadata=True)
        print("Data and system pruned successfully.")
    except Exception as e:
        print(f"Error during pruning: {e}")

if __name__ == "__main__":
    asyncio.run(wipe())
