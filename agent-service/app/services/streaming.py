import logging
from typing import Any

from app.services.event_bus import event_bus

logger = logging.getLogger(__name__)


class StreamingAgentRunner:
    """Wraps agent execution with streaming node-level events."""

    async def run_with_streaming(
        self,
        compiled_graph: Any,
        initial_state: dict[str, Any],
        execution_id: str,
        agent_type: str,
    ) -> dict[str, Any]:
        channel = f"execution:{execution_id}"
        result = {}

        async for event in compiled_graph.astream(initial_state):
            for node_name, node_output in event.items():
                await event_bus.publish(channel, {
                    "type": "node_start",
                    "node": node_name,
                    "agent_type": agent_type,
                    "execution_id": execution_id,
                })

                # Merge node output into result
                if isinstance(node_output, dict):
                    result.update(node_output)

                await event_bus.publish(channel, {
                    "type": "node_end",
                    "node": node_name,
                    "agent_type": agent_type,
                    "execution_id": execution_id,
                })

        return result


streaming_runner = StreamingAgentRunner()
