import asyncio
import logging
from dataclasses import dataclass, field
from typing import Any, Callable, Coroutine

logger = logging.getLogger(__name__)


@dataclass
class RetryPolicy:
    max_attempts: int = 3
    base_delay: float = 30.0
    max_delay: float = 300.0
    exponential_base: float = 2.0
    retryable_exceptions: tuple = field(default_factory=lambda: (Exception,))

    def get_delay(self, attempt: int) -> float:
        delay = self.base_delay * (self.exponential_base ** attempt)
        return min(delay, self.max_delay)


async def execute_with_retry(
    policy: RetryPolicy,
    func: Callable[..., Coroutine[Any, Any, Any]],
    *args: Any,
    **kwargs: Any,
) -> Any:
    last_exception = None

    for attempt in range(policy.max_attempts):
        try:
            return await func(*args, **kwargs)
        except policy.retryable_exceptions as e:
            last_exception = e
            if attempt < policy.max_attempts - 1:
                delay = policy.get_delay(attempt)
                logger.warning(
                    "Attempt %d/%d failed: %s. Retrying in %.1fs",
                    attempt + 1,
                    policy.max_attempts,
                    str(e),
                    delay,
                )
                await asyncio.sleep(delay)
            else:
                logger.error(
                    "All %d attempts failed. Last error: %s",
                    policy.max_attempts,
                    str(e),
                )

    raise last_exception  # type: ignore
