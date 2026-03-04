"""Tests for the in-process event bus."""

import asyncio
import pytest
from app.services.event_bus import EventBus


@pytest.fixture
def bus():
    return EventBus()


@pytest.mark.asyncio
async def test_publish_and_subscribe(bus):
    received = []

    async def consume():
        async for event in bus.subscribe("ch1"):
            received.append(event)
            if event.get("type") == "done":
                break

    task = asyncio.create_task(consume())
    await asyncio.sleep(0.05)

    await bus.publish("ch1", {"type": "progress", "node": "step1"})
    await bus.publish("ch1", {"type": "done"})

    await asyncio.wait_for(task, timeout=2.0)
    assert len(received) == 2
    assert received[0]["node"] == "step1"


@pytest.mark.asyncio
async def test_close_channel_ends_iteration(bus):
    received = []

    async def consume():
        async for event in bus.subscribe("ch2"):
            received.append(event)

    task = asyncio.create_task(consume())
    await asyncio.sleep(0.05)

    await bus.publish("ch2", {"msg": "hello"})
    await asyncio.sleep(0.05)
    await bus.close_channel("ch2")

    await asyncio.wait_for(task, timeout=2.0)
    assert len(received) == 1


@pytest.mark.asyncio
async def test_multiple_subscribers(bus):
    results_a = []
    results_b = []

    async def consume_a():
        async for event in bus.subscribe("ch3"):
            results_a.append(event)

    async def consume_b():
        async for event in bus.subscribe("ch3"):
            results_b.append(event)

    ta = asyncio.create_task(consume_a())
    tb = asyncio.create_task(consume_b())
    await asyncio.sleep(0.05)

    await bus.publish("ch3", {"v": 1})
    await asyncio.sleep(0.05)
    await bus.close_channel("ch3")

    await asyncio.wait_for(ta, timeout=2.0)
    await asyncio.wait_for(tb, timeout=2.0)

    assert len(results_a) == 1
    assert len(results_b) == 1
