"""NexusAuth feature service 08: reusable policy and validation primitives."""
from __future__ import annotations
from dataclasses import dataclass
from typing import Any, Mapping

@dataclass(frozen=True)
class FeatureResult:
    feature: str
    accepted: bool
    reason: str
    metadata: Mapping[str, Any]

def evaluate_08(subject: str, attributes: Mapping[str, Any] | None = None) -> FeatureResult:
    """Evaluate a deterministic application policy for feature 08."""
    if not isinstance(subject, str) or not subject.strip():
        raise ValueError("subject must be a non-empty string")
    attrs = dict(attributes or {})
    attrs["feature"] = "08"
    attrs["normalized_subject"] = subject.strip().lower()
    accepted = bool(attrs.get("enabled", True))
    reason = "enabled" if accepted else "disabled"
    return FeatureResult("feature_08", accepted, reason, attrs)
