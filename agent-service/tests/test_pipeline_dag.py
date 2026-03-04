"""Tests for pipeline DAG topological sort and parallel groups."""

import pytest
from app.agents.pipeline.dag import PipelineDAG, ParallelGroup


@pytest.fixture
def simple_dag():
    dag = PipelineDAG()
    dag.add_node("a")
    dag.add_node("b", depends_on=["a"])
    dag.add_node("c", depends_on=["a"])
    dag.add_node("d", depends_on=["b", "c"])
    return dag


def test_topological_sort_valid(simple_dag):
    order = simple_dag.topological_sort()
    assert order.index("a") < order.index("b")
    assert order.index("a") < order.index("c")
    assert order.index("b") < order.index("d")
    assert order.index("c") < order.index("d")


def test_parallel_groups(simple_dag):
    groups = simple_dag.parallel_groups()
    assert groups[0].agents == ["a"]
    assert set(groups[1].agents) == {"b", "c"}
    assert groups[2].agents == ["d"]


def test_cycle_detection():
    dag = PipelineDAG()
    dag.add_node("x")
    dag.add_node("y", depends_on=["x"])
    # Manually add a back-edge to create a cycle
    dag._adj["y"].add("x")
    dag._in_degree["x"] += 1
    with pytest.raises(ValueError, match="cycle"):
        dag.topological_sort()


def test_single_node():
    dag = PipelineDAG()
    dag.add_node("solo")
    assert dag.topological_sort() == ["solo"]
    groups = dag.parallel_groups()
    assert len(groups) == 1
    assert groups[0].agents == ["solo"]


def test_linear_chain():
    dag = PipelineDAG()
    dag.add_node("a")
    dag.add_node("b", depends_on=["a"])
    dag.add_node("c", depends_on=["b"])
    groups = dag.parallel_groups()
    assert len(groups) == 3
    assert groups[0].agents == ["a"]
    assert groups[1].agents == ["b"]
    assert groups[2].agents == ["c"]
