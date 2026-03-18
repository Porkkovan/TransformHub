"""
Tests for the LLMRouter service.

Covers: routing to different providers, fallback logic, token tracking,
        usage statistics, and error handling.
"""

import os
import pytest
from unittest.mock import AsyncMock, patch, MagicMock

from app.services.llm_router import LLMRouter, _count_tokens
from app.services.llm_config import DEFAULT_MODEL, MODEL_CONFIGS


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_anthropic_mock(response_text: str = "Claude response text"):
    """Build a mock Anthropic AsyncAnthropic client that returns *response_text*."""
    mock_message = MagicMock()
    mock_message.content = [MagicMock(text=response_text)]

    mock_messages = MagicMock()
    mock_messages.create = AsyncMock(return_value=mock_message)

    mock_client = MagicMock()
    mock_client.messages = mock_messages
    return mock_client


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def router():
    """Return a fresh LLMRouter instance for each test."""
    return LLMRouter()


@pytest.fixture
def mock_claude():
    """Mock the Anthropic AsyncAnthropic client used by _call_anthropic."""
    mock_client = _make_anthropic_mock()
    with patch("anthropic.AsyncAnthropic", return_value=mock_client):
        yield mock_client


@pytest.fixture
def mock_env_no_openai():
    """Ensure OPENAI_API_KEY is not set."""
    with patch.dict(os.environ, {}, clear=False):
        os.environ.pop("OPENAI_API_KEY", None)
        os.environ.pop("GOOGLE_AI_API_KEY", None)
        yield


# ---------------------------------------------------------------------------
# Token counting
# ---------------------------------------------------------------------------


class TestTokenCounting:
    def test_count_tokens_returns_positive_integer(self):
        count = _count_tokens("Hello, world!")
        assert isinstance(count, int)
        assert count > 0

    def test_count_tokens_empty_string(self):
        count = _count_tokens("")
        assert count == 0

    def test_count_tokens_longer_text_returns_more(self):
        short = _count_tokens("Hello")
        long = _count_tokens("Hello " * 100)
        assert long > short


# ---------------------------------------------------------------------------
# Routing to Anthropic (default)
# ---------------------------------------------------------------------------


class TestAnalyzeRouting:
    @pytest.mark.asyncio
    async def test_routes_to_anthropic_by_default(self, router, mock_claude, mock_env_no_openai):
        result = await router.analyze("Explain microservices")

        assert result == "Claude response text"
        mock_claude.messages.create.assert_awaited_once()

        # Check the SDK call was made with proper args
        call_kwargs = mock_claude.messages.create.call_args[1]
        assert call_kwargs["messages"][0]["content"] == "Explain microservices"
        assert "system" in call_kwargs
        assert "max_tokens" in call_kwargs

    @pytest.mark.asyncio
    async def test_uses_custom_system_prompt(self, router, mock_claude, mock_env_no_openai):
        await router.analyze(
            "Test prompt",
            system="You are a testing assistant.",
        )

        call_kwargs = mock_claude.messages.create.call_args[1]
        assert call_kwargs["system"] == "You are a testing assistant."

    @pytest.mark.asyncio
    async def test_uses_specified_model_preference(self, router, mock_claude, mock_env_no_openai):
        """When a claude model is specified, it still routes to anthropic."""
        result = await router.analyze(
            "Test",
            model_preference="claude-haiku-3.5",
        )

        assert result == "Claude response text"
        mock_claude.messages.create.assert_awaited_once()

        # max_tokens should be capped by the model config
        call_kwargs = mock_claude.messages.create.call_args[1]
        haiku_max = MODEL_CONFIGS["claude-haiku-3.5"]["max_tokens"]
        assert call_kwargs["max_tokens"] <= haiku_max

    @pytest.mark.asyncio
    async def test_respects_max_tokens_limit_from_model_config(self, router, mock_claude, mock_env_no_openai):
        """max_tokens passed to analyze should be capped by model's max_tokens."""
        await router.analyze(
            "Test",
            max_tokens=999999,  # Much larger than any model config
            model_preference="claude-opus-4",
        )

        call_kwargs = mock_claude.messages.create.call_args[1]
        opus_max = MODEL_CONFIGS["claude-opus-4"]["max_tokens"]
        assert call_kwargs["max_tokens"] == opus_max


