import os
from contextlib import contextmanager
from typing import Optional

from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.resources import Resource


_tracer: Optional[trace.Tracer] = None


def setup_tracing(service_name: str = "transformhub-agents"):
    global _tracer
    resource = Resource.create({"service.name": service_name})
    provider = TracerProvider(resource=resource)
    trace.set_tracer_provider(provider)
    _tracer = trace.get_tracer(service_name)


def get_tracer() -> trace.Tracer:
    global _tracer
    if _tracer is None:
        setup_tracing()
        _tracer = trace.get_tracer("transformhub-agents")
    return _tracer


@contextmanager
def trace_agent_node(agent_type: str, node_name: str):
    tracer = get_tracer()
    with tracer.start_as_current_span(
        f"{agent_type}.{node_name}",
        attributes={
            "agent.type": agent_type,
            "agent.node": node_name,
        },
    ) as span:
        try:
            yield span
        except Exception as e:
            span.set_attribute("error", True)
            span.set_attribute("error.message", str(e))
            raise
