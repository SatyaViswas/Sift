import asyncio
import cognee

async def authenticate():
    print("Initiating Auth0 Device Code Flow...")
    # By omitting url and api_key, this forces the Auth0 login flow
    client = await cognee.serve()
    print("\n✅ Successfully authenticated!")
    print(f"Service URL: {client.service_url}")
    print(f"API Key: {client.api_key}")
    print("\nCopy the Service URL and API Key above and put them in your .env file!")

if __name__ == "__main__":
    asyncio.run(authenticate())
