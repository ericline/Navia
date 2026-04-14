"""One-shot bootstrap: enable pgvector on production Postgres and backfill vectors.

Run on Railway after deploying the pgvector changes:

    railway run python -m scripts.enable_pgvector

Steps (all idempotent):
1. Verify DATABASE_URL points to Postgres.
2. CREATE EXTENSION IF NOT EXISTS vector.
3. ALTER TABLE places ADD COLUMN IF NOT EXISTS embedding_vec vector(384).
4. Backfill embedding_vec from the JSON `embedding` column (batches of 500).
5. CREATE INDEX IF NOT EXISTS places_embedding_vec_idx USING ivfflat (...).
   Index creation is done AFTER the backfill so ivfflat can cluster on real data.
"""
from __future__ import annotations

import json
import logging
import sys
import time

from dotenv import load_dotenv
load_dotenv()

from sqlalchemy import text

from database import SQLALCHEMY_DATABASE_URL, engine, SessionLocal

logging.basicConfig(level=logging.INFO, format="%(asctime)s  %(message)s")
logger = logging.getLogger(__name__)

BATCH_SIZE = 500
IVFFLAT_LISTS = 100


def main() -> int:
    if not SQLALCHEMY_DATABASE_URL.startswith("postgresql"):
        print("ERROR: This script only runs on Postgres. DATABASE_URL is:",
              SQLALCHEMY_DATABASE_URL.split("@")[-1] if "@" in SQLALCHEMY_DATABASE_URL else SQLALCHEMY_DATABASE_URL)
        return 1

    started = time.time()

    # Step 1 + 2: extension + column
    with engine.begin() as conn:
        logger.info("Ensuring pgvector extension...")
        conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
        logger.info("Adding embedding_vec column if missing...")
        conn.execute(text(
            "ALTER TABLE places ADD COLUMN IF NOT EXISTS embedding_vec vector(384)"
        ))

    # Step 3: backfill
    session = SessionLocal()
    total_rows = 0
    backfilled = 0
    skipped_null = 0
    try:
        total_rows = session.execute(text("SELECT COUNT(*) FROM places")).scalar_one()
        logger.info("Total places: %d", total_rows)

        while True:
            rows = session.execute(text(
                "SELECT id, embedding FROM places "
                "WHERE embedding_vec IS NULL "
                "LIMIT :lim"
            ), {"lim": BATCH_SIZE}).all()

            if not rows:
                break

            batch_updates = 0
            for row_id, emb_json in rows:
                if not emb_json:
                    skipped_null += 1
                    # Mark as processed by writing a sentinel isn't possible for a
                    # vector column — rely on the embedding IS NOT NULL invariant
                    # going forward. If this row has no JSON embedding, ingestion
                    # never produced one; leaving embedding_vec NULL is correct.
                    continue
                try:
                    vec = json.loads(emb_json)
                except (ValueError, TypeError):
                    skipped_null += 1
                    continue
                # pgvector's text-literal form: "[0.1,0.2,...]"
                lit = "[" + ",".join(f"{float(x):.8f}" for x in vec) + "]"
                session.execute(
                    text("UPDATE places SET embedding_vec = CAST(:v AS vector) WHERE id = :id"),
                    {"v": lit, "id": row_id},
                )
                batch_updates += 1

            session.commit()
            backfilled += batch_updates
            logger.info("Backfilled %d (running total: %d)", batch_updates, backfilled)

            # Safety: if a batch produced 0 updates AND 0 nulls, we'd loop forever.
            # Break when nothing in this batch changed state.
            if batch_updates == 0:
                break
    finally:
        session.close()

    # Step 4: index (after backfill so ivfflat clusters on real data)
    with engine.begin() as conn:
        logger.info("Creating ivfflat index (lists=%d)...", IVFFLAT_LISTS)
        conn.execute(text(
            f"CREATE INDEX IF NOT EXISTS places_embedding_vec_idx "
            f"ON places USING ivfflat (embedding_vec vector_cosine_ops) "
            f"WITH (lists = {IVFFLAT_LISTS})"
        ))
        # Help the query planner pick up the new index + column stats.
        conn.execute(text("ANALYZE places"))

    elapsed = time.time() - started
    print()
    print(f"Done in {elapsed:.1f}s")
    print(f"  total places:  {total_rows}")
    print(f"  backfilled:    {backfilled}")
    print(f"  skipped null:  {skipped_null}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
