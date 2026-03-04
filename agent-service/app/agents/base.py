from abc import ABC, abstractmethod
from typing import Any, TypedDict


class AgentState(TypedDict, total=False):
    input_data: dict[str, Any]
    repository_id: str | None
    error: str | None
    results: dict[str, Any]
    # Discovery-specific
    functionalities: list[dict]
    capabilities: list[dict]
    products: list[dict]
    personas: list[dict]
    brd: str
    # VSM-specific
    capabilities_data: list[dict]
    flow_analysis: dict
    metrics: dict
    mermaid_source: str
    # Risk-specific
    context: dict
    regulations: list[dict]
    risk_scores: list[dict]
    transition_evaluation: dict
    approved: bool
    audit_entries: list[dict]
    # Fiduciary-specific
    advisor_context: dict
    suitability_assessment: list[dict]
    best_interest_evaluation: list[dict]
    fiduciary_report: str
    # Market Intelligence-specific
    current_state_data: list[dict]
    market_trends: list[dict]
    competitor_benchmarks: list[dict]
    intelligence_report: str
    # Architecture-specific
    repo_context: dict
    current_architecture: dict
    target_architecture: dict
    migration_plan: dict
    architecture_diagrams: str
    # Data Governance-specific
    data_context: dict
    data_classifications: list[dict]
    privacy_assessment: list[dict]
    governance_policies: str
    # Product Transformation-specific
    product_context: dict
    readiness_scores: list[dict]
    transformation_plan: list[dict]
    gate_evaluation: dict
    transformation_approved: bool
    blockers: list[dict]
    # Backlog & OKR-specific
    transformation_context: dict
    okrs: list[dict]
    backlog_items: list[dict]
    prioritized_backlog: list[dict]
    # Future State Vision-specific
    selected_products: list[dict]
    future_capabilities: list[dict]
    future_value_streams: list[dict]
    vision_report: str


class BaseAgent(ABC):
    @abstractmethod
    def get_name(self) -> str: ...

    @abstractmethod
    async def run(self, input_data: dict[str, Any]) -> dict[str, Any]: ...
