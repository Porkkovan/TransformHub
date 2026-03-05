"""
Persona Inference API
Uses Claude to infer which personas use each functionality based on name + description.
Falls back to keyword-based rule inference when no API key is available.
"""

import json
import re
from typing import Optional

import anthropic
from fastapi import APIRouter
from pydantic import BaseModel

from app.core.config import settings

router = APIRouter(tags=["persona-inference"])


# ─── Request / Response models ────────────────────────────────────────────────

class PersonaInput(BaseModel):
    type: str
    name: str
    responsibilities: list[str] = []


class FunctionalityInput(BaseModel):
    id: str
    name: str
    description: Optional[str] = None


class InferPersonasRequest(BaseModel):
    personas: list[PersonaInput]
    functionalities: list[FunctionalityInput]


class FunctionalityPersonaResult(BaseModel):
    functionality_id: str
    persona_types: list[str]


# ─── Endpoint ─────────────────────────────────────────────────────────────────

@router.post("/infer-personas", response_model=list[FunctionalityPersonaResult])
async def infer_personas(request: InferPersonasRequest):
    """
    Given a list of persona definitions and functionalities, infer which personas
    interact with each functionality using Claude. Falls back to keyword rules.
    """
    if not request.functionalities or not request.personas:
        return []

    if settings.anthropic_api_key:
        try:
            return await _llm_inference(request)
        except Exception:
            pass  # fall through to rule-based

    return _rule_based_inference(request)


# ─── LLM inference ────────────────────────────────────────────────────────────

async def _llm_inference(request: InferPersonasRequest) -> list[FunctionalityPersonaResult]:
    valid_types = {p.type for p in request.personas}

    persona_desc = "\n".join(
        f"  - {p.type} ({p.name}): {', '.join(p.responsibilities) if p.responsibilities else 'General responsibilities'}"
        for p in request.personas
    )

    func_list = "\n".join(
        f"  - id={f.id!r} name={f.name!r}" + (f" desc={f.description!r}" if f.description else "")
        for f in request.functionalities
    )

    valid_types_str = ", ".join(f'"{t}"' for t in valid_types)

    prompt = f"""You are mapping software functionalities to the organizational personas that use them.

Organization personas:
{persona_desc}

For each functionality, decide which persona type(s) would USE or INTERACT with it.
Consider:
- Customer/end-user facing features → front-office personas
- Operational/workflow/approval tasks → middle-office personas
- Technical/infrastructure/admin/API tasks → back-office personas
- A functionality can belong to multiple personas if appropriate.

Functionalities to classify:
{func_list}

Respond with ONLY a JSON array (no markdown, no explanation). Each element:
{{"functionality_id": "<exact id>", "persona_types": [<subset of: {valid_types_str}>]}}"""

    client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
    message = await client.messages.create(
        model=settings.agent_model,
        max_tokens=2048,
        messages=[{"role": "user", "content": prompt}],
    )

    raw = message.content[0].text.strip()

    # Extract JSON array from response (handle potential markdown wrapping)
    match = re.search(r'\[.*\]', raw, re.DOTALL)
    if not match:
        raise ValueError("No JSON array in response")

    items = json.loads(match.group())
    results = []
    for item in items:
        results.append(FunctionalityPersonaResult(
            functionality_id=item.get("functionality_id", ""),
            persona_types=[t for t in item.get("persona_types", []) if t in valid_types],
        ))
    return results


# ─── Rule-based fallback ──────────────────────────────────────────────────────

# Keyword → archetype: 0=front, 1=middle, 2=back
_KEYWORD_MAP: dict[str, int] = {
    # Front-office (customer facing)
    "customer": 0, "client": 0, "user": 0, "portal": 0, "self-service": 0,
    "mobile": 0, "app": 0, "onboard": 0, "register": 0, "login": 0,
    "payment": 0, "transfer": 0, "statement": 0, "balance": 0, "withdraw": 0,
    "deposit": 0, "account": 0, "profile": 0, "notification": 0, "alert": 0,
    "view": 0, "display": 0, "dashboard": 0, "enquiry": 0, "request": 0,
    # Middle-office (operations/workflow)
    "process": 1, "workflow": 1, "approve": 1, "review": 1, "verify": 1,
    "validate": 1, "reconcil": 1, "report": 1, "analytics": 1, "monitor": 1,
    "case": 1, "ticket": 1, "compliance": 1, "audit": 1, "exception": 1,
    "settlement": 1, "clearance": 1, "risk": 1, "fraud": 1, "kyc": 1, "aml": 1,
    "operation": 1, "manage": 1, "track": 1, "schedule": 1,
    # Back-office (technical/infrastructure)
    "api": 2, "integration": 2, "database": 2, "infrastructure": 2,
    "config": 2, "deploy": 2, "batch": 2, "job": 2, "system": 2,
    "admin": 2, "permission": 2, "role": 2, "security": 2, "encrypt": 2,
    "log": 2, "backup": 2, "archive": 2, "sync": 2, "migration": 2,
}


def _rule_based_inference(request: InferPersonasRequest) -> list[FunctionalityPersonaResult]:
    # Map archetype index → actual persona type (by position; graceful if fewer)
    archetype_to_type: dict[int, str] = {}
    for i, p in enumerate(request.personas[:3]):
        archetype_to_type[i] = p.type

    results = []
    for func in request.functionalities:
        text = (func.name + " " + (func.description or "")).lower()
        matched_archetypes: set[int] = set()

        for keyword, archetype in _KEYWORD_MAP.items():
            if keyword in text and archetype in archetype_to_type:
                matched_archetypes.add(archetype)

        # Default to front-office if nothing matched
        if not matched_archetypes and 0 in archetype_to_type:
            matched_archetypes.add(0)

        results.append(FunctionalityPersonaResult(
            functionality_id=func.id,
            persona_types=[archetype_to_type[a] for a in sorted(matched_archetypes) if a in archetype_to_type],
        ))
    return results
