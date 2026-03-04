"""
Learning service that turns user feedback into agent memories and retrieves
relevant learned context for prompt injection.

Works with the memory service to create a feedback loop:
  1. User submits rating/corrections via the feedback API.
  2. ``process_feedback`` stores corrections as high-confidence memories.
  3. Before each agent run, ``get_learning_context`` pulls relevant memories
     and formats them as additional prompt context.
"""

from __future__ import annotations

import json
import logging
from typing import Any, Optional

from app.core.database import db_pool
from app.services.memory import memory_service

logger = logging.getLogger(__name__)


class LearningService:
    """Converts feedback into memories and prepares learning context."""

    # ------------------------------------------------------------------
    # Process feedback
    # ------------------------------------------------------------------

    async def process_feedback(
        self,
        execution_id: str,
        rating: int,
        corrections: Optional[dict[str, Any]] = None,
    ) -> list[str]:
        """Process user feedback and store corrections as memories.

        Parameters
        ----------
        execution_id:
            The agent execution this feedback refers to.
        rating:
            User rating from 1 to 5.
        corrections:
            Optional dict of field-level corrections, e.g.::

                {
                    "risk_level": "should be HIGH, not MEDIUM",
                    "missing_items": ["GDPR compliance", "SOC2"],
                }

        Returns
        -------
        list[str]
            Memory IDs created from corrections.
        """
        # Look up execution to get agent_type and org context
        execution = await db_pool.fetchrow(
            """
            SELECT agent_type, input
            FROM agent_executions
            WHERE id = $1
            """,
            execution_id,
        )

        if not execution:
            logger.warning("Execution %s not found for feedback processing", execution_id)
            return []

        agent_type = execution["agent_type"]

        # Try to extract org_id from the input data
        input_data = execution["input"]
        if isinstance(input_data, str):
            try:
                input_data = json.loads(input_data)
            except json.JSONDecodeError:
                input_data = {}

        org_id = ""
        if isinstance(input_data, dict):
            org_info = input_data.get("organization", {})
            if isinstance(org_info, dict):
                org_id = org_info.get("id", "")

        memory_ids: list[str] = []

        # Map rating to a base confidence for corrections
        # Low ratings (1-2) with corrections are very important lessons
        # High ratings (4-5) corrections are minor refinements
        if rating <= 2:
            base_confidence = 0.95
        elif rating <= 3:
            base_confidence = 0.8
        else:
            base_confidence = 0.6

        # Store each correction as a separate memory
        if corrections:
            for field, correction in corrections.items():
                correction_value = correction if isinstance(correction, str) else json.dumps(correction, default=str)
                key = f"correction:{agent_type}:{field}"

                memory_id = await memory_service.store(
                    agent_type=agent_type,
                    org_id=org_id,
                    memory_type="correction",
                    key=key,
                    value={
                        "field": field,
                        "correction": correction_value,
                        "rating": rating,
                        "execution_id": execution_id,
                    },
                    confidence=base_confidence,
                )
                memory_ids.append(memory_id)

        # If rating is very low, store a general "needs improvement" memory
        if rating <= 2 and not corrections:
            key = f"low_rating:{agent_type}:{execution_id}"
            memory_id = await memory_service.store(
                agent_type=agent_type,
                org_id=org_id,
                memory_type="feedback",
                key=key,
                value={
                    "rating": rating,
                    "execution_id": execution_id,
                    "note": "User rated this output poorly; review for quality issues.",
                },
                confidence=0.7,
            )
            memory_ids.append(memory_id)

        logger.info(
            "Processed feedback for execution=%s agent=%s rating=%d corrections=%d memories=%d",
            execution_id,
            agent_type,
            rating,
            len(corrections) if corrections else 0,
            len(memory_ids),
        )

        return memory_ids

    # ------------------------------------------------------------------
    # Get learning context
    # ------------------------------------------------------------------

    async def get_learning_context(
        self,
        agent_type: str,
        org_id: str,
        limit: int = 10,
    ) -> str:
        """Retrieve relevant memories and format them as prompt context.

        Returns a multi-line string that can be injected into the system
        prompt or prepended to the user prompt.
        """
        # Fetch corrections (highest priority)
        corrections = await memory_service.recall(
            agent_type=agent_type,
            org_id=org_id,
            memory_type="correction",
            limit=limit,
        )

        # Fetch learned patterns
        patterns = await memory_service.recall(
            agent_type=agent_type,
            org_id=org_id,
            memory_type="learned_pattern",
            limit=limit // 2,
        )

        # Fetch general context memories
        context_memories = await memory_service.recall(
            agent_type=agent_type,
            org_id=org_id,
            memory_type="context",
            limit=limit // 2,
        )

        lines: list[str] = []

        if corrections:
            lines.append("## Previous Corrections (apply these lessons):")
            for mem in corrections:
                val = mem.get("value", {})
                if isinstance(val, dict):
                    field = val.get("field", "unknown")
                    correction = val.get("correction", "")
                    lines.append(f"- {field}: {correction}")
                else:
                    lines.append(f"- {mem.get('key', '')}: {val}")

        if patterns:
            lines.append("")
            lines.append("## Learned Patterns:")
            for mem in patterns:
                val = mem.get("value", {})
                if isinstance(val, dict):
                    lines.append(f"- {val.get('description', str(val))}")
                else:
                    lines.append(f"- {val}")

        if context_memories:
            lines.append("")
            lines.append("## Organization Context:")
            for mem in context_memories:
                val = mem.get("value", {})
                if isinstance(val, dict):
                    lines.append(f"- {mem.get('key', '')}: {val.get('summary', str(val))}")
                else:
                    lines.append(f"- {mem.get('key', '')}: {val}")

        if not lines:
            return ""

        header = f"### Learning Context for {agent_type} agent (org: {org_id})\n"
        return header + "\n".join(lines)


# Module-level singleton
learning_service = LearningService()
