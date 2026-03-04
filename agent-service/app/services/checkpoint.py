import json
import logging
from typing import Any, Optional

from app.core.redis import redis_pool

logger = logging.getLogger(__name__)

CHECKPOINT_TTL = 86400  # 24 hours


class CheckpointStore:
    def _key(self, execution_id: str) -> str:
        return f"checkpoint:{execution_id}"

    async def save(
        self,
        execution_id: str,
        node_name: str,
        state: dict[str, Any],
    ) -> None:
        try:
            data = {
                "node": node_name,
                "state": state,
            }
            await redis_pool.client.set(
                self._key(execution_id),
                json.dumps(data, default=str),
                ex=CHECKPOINT_TTL,
            )
        except Exception as e:
            logger.warning("Checkpoint save failed for %s: %s", execution_id, e)

    async def load(self, execution_id: str) -> Optional[dict[str, Any]]:
        try:
            raw = await redis_pool.client.get(self._key(execution_id))
            if raw is None:
                return None
            return json.loads(raw)
        except Exception as e:
            logger.warning("Checkpoint load failed for %s: %s", execution_id, e)
            return None

    async def clear(self, execution_id: str) -> None:
        try:
            await redis_pool.client.delete(self._key(execution_id))
        except Exception as e:
            logger.warning("Checkpoint clear failed for %s: %s", execution_id, e)


checkpoint_store = CheckpointStore()
