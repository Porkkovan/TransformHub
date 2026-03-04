"""
DAG definition for the TransformHub pipeline.

Defines the full agent execution pipeline with topological sort and parallel
group detection.  The canonical ordering is:

    git_integration
        -> discovery
            -> [lean_vsm, risk_compliance, architecture, market_intelligence, data_governance]  (parallel)
                -> [fiduciary, product_transformation]  (parallel)
                    -> backlog_okr
                        -> future_state_vision
"""

from __future__ import annotations

import logging
from collections import defaultdict, deque
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class DAGNode:
    """Single node in the pipeline DAG."""
    name: str
    depends_on: frozenset[str] = field(default_factory=frozenset)


@dataclass
class ParallelGroup:
    """A group of agents that can execute concurrently."""
    agents: list[str]

    def __repr__(self) -> str:
        return f"ParallelGroup({self.agents})"


class PipelineDAG:
    """
    Directed Acyclic Graph for the agent pipeline.

    Supports:
      - topological sort (Kahn's algorithm)
      - grouping into parallel execution layers
      - cycle detection
    """

    def __init__(self) -> None:
        self._nodes: dict[str, DAGNode] = {}
        self._adj: dict[str, set[str]] = defaultdict(set)      # node -> successors
        self._in_degree: dict[str, int] = defaultdict(int)

    # ------------------------------------------------------------------
    # Graph construction
    # ------------------------------------------------------------------

    def add_node(self, name: str, depends_on: list[str] | None = None) -> None:
        deps = frozenset(depends_on or [])
        node = DAGNode(name=name, depends_on=deps)
        self._nodes[name] = node

        # Ensure node appears in degree map even when it has no dependencies
        if name not in self._in_degree:
            self._in_degree[name] = 0

        for dep in deps:
            self._adj[dep].add(name)
            self._in_degree[name] += 1

            # Ensure dependency node exists in degree map
            if dep not in self._in_degree:
                self._in_degree[dep] = 0

    # ------------------------------------------------------------------
    # Topological sort (Kahn's algorithm)
    # ------------------------------------------------------------------

    def topological_sort(self) -> list[str]:
        """Return a topological ordering of the DAG nodes.

        Raises ``ValueError`` if the graph contains a cycle.
        """
        in_deg = dict(self._in_degree)
        queue: deque[str] = deque()

        for node in self._nodes:
            if in_deg.get(node, 0) == 0:
                queue.append(node)

        result: list[str] = []

        while queue:
            current = queue.popleft()
            result.append(current)
            for successor in sorted(self._adj.get(current, [])):
                in_deg[successor] -= 1
                if in_deg[successor] == 0:
                    queue.append(successor)

        if len(result) != len(self._nodes):
            missing = set(self._nodes.keys()) - set(result)
            raise ValueError(
                f"Pipeline DAG contains a cycle involving: {missing}"
            )

        return result

    # ------------------------------------------------------------------
    # Parallel group detection
    # ------------------------------------------------------------------

    def parallel_groups(self) -> list[ParallelGroup]:
        """Return execution layers where each layer's agents can run in parallel.

        Each :class:`ParallelGroup` contains agents whose dependencies are
        satisfied by all groups that precede it.
        """
        in_deg = dict(self._in_degree)
        queue: deque[str] = deque()

        for node in self._nodes:
            if in_deg.get(node, 0) == 0:
                queue.append(node)

        groups: list[ParallelGroup] = []

        while queue:
            # All nodes in the current queue form one parallel layer
            layer: list[str] = sorted(queue)
            groups.append(ParallelGroup(agents=layer))
            next_queue: deque[str] = deque()

            for current in layer:
                for successor in sorted(self._adj.get(current, [])):
                    in_deg[successor] -= 1
                    if in_deg[successor] == 0:
                        next_queue.append(successor)

            queue = next_queue

        return groups

    # ------------------------------------------------------------------
    # Introspection helpers
    # ------------------------------------------------------------------

    @property
    def node_names(self) -> list[str]:
        return list(self._nodes.keys())

    def get_dependencies(self, name: str) -> frozenset[str]:
        node = self._nodes.get(name)
        if node is None:
            raise KeyError(f"Unknown pipeline node: {name}")
        return node.depends_on

    def get_successors(self, name: str) -> set[str]:
        return set(self._adj.get(name, set()))


# ---------------------------------------------------------------------------
# Canonical TransformHub pipeline
# ---------------------------------------------------------------------------

def build_default_pipeline() -> PipelineDAG:
    """Construct the default TransformHub pipeline DAG.

    Execution order::

        Layer 1:  git_integration
        Layer 2:  discovery
        Layer 3:  lean_vsm | risk_compliance | architecture | market_intelligence | data_governance
        Layer 4:  fiduciary | product_transformation
        Layer 5:  backlog_okr
        Layer 6:  future_state_vision
    """
    dag = PipelineDAG()

    # Layer 1
    dag.add_node("git_integration")

    # Layer 2
    dag.add_node("discovery", depends_on=["git_integration"])

    # Layer 3 -- parallel analysis agents
    parallel_analysis = [
        "lean_vsm",
        "risk_compliance",
        "architecture",
        "market_intelligence",
        "data_governance",
    ]
    for agent in parallel_analysis:
        dag.add_node(agent, depends_on=["discovery"])

    # Layer 4 -- parallel synthesis agents
    synthesis_deps = parallel_analysis
    dag.add_node("fiduciary", depends_on=synthesis_deps)
    dag.add_node("product_transformation", depends_on=synthesis_deps)

    # Layer 5
    dag.add_node("backlog_okr", depends_on=["fiduciary", "product_transformation"])

    # Layer 6
    dag.add_node("future_state_vision", depends_on=["backlog_okr"])

    logger.info(
        "Default pipeline DAG built with %d nodes, %d layers",
        len(dag.node_names),
        len(dag.parallel_groups()),
    )

    return dag


# Module-level singleton used by the pipeline graph runner
default_pipeline = build_default_pipeline()
