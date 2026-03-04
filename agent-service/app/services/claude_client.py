import logging

logger = logging.getLogger(__name__)


class ClaudeClientError(Exception):
    """Raised when the LLM API call fails."""


class ClaudeClient:
    """
    Thin wrapper that delegates to llm_router so all 18 agents
    automatically use whichever provider is set as DEFAULT_MODEL
    (currently Azure OpenAI GPT-4o).
    """

    async def analyze(
        self,
        prompt: str,
        system: str = "You are an expert enterprise transformation analyst.",
        max_tokens: int = 4096,
    ) -> str:
        from app.services.llm_router import llm_router
        try:
            return await llm_router.analyze(prompt, system=system, max_tokens=max_tokens)
        except Exception as exc:
            raise ClaudeClientError(str(exc)) from exc

    async def analyze_structured(
        self,
        prompt: str,
        system: str = "You are an expert enterprise transformation analyst. Always respond with valid JSON.",
        max_tokens: int = 4096,
    ) -> str:
        from app.services.llm_router import llm_router
        try:
            return await llm_router.analyze_structured(prompt, system=system, max_tokens=max_tokens)
        except Exception as exc:
            raise ClaudeClientError(str(exc)) from exc


claude_client = ClaudeClient()
