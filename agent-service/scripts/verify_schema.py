#!/usr/bin/env python3
"""
Schema Verification Script for TransformHub Agent Service
==========================================================

This script verifies that all database tables required by the agent-service
exist in the PostgreSQL database before the service starts. The schema is
managed by Prisma (from the Next.js side), so this script does NOT create
or modify tables -- it only checks for their presence.

Usage:
    python scripts/verify_schema.py

    Or as a Docker entrypoint pre-check:
    python scripts/verify_schema.py && uvicorn app.main:app ...

Exit codes:
    0 - All required tables exist
    1 - One or more tables are missing or connection failed
"""

import asyncio
import os
import sys

import asyncpg


# ---------------------------------------------------------------------------
# All tables that the agent-service reads from or writes to.
# Grouped by functional area for clarity.
# ---------------------------------------------------------------------------
REQUIRED_TABLES: dict[str, list[str]] = {
    "Core / Discovery": [
        "repositories",
        "digital_products",
        "digital_capabilities",
        "functionalities",
        "product_groups",
        "value_stream_steps",
        "persona_mappings",
    ],
    "Agent Execution": [
        "agent_executions",
        "dead_letter_jobs",
        "agent_versions",
    ],
    "Risk & Compliance": [
        "risk_assessments",
        "compliance_mappings",
    ],
    "VSM": [
        "vsm_metrics",
    ],
    "Audit": [
        "audit_logs",
    ],
    "Pipeline & Orchestration": [
        "pipeline_executions",
        "pipeline_agent_statuses",
        "approval_requests",
        "shared_context",
    ],
    "RAG & Chat": [
        "code_embeddings",
        "chat_conversations",
        "chat_messages",
    ],
    "Memory & Learning": [
        "agent_memories",
        "agent_feedbacks",
    ],
    "Notifications": [
        "notification_configs",
        "notification_logs",
    ],
    "Roadmap": [
        "roadmap_items",
    ],
    "Auth (read-only)": [
        "users",
        "sessions",
        "accounts",
        "organizations",
    ],
}


async def verify_schema(dsn: str) -> bool:
    """Connect to the database and verify all required tables exist.

    Returns True if all tables are present, False otherwise.
    """
    try:
        conn = await asyncpg.connect(dsn=dsn, timeout=10)
    except Exception as exc:
        print(f"[ERROR] Failed to connect to database: {exc}")
        return False

    try:
        # Fetch all existing tables from the public schema
        rows = await conn.fetch(
            """
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public'
              AND table_type = 'BASE TABLE'
            """
        )
        existing_tables = {row["table_name"] for row in rows}

        all_ok = True
        total_required = 0
        total_found = 0

        print("=" * 60)
        print("TransformHub Schema Verification")
        print("=" * 60)

        for group_name, tables in REQUIRED_TABLES.items():
            print(f"\n  {group_name}:")
            for table in tables:
                total_required += 1
                if table in existing_tables:
                    total_found += 1
                    print(f"    [OK]   {table}")
                else:
                    all_ok = False
                    print(f"    [MISS] {table}")

        print(f"\n{'=' * 60}")
        print(f"Result: {total_found}/{total_required} tables found")

        if all_ok:
            print("Status: ALL REQUIRED TABLES PRESENT")
        else:
            missing = []
            for tables in REQUIRED_TABLES.values():
                for table in tables:
                    if table not in existing_tables:
                        missing.append(table)
            print(f"Status: MISSING TABLES: {', '.join(missing)}")
            print(
                "\nHint: Run Prisma migrations from the nextjs-app service first:\n"
                "  docker compose exec nextjs-app npx prisma migrate deploy"
            )

        print("=" * 60)

        # Also check for the pgvector extension
        ext_row = await conn.fetchrow(
            "SELECT extname FROM pg_extension WHERE extname = 'vector'"
        )
        if ext_row:
            print("[OK]   pgvector extension installed")
        else:
            print("[WARN] pgvector extension NOT installed (required for RAG/embeddings)")
            print("       Run: CREATE EXTENSION IF NOT EXISTS vector;")

        return all_ok

    finally:
        await conn.close()


async def main() -> int:
    dsn = os.environ.get("DATABASE_URL")
    if not dsn:
        print("[ERROR] DATABASE_URL environment variable is required")
        return 1

    ok = await verify_schema(dsn)
    return 0 if ok else 1


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)
