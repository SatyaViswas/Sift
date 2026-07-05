# ⚙️ Déjà — Backend Engine (FastAPI & Node.js Gateway)

This directory contains the backend system for the Déjà Memory Recovery Engine. It runs as a dual-microservice setup inside a unified Docker container, orchestrating user accounts, long-term chronological state, and high-performance semantic graph lookups.

---

## 🏛️ Directory Layout

The backend directory has been organized into clear component folders to simplify review and local execution:

```bash
backend/
├── Dockerfile          # Multi-process Docker image (for HF Spaces, Port 7860)
├── start.sh            # Parallel bash startup script for python/node tasks
├── requirements.txt    # Python package dependencies
├── package.json        # Node.js Express server dependencies
├── server.js           # API Gateway (Node/Express, manages auth & Supabase mapping)
├── memory_bridge.py    # Cognitive Memory Bridge (FastAPI, manages Cognee SDK integration)
├── supabase_schema.sql # Row Level Security (RLS) policies and database schemas
├── scripts/            # CLI utilities and seeding tools
│   ├── auth_cognee.py       # Interactively runs Auth0 Device Flow to provision tenant API keys
│   ├── seed_stress_test.py  # Seeding tool for database stress testing
│   ├── wipe_user.py         # Wipes Supabase and Cognee database states for clean testing
│   ├── migrate_cognee.py    # Rebuilds database states during migrations
│   ├── apply_difflib_filter.py # Tool used to apply difflib filters during upgrades
│   └── wipe.js              # Supabase timeline helper purge script
├── debug_tools/        # Direct database query utilities
│   ├── query_sqlite.py      # View local Cognee SQLite state tables (`databases/cognee_db`)
│   ├── query_lancedb.py     # Inspect local LanceDB vectors and schemas
│   ├── query_nodes.py       # Print active semantic relationships in graph DB
│   ├── query_recent_data.py # Fetch most recent ingested datasets in local SQLite
│   └── query_supabase.py    # Directly inspect metadata rows in remote Supabase
└── tests/              # Verification suites
    ├── test_cognee.py       # Cognee configuration sanity checker
    ├── test_recall.py       # Vector-graph recall tests
    ├── test_remember.py     # Memory ingestion testing
    ├── test_rebuild_graph.py# Rebuild and re-cognify routines
    ├── test_speed.py        # Telemetry & speed performance testing
    └── test_*.py / js       # Miscellaneous helper test scripts
```

---

## 🏗️ The Dual-Microservice Architecture

To combine the ease of Node.js user session management and Supabase interfaces with the powerful machine-learning ecosystem of Python and Cognee, the backend is split into two co-operative processes:

### 1. API Gateway (`server.js` - Port `5051` or `7860`)
* Built with **Node.js** and **Express.js**.
* Connects to **Supabase** for user verification.
* Translates incoming authorization tokens to multi-tenant headers (`x-user-profile` / `x-user-token`) to secure downstream requests.
* Forwards heavy-duty vector and graph processing requests directly to the FastAPI server.

### 2. Cognitive Memory Bridge (`memory_bridge.py` - Port `8000`)
* Built with **Python 3.13** and **FastAPI**.
* Integrates directly with the **Cognee Python SDK** (`import cognee`).
* Runs a serialized, asynchronous worker executor to orchestrate Cognee dataset updates safely.
* Features a high-speed local classifier that bypasses default Cognee LLM answer compilation to reduce search latency by **~85%**.

---

## ⚡ Concurrency & Lock Handling

In standard implementations of Cognee Open Source, SQLite serves as the backend metadata registry. During periods of concurrent writes (e.g., ingestion tasks executing simultaneously with semantic Q&A queries), SQLite can experience file lock contention.

To prevent crashes:
1. **Serialized Async Queueing**: Heavy operations such as `cognee.cognify()` and `cognee.add()` are queued sequentially in asynchronous FastAPI background tasks.
2. **Database Fallback States**: The system catches SQLite table lock contentions and retries operations gracefully.

---

## 🔑 Environment Variables

The backend relies on the following configurations (stored in `backend/.env`):

| Variable | Description |
|---|---|
| `PORT` | Gateway port (e.g. `5051` or `7860` for spaces) |
| `COGNEE_API_KEY` | Optional: Your Cognee Cloud api key |
| `COGNEE_API_URL` | Optional: Your Cognee Cloud tenant instance URL |
| `LLM_PROVIDER` | Cognitive provider (e.g. `gemini`) |
| `LLM_MODEL` | Cognitive brain model (e.g. `gemini/gemini-3.1-flash-lite`) |
| `LLM_API_KEY` | API Key for LLM provider |
| `EMBEDDING_PROVIDER`| Embeddings provider (e.g. `gemini`) |
| `EMBEDDING_MODEL` | Embedding map model (e.g. `gemini/gemini-embedding-001`) |
| `EMBEDDING_API_KEY` | API Key for embeddings |
| `SUPABASE_URL` | Remote Supabase project URL |
| `SUPABASE_ANON_KEY` | Supabase Anonymous Client Key |

---

## 🛡️ Multi-Tenancy Design

Every request passing through the API Gateway is associated with a specific user profile (mapped using their Supabase User ID).

When interfacing with Cognee:
* The FastAPI bridge prefixes and isolates datasets by building a custom dataset identifier: `user_{uuid}`.
* In local mode, Cognee isolates these datasets into separate LanceDB directories and metadata tables.
* In Cloud mode, Cognee Cloud handles resource isolation automatically under the tenant based on the dataset namespace parameters.
