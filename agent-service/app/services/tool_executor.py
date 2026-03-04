"""
Anthropic tool_use API loop.

Calls Claude with tool definitions, detects ``tool_use`` content blocks in
the response, executes the requested tools, and feeds the results back until
Claude produces a final text answer (no more tool calls).
"""

from __future__ import annotations

import json
import logging
from typing import Any

import anthropic

from app.core.config import settings
from app.tools.base import BaseTool
from app.tools.registry import get_tool, get_tools_for_agent

logger = logging.getLogger(__name__)

_MAX_TOOL_ROUNDS = 10  # Safety limit to prevent infinite loops


class ToolExecutor:
    """
    Orchestrates the Anthropic tool_use conversation loop.

    Usage::

        executor = ToolExecutor()
        result = await executor.run(
            agent_type="risk_compliance",
            prompt="Analyze the risk profile of the payments-service...",
            system="You are an enterprise risk analyst.",
        )
        print(result["final_text"])
    """

    def __init__(self) -> None:
        self._client = anthropic.Anthropic(api_key=settings.anthropic_api_key)

    async def run(
        self,
        agent_type: str,
        prompt: str,
        *,
        system: str = "You are an expert enterprise transformation analyst.",
        max_tokens: int = 4096,
        extra_tools: list[BaseTool] | None = None,
    ) -> dict[str, Any]:
        """Execute the full tool-use loop.

        Parameters
        ----------
        agent_type:
            Used to resolve the tool allowlist.
        prompt:
            The user-turn prompt sent to Claude.
        system:
            The system prompt.
        max_tokens:
            Max tokens for each Claude call.
        extra_tools:
            Additional one-off tools to include beyond the agent's allowlist.

        Returns
        -------
        dict
            ``final_text`` (str), ``tool_calls`` (list of dicts describing
            each tool invocation and its result), ``rounds`` (int).
        """
        # Resolve tools for this agent
        tools = get_tools_for_agent(agent_type)
        if extra_tools:
            tools = tools + extra_tools

        tool_definitions = [t.to_anthropic_tool() for t in tools]
        tool_map: dict[str, BaseTool] = {t.name: t for t in tools}

        # Build conversation
        messages: list[dict[str, Any]] = [
            {"role": "user", "content": prompt},
        ]

        tool_call_log: list[dict[str, Any]] = []
        rounds = 0

        while rounds < _MAX_TOOL_ROUNDS:
            rounds += 1

            logger.info(
                "Tool executor round %d for agent '%s' (%d tools available)",
                rounds,
                agent_type,
                len(tool_definitions),
            )

            # Call Claude
            response = self._client.messages.create(
                model=settings.agent_model,
                max_tokens=max_tokens,
                system=system,
                messages=messages,
                tools=tool_definitions if tool_definitions else anthropic.NOT_GIVEN,
            )

            # Check for tool_use blocks
            tool_use_blocks = [
                block for block in response.content
                if block.type == "tool_use"
            ]

            if not tool_use_blocks:
                # No tool calls — extract final text
                final_text = ""
                for block in response.content:
                    if hasattr(block, "text"):
                        final_text += block.text

                logger.info(
                    "Tool executor finished after %d rounds (%d tool calls)",
                    rounds,
                    len(tool_call_log),
                )

                return {
                    "final_text": final_text,
                    "tool_calls": tool_call_log,
                    "rounds": rounds,
                    "stop_reason": response.stop_reason,
                }

            # Process each tool_use block
            # First, add the assistant's response (with tool_use) to messages
            messages.append({
                "role": "assistant",
                "content": [block.model_dump() for block in response.content],
            })

            # Execute each tool and build tool_result blocks
            tool_results: list[dict[str, Any]] = []

            for tool_block in tool_use_blocks:
                tool_name = tool_block.name
                tool_input = tool_block.input
                tool_use_id = tool_block.id

                logger.info(
                    "Executing tool '%s' (id=%s) with input: %s",
                    tool_name,
                    tool_use_id,
                    json.dumps(tool_input, default=str)[:500],
                )

                tool = tool_map.get(tool_name)
                if tool is None:
                    # Tool not found — return error to Claude
                    result_content = json.dumps({
                        "error": f"Tool '{tool_name}' is not available for agent '{agent_type}'."
                    })
                    is_error = True
                else:
                    try:
                        result = await tool.execute(**tool_input)
                        result_content = json.dumps(result, default=str)
                        is_error = False
                    except Exception as exc:
                        logger.error(
                            "Tool '%s' execution failed: %s", tool_name, exc,
                            exc_info=True,
                        )
                        result_content = json.dumps({
                            "error": f"Tool execution failed: {str(exc)}"
                        })
                        is_error = True

                tool_call_log.append({
                    "tool_name": tool_name,
                    "tool_input": tool_input,
                    "tool_use_id": tool_use_id,
                    "result": result_content[:2000],
                    "is_error": is_error,
                    "round": rounds,
                })

                tool_results.append({
                    "type": "tool_result",
                    "tool_use_id": tool_use_id,
                    "content": result_content,
                    "is_error": is_error,
                })

            # Add tool results to the conversation
            messages.append({
                "role": "user",
                "content": tool_results,
            })

        # Exceeded max rounds
        logger.warning(
            "Tool executor hit max rounds (%d) for agent '%s'",
            _MAX_TOOL_ROUNDS,
            agent_type,
        )

        return {
            "final_text": "Maximum tool execution rounds reached. Partial analysis provided.",
            "tool_calls": tool_call_log,
            "rounds": rounds,
            "stop_reason": "max_rounds",
        }


# Module-level singleton
tool_executor = ToolExecutor()
