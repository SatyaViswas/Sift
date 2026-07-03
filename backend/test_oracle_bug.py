import requests
import json
import time
from datetime import datetime, timezone

def test():
    text = "I love the movie Inception because of its mind-bending plot."
    print("Adding memory...")
    res_add = requests.post(
        'http://127.0.0.1:5051/api/memory/ingest',
        json={
            "text": text,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "isSnippet": True
        }
    )
    print("Add response:", res_add.json())

    time.sleep(2)

    print("\nQuerying Oracle...")
    res_oracle = requests.post(
        'http://127.0.0.1:5051/api/memory/recover',
        json={"question": "What movies do I like?"}
    )
    print("Oracle response:", json.dumps(res_oracle.json(), indent=2))

if __name__ == "__main__":
    test()