# ---------------------------------------------------------------------------
# analyze_structured
# ---------------------------------------------------------------------------


class TestAnalyzeStructured:
    @pytest.mark.asyncio
    async def test_analyze_structured_routes_to_anthropic(self, router, mock_claude, mock_env_no_openai):
        result = await router.analyze_structured("Return JSON analysis")

        assert result == "Claude response text"
        mock_claude.messages.create.assert_awaited_once()

        call_kwargs = mock_claude.messages.create.call_args[1]
        assert "JSON" in call_kwargs["system"]


# ---------------------------------------------------------------------------
# Usage tracking
# ---------------------------------------------------------------------------


class TestUsageTracking:
    @pytest.mark.asyncio
    async def test_tracks_usage_after_successful_call(self, router, mock_claude, mock_env_no_openai):
        await router.analyze("Count my tokens", model_preference="claude-sonnet-4-5")

        usage = router.get_usage()
        assert "claude-sonnet-4-5" in usage
        entry = usage["claude-sonnet-4-5"]
        assert entry["requests"] == 1
        assert entry["input_tokens"] > 0
        assert entry["output_tokens"] > 0
        assert entry["cost"] > 0.0

    @pytest.mark.asyncio
    async def test_accumulates_usage_across_calls(self, router, mock_claude, mock_env_no_openai):
        await router.analyze("First call",  model_preference="claude-sonnet-4-5")
        await router.analyze("Second call", model_preference="claude-sonnet-4-5")

        usage = router.get_usage()
        assert usage["claude-sonnet-4-5"]["requests"] == 2

    @pytest.mark.asyncio
    async def test_tracks_per_model_usage(self, router, mock_claude, mock_env_no_openai):
        await router.analyze("Sonnet call", model_preference="claude-sonnet-4-5")
        await router.analyze("Haiku call", model_preference="claude-haiku-3.5")

        usage = router.get_usage()
        assert "claude-sonnet-4-5" in usage
        assert "claude-haiku-3.5" in usage
        assert usage["claude-sonnet-4-5"]["requests"] == 1
        assert usage["claude-haiku-3.5"]["requests"] == 1

    @pytest.mark.asyncio
    async def test_cost_differs_between_models(self, router, mock_claude, mock_env_no_openai):
        """More expensive models should track higher costs for same content."""
        mock_claude.messages.create = AsyncMock(
            return_value=MagicMock(content=[MagicMock(text="Same response for both")])
        )

        await router.analyze("Same prompt", model_preference="claude-haiku-3.5")
        await router.analyze("Same prompt", model_preference="claude-opus-4")

        usage = router.get_usage()
        haiku_cost = usage["claude-haiku-3.5"]["cost"]
        opus_cost = usage["claude-opus-4"]["cost"]
        # Opus is significantly more expensive per token
        assert opus_cost > haiku_cost

    def test_reset_usage_clears_all_stats(self, router):
        # Manually inject some usage
        router._usage["test-model"]["requests"] = 5
        router._usage["test-model"]["input_tokens"] = 1000

        router.reset_usage()
        assert router.get_usage() == {}

    def test_get_usage_returns_dict_copy(self, router):
        usage = router.get_usage()
        assert isinstance(usage, dict)


# ---------------------------------------------------------------------------
# Fallback logic
# ---------------------------------------------------------------------------


