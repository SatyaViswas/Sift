from __future__ import annotations

import argparse
import asyncio
import os
import sys
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv


BACKEND_DIRECTORY = Path(__file__).resolve().parent
ENV_FILE = BACKEND_DIRECTORY / ".env"


@dataclass(frozen=True)
class CogneeStoragePaths:
    data: Path
    system: Path
    databases: Path
    vector: Path
    relational: Path


def _resolve_path(value: str) -> Path:
    return Path(value).expanduser().resolve()


def configure_environment() -> CogneeStoragePaths:
    """
    Load backend/.env and create every parent directory required by Cognee.

    This must run before importing cognee because Cognee builds cached runtime
    configuration objects during package import.
    """

    load_dotenv(dotenv_path=ENV_FILE, override=True)

    fallback_root = Path(r"C:\SiftCognee")

    data_path = _resolve_path(
        os.environ.get(
            "DATA_ROOT_DIRECTORY",
            str(fallback_root / "data"),
        )
    )
    system_path = _resolve_path(
        os.environ.get(
            "SYSTEM_ROOT_DIRECTORY",
            str(fallback_root / "system"),
        )
    )
    vector_path = _resolve_path(
        os.environ.get(
            "VECTOR_DB_URL",
            str(fallback_root / "vector"),
        )
    )

    databases_path = system_path / "databases"
    db_name = os.environ.get("DB_NAME", "cognee_db").strip() or "cognee_db"
    relational_path = databases_path / db_name

    for directory in (
        data_path,
        system_path,
        databases_path,
        vector_path,
    ):
        directory.mkdir(parents=True, exist_ok=True)

    os.environ["DATA_ROOT_DIRECTORY"] = data_path.as_posix()
    os.environ["SYSTEM_ROOT_DIRECTORY"] = system_path.as_posix()
    os.environ["VECTOR_DB_URL"] = vector_path.as_posix()

    os.environ.setdefault("VECTOR_DB_PROVIDER", "lancedb")
    os.environ.setdefault("DB_PROVIDER", "sqlite")
    os.environ.setdefault("DB_NAME", db_name)

    return CogneeStoragePaths(
        data=data_path,
        system=system_path,
        databases=databases_path,
        vector=vector_path,
        relational=relational_path,
    )


STORAGE_PATHS = configure_environment()


if sys.platform == "win32":
    asyncio.set_event_loop_policy(
        asyncio.WindowsSelectorEventLoopPolicy()
    )


# Cognee must remain below configure_environment().
import cognee  # noqa: E402


def ensure_storage_directories() -> None:
    for directory in (
        STORAGE_PATHS.data,
        STORAGE_PATHS.system,
        STORAGE_PATHS.databases,
        STORAGE_PATHS.vector,
    ):
        directory.mkdir(parents=True, exist_ok=True)


def display_runtime_configuration() -> None:
    print("Sift Cognee storage configuration:")
    print(f"  Environment file : {ENV_FILE}")
    print(f"  Data root        : {STORAGE_PATHS.data}")
    print(f"  System root      : {STORAGE_PATHS.system}")
    print(f"  Databases root   : {STORAGE_PATHS.databases}")
    print(f"  Vector root      : {STORAGE_PATHS.vector}")
    print(f"  SQLite target    : {STORAGE_PATHS.relational}")
    print(f"  DB provider      : {os.environ.get('DB_PROVIDER')}")
    print(f"  DB name          : {os.environ.get('DB_NAME')}")
    print(
        "  Access control   : "
        f"{os.environ.get('ENABLE_BACKEND_ACCESS_CONTROL', '<default>')}"
    )
    print(
        "  Authentication   : "
        f"{os.environ.get('REQUIRE_AUTHENTICATION', '<default>')}"
    )


async def reset_database() -> None:
    """
    Permanently remove the configured Cognee raw data, graph, vector,
    relational metadata, and caches.
    """

    print("Resetting configured Cognee storage...")

    await cognee.prune.prune_data()
    await cognee.prune.prune_system(
        graph=True,
        vector=True,
        metadata=True,
        cache=True,
    )

    ensure_storage_directories()
    print("Cognee storage reset completed.")


async def initialize_relational_database() -> None:
    """
    Create or migrate Cognee's SQLite metadata schema before traffic arrives.
    """

    ensure_storage_directories()
    print("Running Cognee startup migrations...")
    await cognee.run_migrations()
    print("Relational database is ready.")


async def run_storage_smoke_test() -> None:
    """
    Exercise SQLite metadata, graph storage, and LanceDB vector persistence.
    """

    dataset_name = "sift_storage_health"

    print("Running graph and vector persistence smoke test...")

    result = await cognee.remember(
        (
            "Sift storage health check. "
            "The local Cognee relational, graph, and vector layers are writable."
        ),
        dataset_name=dataset_name,
        self_improvement=False,
    )

    print("Storage smoke test completed.")
    print(f"Remember result: {result}")


async def initialize(
    reset: bool,
    smoke_test: bool,
) -> None:
    print("Initializing Sift Cognee persistence layers...")
    display_runtime_configuration()

    ensure_storage_directories()

    if reset:
        await reset_database()

    await initialize_relational_database()

    if smoke_test:
        await run_storage_smoke_test()

    print("Cognee initialization completed successfully.")


def parse_arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Initialize and validate Sift's Cognee storage.",
    )

    parser.add_argument(
        "--reset",
        action="store_true",
        help=(
            "Permanently erase the Cognee storage configured in backend/.env "
            "before rebuilding it."
        ),
    )

    parser.add_argument(
        "--smoke-test",
        action="store_true",
        help=(
            "Run a real remember() operation to validate relational, graph, "
            "and vector persistence."
        ),
    )

    return parser.parse_args()


def main() -> None:
    arguments = parse_arguments()

    try:
        asyncio.run(
            initialize(
                reset=arguments.reset,
                smoke_test=arguments.smoke_test,
            )
        )
    except KeyboardInterrupt:
        print("\nInitialization cancelled.")
        raise SystemExit(130)
    except Exception as error:
        print(
            "Initialization failed: "
            f"{type(error).__name__}: {error}"
        )
        raise SystemExit(1) from error


if __name__ == "__main__":
    main()