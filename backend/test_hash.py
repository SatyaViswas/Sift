import asyncio
import cognee
import hashlib

async def main():
    dataset_name = "test_dedup"
    context = "Sample context"
    context_hash = hashlib.sha256(context.encode('utf-8')).hexdigest()
    sig = f"[ORACLE_SIG:{context_hash}]"
    text1 = f"{sig} User accepted"
    
    await cognee.remember(text1, dataset_name=dataset_name)
    
    # Try recall
    results = await cognee.recall(sig, datasets=[dataset_name])
    print("RECALL RESULTS:", results)

asyncio.run(main())