class TestFallback:
    @pytest.mark.asyncio
    async def test_falls_back_to_openai_when_primary_fails(self, router):
        """When the primary model fails and OPENAI_API_KEY is set,
        it should attempt gpt-4o as fallback."""
        mock_client = _make_anthropic_mock()
        mock_client.messages.create = AsyncMock(side_effect=Exception("Claude down"))

        with (
            patch("anthropic.AsyncAnthropic", return_value=mock_client),
            patch.dict(os.environ, {"OPENAI_API_KEY": "test-openai-key"}),
        ):
            # Mock the OpenAI call
            with patch.object(router, "_call_openai", new_callable=AsyncMock) as mock_openai:
                mock_openai.return_value = "OpenAI fallback response"

                result = await router.analyze("Test fallback")

                assert result == "OpenAI fallback response"
                mock_openai.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_falls_back_to_default_claude_when_openai_not_available(self, router):
        """When non-default model fails and no OPENAI_API_KEY, fall back to default Claude."""
        call_count = 0

        async def side_effect_create(**kwargs):
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                raise Exception("Haiku is down")
            msg = MagicMock()
            msg.content = [MagicMock(text="Default Claude response")]
            return msg

        mock_client = MagicMock()
        mock_client.messages = MagicMock()
        mock_client.messages.create = AsyncMock(side_effect=side_effect_create)

        with (
            patch("anthropic.AsyncAnthropic", return_value=mock_client),
            patch.dict(os.environ, {}, clear=False),
        ):
            os.environ.pop("OPENAI_API_KEY", None)

            result = await router.analyze(
                "Test",
                model_preference="claude-haiku-3.5",
            )

            assert result == "Default Claude response"

    @pytest.mark.asyncio
    async def test_raises_when_all_providers_fail(self, router):
        """When no API keys are set and Claude mock fails, RuntimeError is raised."""
        mock_client = _make_anthropic_mock()
        mock_client.messages.create = AsyncMock(side_effect=Exception("All broken"))

        with (
            patch("anthropic.AsyncAnthropic", return_value=mock_client),
            patch.dict(
                os.environ,
                {},
                clear=True,  # clear ALL env vars so no provider key is set
            ),
        ):
            # Set only the keys needed by the app config
            os.environ["DATABASE_URL"] = "postgresql://test:test@localhost:5432/testdb"

            with pytest.raises(RuntimeError, match="All LLM providers failed"):
                await router.analyze("This will fail")


# ---------------------------------------------------------------------------
# Unknown model / provider
# ---------------------------------------------------------------------------


class TestEdgeCases:
    @pytest.mark.asyncio
    async def test_raises_on_unknown_model(self, router, mock_env_no_openai):
        """Requesting an unknown model_preference should raise KeyError
        from get_model_config, then fallback should also fail."""
        mock_client = _make_anthropic_mock()
        with patch("anthropic.AsyncAnthropic", return_value=mock_client):
            # Unknown model triggers KeyError in _dispatch -> falls to _fallback
            # _fallback tries default Claude model which should succeed
            result = await router.analyze(
                "Test",
                model_preference="nonexistent-model",
            )
            # Should have fallen back to default claude model
            assert result == "Claude response text"

    @pytest.mark.asyncio
    async def test_analyze_structured_also_has_fallback(self, router):
        """analyze_structured should also fall back on failure."""
        call_count = 0

        async def side_effect_create(**kwargs):
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                raise Exception("First try fails")
            msg = MagicMock()
            msg.content = [MagicMock(text='{"result": "fallback"}')]
            return msg

        mock_client = MagicMock()
        mock_client.messages = MagicMock()
        mock_client.messages.create = AsyncMock(side_effect=side_effect_create)

        with (
            patch("anthropic.AsyncAnthropic", return_value=mock_client),
            patch.dict(os.environ, {}, clear=False),
        ):
            os.environ.pop("OPENAI_API_KEY", None)

            result = await router.analyze_structured(
                "Get JSON",
                model_preference="claude-haiku-3.5",
            )

            assert result == '{"result": "fallback"}'
