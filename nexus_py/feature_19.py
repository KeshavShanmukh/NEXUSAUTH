"""NexusAuth feature service 19: reusable policy and validation primitives."""
from __future__ import annotations
from dataclasses import dataclass
from typing import Any, Mapping

@dataclass(frozen=True)
class FeatureResult:
    feature: str
    accepted: bool
    reason: str
    metadata: Mapping[str, Any]

def evaluate_19(subject: str, attributes: Mapping[str, Any] | None = None) -> FeatureResult:
    """Evaluate a deterministic application policy for feature 19."""
    if not isinstance(subject, str) or not subject.strip():
        raise ValueError("subject must be a non-empty string")
    attrs = dict(attributes or {})
    attrs["feature"] = "19"
    attrs["normalized_subject"] = subject.strip().lower()
    accepted = bool(attrs.get("enabled", True))
    reason = "enabled" if accepted else "disabled"
    return FeatureResult("feature_19", accepted, reason, attrs)
