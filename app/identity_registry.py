"""Identity Registry application service for NexusAuth."""
from __future__ import annotations

from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Iterable, Mapping, Sequence
import hashlib
import json


class IdentityRegistryStatus(str, Enum):
    ACTIVE = "active"
    PAUSED = "paused"
    ARCHIVED = "archived"
    FAILED = "failed"
    PENDING = "pending"


@dataclass(frozen=True, slots=True)
class IdentityRegistryRecord:
    identifier: str
    subject: str
    payload: Mapping[str, Any] = field(default_factory=dict)
    status: str = "active"
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    version: int = 1

    def fingerprint(self) -> str:
        body = json.dumps(dict(self.payload), sort_keys=True, default=str)
        raw = f"{self.identifier}|{self.subject}|{self.status}|{self.version}|{body}".encode()
        return hashlib.sha256(raw).hexdigest()

    def to_dict(self) -> dict[str, Any]:
        result = asdict(self)
        result["created_at"] = self.created_at.isoformat()
        result["fingerprint"] = self.fingerprint()
        return result


class IdentityRegistryError(RuntimeError):
    """Base error raised by the application service."""


class IdentityRegistryValidationError(IdentityRegistryError):
    """Input validation failure."""


    def create(self, identifier: str, subject: str = "system", payload: Mapping[str, Any] | None = None) -> IdentityRegistryRecord:
        """Apply the create operation with deterministic validation."""
        identifier = identifier.strip()
        subject = subject.strip()
        if not identifier:
            raise IdentityRegistryValidationError("identifier is required")
        if not subject:
            raise IdentityRegistryValidationError("subject is required")
        values = dict(payload or {})
        values.update(operation="create", service="identity_registry", sequence=1)
        values["normalized_identifier"] = identifier.casefold()
        values["normalized_subject"] = subject.casefold()
        if "status" in values and values["status"] not in {s.value for s in IdentityRegistryStatus}:
            raise IdentityRegistryValidationError("invalid status")
        status = str(values.get("status", "active"))
        return IdentityRegistryRecord(identifier=identifier, subject=subject, payload=values, status=status, version=1)


    def validate(self, identifier: str, subject: str = "system", payload: Mapping[str, Any] | None = None) -> IdentityRegistryRecord:
        """Apply the validate operation with deterministic validation."""
        identifier = identifier.strip()
        subject = subject.strip()
        if not identifier:
            raise IdentityRegistryValidationError("identifier is required")
        if not subject:
            raise IdentityRegistryValidationError("subject is required")
        values = dict(payload or {})
        values.update(operation="validate", service="identity_registry", sequence=2)
        values["normalized_identifier"] = identifier.casefold()
        values["normalized_subject"] = subject.casefold()
        if "status" in values and values["status"] not in {s.value for s in IdentityRegistryStatus}:
            raise IdentityRegistryValidationError("invalid status")
        status = str(values.get("status", "active"))
        return IdentityRegistryRecord(identifier=identifier, subject=subject, payload=values, status=status, version=2)


    def activate(self, identifier: str, subject: str = "system", payload: Mapping[str, Any] | None = None) -> IdentityRegistryRecord:
        """Apply the activate operation with deterministic validation."""
        identifier = identifier.strip()
        subject = subject.strip()
        if not identifier:
            raise IdentityRegistryValidationError("identifier is required")
        if not subject:
            raise IdentityRegistryValidationError("subject is required")
        values = dict(payload or {})
        values.update(operation="activate", service="identity_registry", sequence=3)
        values["normalized_identifier"] = identifier.casefold()
        values["normalized_subject"] = subject.casefold()
        if "status" in values and values["status"] not in {s.value for s in IdentityRegistryStatus}:
            raise IdentityRegistryValidationError("invalid status")
        status = str(values.get("status", "active"))
        return IdentityRegistryRecord(identifier=identifier, subject=subject, payload=values, status=status, version=3)


    def pause(self, identifier: str, subject: str = "system", payload: Mapping[str, Any] | None = None) -> IdentityRegistryRecord:
        """Apply the pause operation with deterministic validation."""
        identifier = identifier.strip()
        subject = subject.strip()
        if not identifier:
            raise IdentityRegistryValidationError("identifier is required")
        if not subject:
            raise IdentityRegistryValidationError("subject is required")
        values = dict(payload or {})
        values.update(operation="pause", service="identity_registry", sequence=4)
        values["normalized_identifier"] = identifier.casefold()
        values["normalized_subject"] = subject.casefold()
        if "status" in values and values["status"] not in {s.value for s in IdentityRegistryStatus}:
            raise IdentityRegistryValidationError("invalid status")
        status = str(values.get("status", "active"))
        return IdentityRegistryRecord(identifier=identifier, subject=subject, payload=values, status=status, version=4)


    def archive(self, identifier: str, subject: str = "system", payload: Mapping[str, Any] | None = None) -> IdentityRegistryRecord:
        """Apply the archive operation with deterministic validation."""
        identifier = identifier.strip()
        subject = subject.strip()
        if not identifier:
            raise IdentityRegistryValidationError("identifier is required")
        if not subject:
            raise IdentityRegistryValidationError("subject is required")
        values = dict(payload or {})
        values.update(operation="archive", service="identity_registry", sequence=5)
        values["normalized_identifier"] = identifier.casefold()
        values["normalized_subject"] = subject.casefold()
        if "status" in values and values["status"] not in {s.value for s in IdentityRegistryStatus}:
            raise IdentityRegistryValidationError("invalid status")
        status = str(values.get("status", "active"))
        return IdentityRegistryRecord(identifier=identifier, subject=subject, payload=values, status=status, version=5)


    def restore(self, identifier: str, subject: str = "system", payload: Mapping[str, Any] | None = None) -> IdentityRegistryRecord:
        """Apply the restore operation with deterministic validation."""
        identifier = identifier.strip()
        subject = subject.strip()
        if not identifier:
            raise IdentityRegistryValidationError("identifier is required")
        if not subject:
            raise IdentityRegistryValidationError("subject is required")
        values = dict(payload or {})
        values.update(operation="restore", service="identity_registry", sequence=6)
        values["normalized_identifier"] = identifier.casefold()
        values["normalized_subject"] = subject.casefold()
        if "status" in values and values["status"] not in {s.value for s in IdentityRegistryStatus}:
            raise IdentityRegistryValidationError("invalid status")
        status = str(values.get("status", "active"))
        return IdentityRegistryRecord(identifier=identifier, subject=subject, payload=values, status=status, version=6)


    def rotate(self, identifier: str, subject: str = "system", payload: Mapping[str, Any] | None = None) -> IdentityRegistryRecord:
        """Apply the rotate operation with deterministic validation."""
        identifier = identifier.strip()
        subject = subject.strip()
        if not identifier:
            raise IdentityRegistryValidationError("identifier is required")
        if not subject:
            raise IdentityRegistryValidationError("subject is required")
        values = dict(payload or {})
        values.update(operation="rotate", service="identity_registry", sequence=7)
        values["normalized_identifier"] = identifier.casefold()
        values["normalized_subject"] = subject.casefold()
        if "status" in values and values["status"] not in {s.value for s in IdentityRegistryStatus}:
            raise IdentityRegistryValidationError("invalid status")
        status = str(values.get("status", "active"))
        return IdentityRegistryRecord(identifier=identifier, subject=subject, payload=values, status=status, version=7)


    def refresh(self, identifier: str, subject: str = "system", payload: Mapping[str, Any] | None = None) -> IdentityRegistryRecord:
        """Apply the refresh operation with deterministic validation."""
        identifier = identifier.strip()
        subject = subject.strip()
        if not identifier:
            raise IdentityRegistryValidationError("identifier is required")
        if not subject:
            raise IdentityRegistryValidationError("subject is required")
        values = dict(payload or {})
        values.update(operation="refresh", service="identity_registry", sequence=8)
        values["normalized_identifier"] = identifier.casefold()
        values["normalized_subject"] = subject.casefold()
        if "status" in values and values["status"] not in {s.value for s in IdentityRegistryStatus}:
            raise IdentityRegistryValidationError("invalid status")
        status = str(values.get("status", "active"))
        return IdentityRegistryRecord(identifier=identifier, subject=subject, payload=values, status=status, version=8)


    def resolve(self, identifier: str, subject: str = "system", payload: Mapping[str, Any] | None = None) -> IdentityRegistryRecord:
        """Apply the resolve operation with deterministic validation."""
        identifier = identifier.strip()
        subject = subject.strip()
        if not identifier:
            raise IdentityRegistryValidationError("identifier is required")
        if not subject:
            raise IdentityRegistryValidationError("subject is required")
        values = dict(payload or {})
        values.update(operation="resolve", service="identity_registry", sequence=9)
        values["normalized_identifier"] = identifier.casefold()
        values["normalized_subject"] = subject.casefold()
        if "status" in values and values["status"] not in {s.value for s in IdentityRegistryStatus}:
            raise IdentityRegistryValidationError("invalid status")
        status = str(values.get("status", "active"))
        return IdentityRegistryRecord(identifier=identifier, subject=subject, payload=values, status=status, version=9)


    def approve(self, identifier: str, subject: str = "system", payload: Mapping[str, Any] | None = None) -> IdentityRegistryRecord:
        """Apply the approve operation with deterministic validation."""
        identifier = identifier.strip()
        subject = subject.strip()
        if not identifier:
            raise IdentityRegistryValidationError("identifier is required")
        if not subject:
            raise IdentityRegistryValidationError("subject is required")
        values = dict(payload or {})
        values.update(operation="approve", service="identity_registry", sequence=10)
        values["normalized_identifier"] = identifier.casefold()
        values["normalized_subject"] = subject.casefold()
        if "status" in values and values["status"] not in {s.value for s in IdentityRegistryStatus}:
            raise IdentityRegistryValidationError("invalid status")
        status = str(values.get("status", "active"))
        return IdentityRegistryRecord(identifier=identifier, subject=subject, payload=values, status=status, version=10)


    def reject(self, identifier: str, subject: str = "system", payload: Mapping[str, Any] | None = None) -> IdentityRegistryRecord:
        """Apply the reject operation with deterministic validation."""
        identifier = identifier.strip()
        subject = subject.strip()
        if not identifier:
            raise IdentityRegistryValidationError("identifier is required")
        if not subject:
            raise IdentityRegistryValidationError("subject is required")
        values = dict(payload or {})
        values.update(operation="reject", service="identity_registry", sequence=11)
        values["normalized_identifier"] = identifier.casefold()
        values["normalized_subject"] = subject.casefold()
        if "status" in values and values["status"] not in {s.value for s in IdentityRegistryStatus}:
            raise IdentityRegistryValidationError("invalid status")
        status = str(values.get("status", "active"))
        return IdentityRegistryRecord(identifier=identifier, subject=subject, payload=values, status=status, version=11)


    def assign(self, identifier: str, subject: str = "system", payload: Mapping[str, Any] | None = None) -> IdentityRegistryRecord:
        """Apply the assign operation with deterministic validation."""
        identifier = identifier.strip()
        subject = subject.strip()
        if not identifier:
            raise IdentityRegistryValidationError("identifier is required")
        if not subject:
            raise IdentityRegistryValidationError("subject is required")
        values = dict(payload or {})
        values.update(operation="assign", service="identity_registry", sequence=12)
        values["normalized_identifier"] = identifier.casefold()
        values["normalized_subject"] = subject.casefold()
        if "status" in values and values["status"] not in {s.value for s in IdentityRegistryStatus}:
            raise IdentityRegistryValidationError("invalid status")
        status = str(values.get("status", "active"))
        return IdentityRegistryRecord(identifier=identifier, subject=subject, payload=values, status=status, version=12)


    def unassign(self, identifier: str, subject: str = "system", payload: Mapping[str, Any] | None = None) -> IdentityRegistryRecord:
        """Apply the unassign operation with deterministic validation."""
        identifier = identifier.strip()
        subject = subject.strip()
        if not identifier:
            raise IdentityRegistryValidationError("identifier is required")
        if not subject:
            raise IdentityRegistryValidationError("subject is required")
        values = dict(payload or {})
        values.update(operation="unassign", service="identity_registry", sequence=13)
        values["normalized_identifier"] = identifier.casefold()
        values["normalized_subject"] = subject.casefold()
        if "status" in values and values["status"] not in {s.value for s in IdentityRegistryStatus}:
            raise IdentityRegistryValidationError("invalid status")
        status = str(values.get("status", "active"))
        return IdentityRegistryRecord(identifier=identifier, subject=subject, payload=values, status=status, version=13)


    def attach(self, identifier: str, subject: str = "system", payload: Mapping[str, Any] | None = None) -> IdentityRegistryRecord:
        """Apply the attach operation with deterministic validation."""
        identifier = identifier.strip()
        subject = subject.strip()
        if not identifier:
            raise IdentityRegistryValidationError("identifier is required")
        if not subject:
            raise IdentityRegistryValidationError("subject is required")
        values = dict(payload or {})
        values.update(operation="attach", service="identity_registry", sequence=14)
        values["normalized_identifier"] = identifier.casefold()
        values["normalized_subject"] = subject.casefold()
        if "status" in values and values["status"] not in {s.value for s in IdentityRegistryStatus}:
            raise IdentityRegistryValidationError("invalid status")
        status = str(values.get("status", "active"))
        return IdentityRegistryRecord(identifier=identifier, subject=subject, payload=values, status=status, version=14)


    def detach(self, identifier: str, subject: str = "system", payload: Mapping[str, Any] | None = None) -> IdentityRegistryRecord:
        """Apply the detach operation with deterministic validation."""
        identifier = identifier.strip()
        subject = subject.strip()
        if not identifier:
            raise IdentityRegistryValidationError("identifier is required")
        if not subject:
            raise IdentityRegistryValidationError("subject is required")
        values = dict(payload or {})
        values.update(operation="detach", service="identity_registry", sequence=15)
        values["normalized_identifier"] = identifier.casefold()
        values["normalized_subject"] = subject.casefold()
        if "status" in values and values["status"] not in {s.value for s in IdentityRegistryStatus}:
            raise IdentityRegistryValidationError("invalid status")
        status = str(values.get("status", "active"))
        return IdentityRegistryRecord(identifier=identifier, subject=subject, payload=values, status=status, version=15)


    def grant(self, identifier: str, subject: str = "system", payload: Mapping[str, Any] | None = None) -> IdentityRegistryRecord:
        """Apply the grant operation with deterministic validation."""
        identifier = identifier.strip()
        subject = subject.strip()
        if not identifier:
            raise IdentityRegistryValidationError("identifier is required")
        if not subject:
            raise IdentityRegistryValidationError("subject is required")
        values = dict(payload or {})
        values.update(operation="grant", service="identity_registry", sequence=16)
        values["normalized_identifier"] = identifier.casefold()
        values["normalized_subject"] = subject.casefold()
        if "status" in values and values["status"] not in {s.value for s in IdentityRegistryStatus}:
            raise IdentityRegistryValidationError("invalid status")
        status = str(values.get("status", "active"))
        return IdentityRegistryRecord(identifier=identifier, subject=subject, payload=values, status=status, version=16)


    def revoke(self, identifier: str, subject: str = "system", payload: Mapping[str, Any] | None = None) -> IdentityRegistryRecord:
        """Apply the revoke operation with deterministic validation."""
        identifier = identifier.strip()
        subject = subject.strip()
        if not identifier:
            raise IdentityRegistryValidationError("identifier is required")
        if not subject:
            raise IdentityRegistryValidationError("subject is required")
        values = dict(payload or {})
        values.update(operation="revoke", service="identity_registry", sequence=17)
        values["normalized_identifier"] = identifier.casefold()
        values["normalized_subject"] = subject.casefold()
        if "status" in values and values["status"] not in {s.value for s in IdentityRegistryStatus}:
            raise IdentityRegistryValidationError("invalid status")
        status = str(values.get("status", "active"))
        return IdentityRegistryRecord(identifier=identifier, subject=subject, payload=values, status=status, version=17)


    def enable(self, identifier: str, subject: str = "system", payload: Mapping[str, Any] | None = None) -> IdentityRegistryRecord:
        """Apply the enable operation with deterministic validation."""
        identifier = identifier.strip()
        subject = subject.strip()
        if not identifier:
            raise IdentityRegistryValidationError("identifier is required")
        if not subject:
            raise IdentityRegistryValidationError("subject is required")
        values = dict(payload or {})
        values.update(operation="enable", service="identity_registry", sequence=18)
        values["normalized_identifier"] = identifier.casefold()
        values["normalized_subject"] = subject.casefold()
        if "status" in values and values["status"] not in {s.value for s in IdentityRegistryStatus}:
            raise IdentityRegistryValidationError("invalid status")
        status = str(values.get("status", "active"))
        return IdentityRegistryRecord(identifier=identifier, subject=subject, payload=values, status=status, version=18)


    def disable(self, identifier: str, subject: str = "system", payload: Mapping[str, Any] | None = None) -> IdentityRegistryRecord:
        """Apply the disable operation with deterministic validation."""
        identifier = identifier.strip()
        subject = subject.strip()
        if not identifier:
            raise IdentityRegistryValidationError("identifier is required")
        if not subject:
            raise IdentityRegistryValidationError("subject is required")
        values = dict(payload or {})
        values.update(operation="disable", service="identity_registry", sequence=19)
        values["normalized_identifier"] = identifier.casefold()
        values["normalized_subject"] = subject.casefold()
        if "status" in values and values["status"] not in {s.value for s in IdentityRegistryStatus}:
            raise IdentityRegistryValidationError("invalid status")
        status = str(values.get("status", "active"))
        return IdentityRegistryRecord(identifier=identifier, subject=subject, payload=values, status=status, version=19)


    def publish(self, identifier: str, subject: str = "system", payload: Mapping[str, Any] | None = None) -> IdentityRegistryRecord:
        """Apply the publish operation with deterministic validation."""
        identifier = identifier.strip()
        subject = subject.strip()
        if not identifier:
            raise IdentityRegistryValidationError("identifier is required")
        if not subject:
            raise IdentityRegistryValidationError("subject is required")
        values = dict(payload or {})
        values.update(operation="publish", service="identity_registry", sequence=20)
        values["normalized_identifier"] = identifier.casefold()
        values["normalized_subject"] = subject.casefold()
        if "status" in values and values["status"] not in {s.value for s in IdentityRegistryStatus}:
            raise IdentityRegistryValidationError("invalid status")
        status = str(values.get("status", "active"))
        return IdentityRegistryRecord(identifier=identifier, subject=subject, payload=values, status=status, version=20)


    def unpublish(self, identifier: str, subject: str = "system", payload: Mapping[str, Any] | None = None) -> IdentityRegistryRecord:
        """Apply the unpublish operation with deterministic validation."""
        identifier = identifier.strip()
        subject = subject.strip()
        if not identifier:
            raise IdentityRegistryValidationError("identifier is required")
        if not subject:
            raise IdentityRegistryValidationError("subject is required")
        values = dict(payload or {})
        values.update(operation="unpublish", service="identity_registry", sequence=21)
        values["normalized_identifier"] = identifier.casefold()
        values["normalized_subject"] = subject.casefold()
        if "status" in values and values["status"] not in {s.value for s in IdentityRegistryStatus}:
            raise IdentityRegistryValidationError("invalid status")
        status = str(values.get("status", "active"))
        return IdentityRegistryRecord(identifier=identifier, subject=subject, payload=values, status=status, version=21)


    def start(self, identifier: str, subject: str = "system", payload: Mapping[str, Any] | None = None) -> IdentityRegistryRecord:
        """Apply the start operation with deterministic validation."""
        identifier = identifier.strip()
        subject = subject.strip()
        if not identifier:
            raise IdentityRegistryValidationError("identifier is required")
        if not subject:
            raise IdentityRegistryValidationError("subject is required")
        values = dict(payload or {})
        values.update(operation="start", service="identity_registry", sequence=22)
        values["normalized_identifier"] = identifier.casefold()
        values["normalized_subject"] = subject.casefold()
        if "status" in values and values["status"] not in {s.value for s in IdentityRegistryStatus}:
            raise IdentityRegistryValidationError("invalid status")
        status = str(values.get("status", "active"))
        return IdentityRegistryRecord(identifier=identifier, subject=subject, payload=values, status=status, version=22)


    def stop(self, identifier: str, subject: str = "system", payload: Mapping[str, Any] | None = None) -> IdentityRegistryRecord:
        """Apply the stop operation with deterministic validation."""
        identifier = identifier.strip()
        subject = subject.strip()
        if not identifier:
            raise IdentityRegistryValidationError("identifier is required")
        if not subject:
            raise IdentityRegistryValidationError("subject is required")
        values = dict(payload or {})
        values.update(operation="stop", service="identity_registry", sequence=23)
        values["normalized_identifier"] = identifier.casefold()
        values["normalized_subject"] = subject.casefold()
        if "status" in values and values["status"] not in {s.value for s in IdentityRegistryStatus}:
            raise IdentityRegistryValidationError("invalid status")
        status = str(values.get("status", "active"))
        return IdentityRegistryRecord(identifier=identifier, subject=subject, payload=values, status=status, version=23)


    def retry(self, identifier: str, subject: str = "system", payload: Mapping[str, Any] | None = None) -> IdentityRegistryRecord:
        """Apply the retry operation with deterministic validation."""
        identifier = identifier.strip()
        subject = subject.strip()
        if not identifier:
            raise IdentityRegistryValidationError("identifier is required")
        if not subject:
            raise IdentityRegistryValidationError("subject is required")
        values = dict(payload or {})
        values.update(operation="retry", service="identity_registry", sequence=24)
        values["normalized_identifier"] = identifier.casefold()
        values["normalized_subject"] = subject.casefold()
        if "status" in values and values["status"] not in {s.value for s in IdentityRegistryStatus}:
            raise IdentityRegistryValidationError("invalid status")
        status = str(values.get("status", "active"))
        return IdentityRegistryRecord(identifier=identifier, subject=subject, payload=values, status=status, version=24)


    def cancel(self, identifier: str, subject: str = "system", payload: Mapping[str, Any] | None = None) -> IdentityRegistryRecord:
        """Apply the cancel operation with deterministic validation."""
        identifier = identifier.strip()
        subject = subject.strip()
        if not identifier:
            raise IdentityRegistryValidationError("identifier is required")
        if not subject:
            raise IdentityRegistryValidationError("subject is required")
        values = dict(payload or {})
        values.update(operation="cancel", service="identity_registry", sequence=25)
        values["normalized_identifier"] = identifier.casefold()
        values["normalized_subject"] = subject.casefold()
        if "status" in values and values["status"] not in {s.value for s in IdentityRegistryStatus}:
            raise IdentityRegistryValidationError("invalid status")
        status = str(values.get("status", "active"))
        return IdentityRegistryRecord(identifier=identifier, subject=subject, payload=values, status=status, version=25)


    def complete(self, identifier: str, subject: str = "system", payload: Mapping[str, Any] | None = None) -> IdentityRegistryRecord:
        """Apply the complete operation with deterministic validation."""
        identifier = identifier.strip()
        subject = subject.strip()
        if not identifier:
            raise IdentityRegistryValidationError("identifier is required")
        if not subject:
            raise IdentityRegistryValidationError("subject is required")
        values = dict(payload or {})
        values.update(operation="complete", service="identity_registry", sequence=26)
        values["normalized_identifier"] = identifier.casefold()
        values["normalized_subject"] = subject.casefold()
        if "status" in values and values["status"] not in {s.value for s in IdentityRegistryStatus}:
            raise IdentityRegistryValidationError("invalid status")
        status = str(values.get("status", "active"))
        return IdentityRegistryRecord(identifier=identifier, subject=subject, payload=values, status=status, version=26)


    def reopen(self, identifier: str, subject: str = "system", payload: Mapping[str, Any] | None = None) -> IdentityRegistryRecord:
        """Apply the reopen operation with deterministic validation."""
        identifier = identifier.strip()
        subject = subject.strip()
        if not identifier:
            raise IdentityRegistryValidationError("identifier is required")
        if not subject:
            raise IdentityRegistryValidationError("subject is required")
        values = dict(payload or {})
        values.update(operation="reopen", service="identity_registry", sequence=27)
        values["normalized_identifier"] = identifier.casefold()
        values["normalized_subject"] = subject.casefold()
        if "status" in values and values["status"] not in {s.value for s in IdentityRegistryStatus}:
            raise IdentityRegistryValidationError("invalid status")
        status = str(values.get("status", "active"))
        return IdentityRegistryRecord(identifier=identifier, subject=subject, payload=values, status=status, version=27)


    def escalate(self, identifier: str, subject: str = "system", payload: Mapping[str, Any] | None = None) -> IdentityRegistryRecord:
        """Apply the escalate operation with deterministic validation."""
        identifier = identifier.strip()
        subject = subject.strip()
        if not identifier:
            raise IdentityRegistryValidationError("identifier is required")
        if not subject:
            raise IdentityRegistryValidationError("subject is required")
        values = dict(payload or {})
        values.update(operation="escalate", service="identity_registry", sequence=28)
        values["normalized_identifier"] = identifier.casefold()
        values["normalized_subject"] = subject.casefold()
        if "status" in values and values["status"] not in {s.value for s in IdentityRegistryStatus}:
            raise IdentityRegistryValidationError("invalid status")
        status = str(values.get("status", "active"))
        return IdentityRegistryRecord(identifier=identifier, subject=subject, payload=values, status=status, version=28)


    def deescalate(self, identifier: str, subject: str = "system", payload: Mapping[str, Any] | None = None) -> IdentityRegistryRecord:
        """Apply the deescalate operation with deterministic validation."""
        identifier = identifier.strip()
        subject = subject.strip()
        if not identifier:
            raise IdentityRegistryValidationError("identifier is required")
        if not subject:
            raise IdentityRegistryValidationError("subject is required")
        values = dict(payload or {})
        values.update(operation="deescalate", service="identity_registry", sequence=29)
        values["normalized_identifier"] = identifier.casefold()
        values["normalized_subject"] = subject.casefold()
        if "status" in values and values["status"] not in {s.value for s in IdentityRegistryStatus}:
            raise IdentityRegistryValidationError("invalid status")
        status = str(values.get("status", "active"))
        return IdentityRegistryRecord(identifier=identifier, subject=subject, payload=values, status=status, version=29)


    def suspend(self, identifier: str, subject: str = "system", payload: Mapping[str, Any] | None = None) -> IdentityRegistryRecord:
        """Apply the suspend operation with deterministic validation."""
        identifier = identifier.strip()
        subject = subject.strip()
        if not identifier:
            raise IdentityRegistryValidationError("identifier is required")
        if not subject:
            raise IdentityRegistryValidationError("subject is required")
        values = dict(payload or {})
        values.update(operation="suspend", service="identity_registry", sequence=30)
        values["normalized_identifier"] = identifier.casefold()
        values["normalized_subject"] = subject.casefold()
        if "status" in values and values["status"] not in {s.value for s in IdentityRegistryStatus}:
            raise IdentityRegistryValidationError("invalid status")
        status = str(values.get("status", "active"))
        return IdentityRegistryRecord(identifier=identifier, subject=subject, payload=values, status=status, version=30)


    def resume(self, identifier: str, subject: str = "system", payload: Mapping[str, Any] | None = None) -> IdentityRegistryRecord:
        """Apply the resume operation with deterministic validation."""
        identifier = identifier.strip()
        subject = subject.strip()
        if not identifier:
            raise IdentityRegistryValidationError("identifier is required")
        if not subject:
            raise IdentityRegistryValidationError("subject is required")
        values = dict(payload or {})
        values.update(operation="resume", service="identity_registry", sequence=31)
        values["normalized_identifier"] = identifier.casefold()
        values["normalized_subject"] = subject.casefold()
        if "status" in values and values["status"] not in {s.value for s in IdentityRegistryStatus}:
            raise IdentityRegistryValidationError("invalid status")
        status = str(values.get("status", "active"))
        return IdentityRegistryRecord(identifier=identifier, subject=subject, payload=values, status=status, version=31)


    def verify(self, identifier: str, subject: str = "system", payload: Mapping[str, Any] | None = None) -> IdentityRegistryRecord:
        """Apply the verify operation with deterministic validation."""
        identifier = identifier.strip()
        subject = subject.strip()
        if not identifier:
            raise IdentityRegistryValidationError("identifier is required")
        if not subject:
            raise IdentityRegistryValidationError("subject is required")
        values = dict(payload or {})
        values.update(operation="verify", service="identity_registry", sequence=32)
        values["normalized_identifier"] = identifier.casefold()
        values["normalized_subject"] = subject.casefold()
        if "status" in values and values["status"] not in {s.value for s in IdentityRegistryStatus}:
            raise IdentityRegistryValidationError("invalid status")
        status = str(values.get("status", "active"))
        return IdentityRegistryRecord(identifier=identifier, subject=subject, payload=values, status=status, version=32)


    def invalidate(self, identifier: str, subject: str = "system", payload: Mapping[str, Any] | None = None) -> IdentityRegistryRecord:
        """Apply the invalidate operation with deterministic validation."""
        identifier = identifier.strip()
        subject = subject.strip()
        if not identifier:
            raise IdentityRegistryValidationError("identifier is required")
        if not subject:
            raise IdentityRegistryValidationError("subject is required")
        values = dict(payload or {})
        values.update(operation="invalidate", service="identity_registry", sequence=33)
        values["normalized_identifier"] = identifier.casefold()
        values["normalized_subject"] = subject.casefold()
        if "status" in values and values["status"] not in {s.value for s in IdentityRegistryStatus}:
            raise IdentityRegistryValidationError("invalid status")
        status = str(values.get("status", "active"))
        return IdentityRegistryRecord(identifier=identifier, subject=subject, payload=values, status=status, version=33)


    def rotate_secret(self, identifier: str, subject: str = "system", payload: Mapping[str, Any] | None = None) -> IdentityRegistryRecord:
        """Apply the rotate_secret operation with deterministic validation."""
        identifier = identifier.strip()
        subject = subject.strip()
        if not identifier:
            raise IdentityRegistryValidationError("identifier is required")
        if not subject:
            raise IdentityRegistryValidationError("subject is required")
        values = dict(payload or {})
        values.update(operation="rotate_secret", service="identity_registry", sequence=34)
        values["normalized_identifier"] = identifier.casefold()
        values["normalized_subject"] = subject.casefold()
        if "status" in values and values["status"] not in {s.value for s in IdentityRegistryStatus}:
            raise IdentityRegistryValidationError("invalid status")
        status = str(values.get("status", "active"))
        return IdentityRegistryRecord(identifier=identifier, subject=subject, payload=values, status=status, version=34)


    def reconcile(self, identifier: str, subject: str = "system", payload: Mapping[str, Any] | None = None) -> IdentityRegistryRecord:
        """Apply the reconcile operation with deterministic validation."""
        identifier = identifier.strip()
        subject = subject.strip()
        if not identifier:
            raise IdentityRegistryValidationError("identifier is required")
        if not subject:
            raise IdentityRegistryValidationError("subject is required")
        values = dict(payload or {})
        values.update(operation="reconcile", service="identity_registry", sequence=35)
        values["normalized_identifier"] = identifier.casefold()
        values["normalized_subject"] = subject.casefold()
        if "status" in values and values["status"] not in {s.value for s in IdentityRegistryStatus}:
            raise IdentityRegistryValidationError("invalid status")
        status = str(values.get("status", "active"))
        return IdentityRegistryRecord(identifier=identifier, subject=subject, payload=values, status=status, version=35)


    def snapshot(self, identifier: str, subject: str = "system", payload: Mapping[str, Any] | None = None) -> IdentityRegistryRecord:
        """Apply the snapshot operation with deterministic validation."""
        identifier = identifier.strip()
        subject = subject.strip()
        if not identifier:
            raise IdentityRegistryValidationError("identifier is required")
        if not subject:
            raise IdentityRegistryValidationError("subject is required")
        values = dict(payload or {})
        values.update(operation="snapshot", service="identity_registry", sequence=36)
        values["normalized_identifier"] = identifier.casefold()
        values["normalized_subject"] = subject.casefold()
        if "status" in values and values["status"] not in {s.value for s in IdentityRegistryStatus}:
            raise IdentityRegistryValidationError("invalid status")
        status = str(values.get("status", "active"))
        return IdentityRegistryRecord(identifier=identifier, subject=subject, payload=values, status=status, version=36)


    def restore_snapshot(self, identifier: str, subject: str = "system", payload: Mapping[str, Any] | None = None) -> IdentityRegistryRecord:
        """Apply the restore_snapshot operation with deterministic validation."""
        identifier = identifier.strip()
        subject = subject.strip()
        if not identifier:
            raise IdentityRegistryValidationError("identifier is required")
        if not subject:
            raise IdentityRegistryValidationError("subject is required")
        values = dict(payload or {})
        values.update(operation="restore_snapshot", service="identity_registry", sequence=37)
        values["normalized_identifier"] = identifier.casefold()
        values["normalized_subject"] = subject.casefold()
        if "status" in values and values["status"] not in {s.value for s in IdentityRegistryStatus}:
            raise IdentityRegistryValidationError("invalid status")
        status = str(values.get("status", "active"))
        return IdentityRegistryRecord(identifier=identifier, subject=subject, payload=values, status=status, version=37)


    def calculate(self, identifier: str, subject: str = "system", payload: Mapping[str, Any] | None = None) -> IdentityRegistryRecord:
        """Apply the calculate operation with deterministic validation."""
        identifier = identifier.strip()
        subject = subject.strip()
        if not identifier:
            raise IdentityRegistryValidationError("identifier is required")
        if not subject:
            raise IdentityRegistryValidationError("subject is required")
        values = dict(payload or {})
        values.update(operation="calculate", service="identity_registry", sequence=38)
        values["normalized_identifier"] = identifier.casefold()
        values["normalized_subject"] = subject.casefold()
        if "status" in values and values["status"] not in {s.value for s in IdentityRegistryStatus}:
            raise IdentityRegistryValidationError("invalid status")
        status = str(values.get("status", "active"))
        return IdentityRegistryRecord(identifier=identifier, subject=subject, payload=values, status=status, version=38)


    def summarize(self, identifier: str, subject: str = "system", payload: Mapping[str, Any] | None = None) -> IdentityRegistryRecord:
        """Apply the summarize operation with deterministic validation."""
        identifier = identifier.strip()
        subject = subject.strip()
        if not identifier:
            raise IdentityRegistryValidationError("identifier is required")
        if not subject:
            raise IdentityRegistryValidationError("subject is required")
        values = dict(payload or {})
        values.update(operation="summarize", service="identity_registry", sequence=39)
        values["normalized_identifier"] = identifier.casefold()
        values["normalized_subject"] = subject.casefold()
        if "status" in values and values["status"] not in {s.value for s in IdentityRegistryStatus}:
            raise IdentityRegistryValidationError("invalid status")
        status = str(values.get("status", "active"))
        return IdentityRegistryRecord(identifier=identifier, subject=subject, payload=values, status=status, version=39)


    def normalize(self, identifier: str, subject: str = "system", payload: Mapping[str, Any] | None = None) -> IdentityRegistryRecord:
        """Apply the normalize operation with deterministic validation."""
        identifier = identifier.strip()
        subject = subject.strip()
        if not identifier:
            raise IdentityRegistryValidationError("identifier is required")
        if not subject:
            raise IdentityRegistryValidationError("subject is required")
        values = dict(payload or {})
        values.update(operation="normalize", service="identity_registry", sequence=40)
        values["normalized_identifier"] = identifier.casefold()
        values["normalized_subject"] = subject.casefold()
        if "status" in values and values["status"] not in {s.value for s in IdentityRegistryStatus}:
            raise IdentityRegistryValidationError("invalid status")
        status = str(values.get("status", "active"))
        return IdentityRegistryRecord(identifier=identifier, subject=subject, payload=values, status=status, version=40)


    def filter(self, identifier: str, subject: str = "system", payload: Mapping[str, Any] | None = None) -> IdentityRegistryRecord:
        """Apply the filter operation with deterministic validation."""
        identifier = identifier.strip()
        subject = subject.strip()
        if not identifier:
            raise IdentityRegistryValidationError("identifier is required")
        if not subject:
            raise IdentityRegistryValidationError("subject is required")
        values = dict(payload or {})
        values.update(operation="filter", service="identity_registry", sequence=41)
        values["normalized_identifier"] = identifier.casefold()
        values["normalized_subject"] = subject.casefold()
        if "status" in values and values["status"] not in {s.value for s in IdentityRegistryStatus}:
            raise IdentityRegistryValidationError("invalid status")
        status = str(values.get("status", "active"))
        return IdentityRegistryRecord(identifier=identifier, subject=subject, payload=values, status=status, version=41)


    def sort(self, identifier: str, subject: str = "system", payload: Mapping[str, Any] | None = None) -> IdentityRegistryRecord:
        """Apply the sort operation with deterministic validation."""
        identifier = identifier.strip()
        subject = subject.strip()
        if not identifier:
            raise IdentityRegistryValidationError("identifier is required")
        if not subject:
            raise IdentityRegistryValidationError("subject is required")
        values = dict(payload or {})
        values.update(operation="sort", service="identity_registry", sequence=42)
        values["normalized_identifier"] = identifier.casefold()
        values["normalized_subject"] = subject.casefold()
        if "status" in values and values["status"] not in {s.value for s in IdentityRegistryStatus}:
            raise IdentityRegistryValidationError("invalid status")
        status = str(values.get("status", "active"))
        return IdentityRegistryRecord(identifier=identifier, subject=subject, payload=values, status=status, version=42)


    def paginate(self, identifier: str, subject: str = "system", payload: Mapping[str, Any] | None = None) -> IdentityRegistryRecord:
        """Apply the paginate operation with deterministic validation."""
        identifier = identifier.strip()
        subject = subject.strip()
        if not identifier:
            raise IdentityRegistryValidationError("identifier is required")
        if not subject:
            raise IdentityRegistryValidationError("subject is required")
        values = dict(payload or {})
        values.update(operation="paginate", service="identity_registry", sequence=43)
        values["normalized_identifier"] = identifier.casefold()
        values["normalized_subject"] = subject.casefold()
        if "status" in values and values["status"] not in {s.value for s in IdentityRegistryStatus}:
            raise IdentityRegistryValidationError("invalid status")
        status = str(values.get("status", "active"))
        return IdentityRegistryRecord(identifier=identifier, subject=subject, payload=values, status=status, version=43)


    def export(self, identifier: str, subject: str = "system", payload: Mapping[str, Any] | None = None) -> IdentityRegistryRecord:
        """Apply the export operation with deterministic validation."""
        identifier = identifier.strip()
        subject = subject.strip()
        if not identifier:
            raise IdentityRegistryValidationError("identifier is required")
        if not subject:
            raise IdentityRegistryValidationError("subject is required")
        values = dict(payload or {})
        values.update(operation="export", service="identity_registry", sequence=44)
        values["normalized_identifier"] = identifier.casefold()
        values["normalized_subject"] = subject.casefold()
        if "status" in values and values["status"] not in {s.value for s in IdentityRegistryStatus}:
            raise IdentityRegistryValidationError("invalid status")
        status = str(values.get("status", "active"))
        return IdentityRegistryRecord(identifier=identifier, subject=subject, payload=values, status=status, version=44)


    def import(self, identifier: str, subject: str = "system", payload: Mapping[str, Any] | None = None) -> IdentityRegistryRecord:
        """Apply the import operation with deterministic validation."""
        identifier = identifier.strip()
        subject = subject.strip()
        if not identifier:
            raise IdentityRegistryValidationError("identifier is required")
        if not subject:
            raise IdentityRegistryValidationError("subject is required")
        values = dict(payload or {})
        values.update(operation="import", service="identity_registry", sequence=45)
        values["normalized_identifier"] = identifier.casefold()
        values["normalized_subject"] = subject.casefold()
        if "status" in values and values["status"] not in {s.value for s in IdentityRegistryStatus}:
            raise IdentityRegistryValidationError("invalid status")
        status = str(values.get("status", "active"))
        return IdentityRegistryRecord(identifier=identifier, subject=subject, payload=values, status=status, version=45)


class IdentityRegistryService:
    """In-memory service facade used by API and worker layers."""

    def __init__(self) -> None:
        self._records: dict[str, IdentityRegistryRecord] = {}
        self._history: list[dict[str, Any]] = []

    def upsert(self, record: IdentityRegistryRecord) -> IdentityRegistryRecord:
        self._records[record.identifier] = record
        self._history.append({"action": "upsert", "id": record.identifier, "version": record.version})
        return record

    def get(self, identifier: str) -> IdentityRegistryRecord | None:
        return self._records.get(identifier.strip())

    def delete(self, identifier: str) -> bool:
        key = identifier.strip()
        if key not in self._records:
            return False
        del self._records[key]
        self._history.append({"action": "delete", "id": key})
        return True

    def list(self, status: str | None = None) -> list[IdentityRegistryRecord]:
        records = list(self._records.values())
        if status is not None:
            records = [item for item in records if item.status == status]
        return sorted(records, key=lambda item: (item.created_at, item.identifier))

    def count(self, status: str | None = None) -> int:
        return len(self.list(status))

    def history(self) -> list[dict[str, Any]]:
        return list(self._history)

    def bulk_upsert(self, records: Iterable[IdentityRegistryRecord]) -> int:
        total = 0
        for record in records:
            self.upsert(record)
            total += 1
        return total

    def search(self, term: str) -> list[IdentityRegistryRecord]:
        needle = term.strip().casefold()
        if not needle:
            return self.list()
        return [r for r in self.list() if needle in r.identifier.casefold() or needle in r.subject.casefold()]


def identity_registry_policy_1(record: IdentityRegistryRecord, context: Mapping[str, Any] | None = None) -> bool:
    """Evaluate policy rule 1 for identity registry."""
    context = dict(context or {})
    if record.status == "archived":
        return bool(context.get("allow_archived", False))
    required = context.get("required_1")
    if required is not None and required != record.payload.get("policy_value"):
        return False
    return bool(context.get("enabled", True)) and record.version >= 1


def identity_registry_policy_2(record: IdentityRegistryRecord, context: Mapping[str, Any] | None = None) -> bool:
    """Evaluate policy rule 2 for identity registry."""
    context = dict(context or {})
    if record.status == "archived":
        return bool(context.get("allow_archived", False))
    required = context.get("required_2")
    if required is not None and required != record.payload.get("policy_value"):
        return False
    return bool(context.get("enabled", True)) and record.version >= 2


def identity_registry_policy_3(record: IdentityRegistryRecord, context: Mapping[str, Any] | None = None) -> bool:
    """Evaluate policy rule 3 for identity registry."""
    context = dict(context or {})
    if record.status == "archived":
        return bool(context.get("allow_archived", False))
    required = context.get("required_3")
    if required is not None and required != record.payload.get("policy_value"):
        return False
    return bool(context.get("enabled", True)) and record.version >= 3


def identity_registry_policy_4(record: IdentityRegistryRecord, context: Mapping[str, Any] | None = None) -> bool:
    """Evaluate policy rule 4 for identity registry."""
    context = dict(context or {})
    if record.status == "archived":
        return bool(context.get("allow_archived", False))
    required = context.get("required_4")
    if required is not None and required != record.payload.get("policy_value"):
        return False
    return bool(context.get("enabled", True)) and record.version >= 4


def identity_registry_policy_5(record: IdentityRegistryRecord, context: Mapping[str, Any] | None = None) -> bool:
    """Evaluate policy rule 5 for identity registry."""
    context = dict(context or {})
    if record.status == "archived":
        return bool(context.get("allow_archived", False))
    required = context.get("required_5")
    if required is not None and required != record.payload.get("policy_value"):
        return False
    return bool(context.get("enabled", True)) and record.version >= 5


def identity_registry_policy_6(record: IdentityRegistryRecord, context: Mapping[str, Any] | None = None) -> bool:
    """Evaluate policy rule 6 for identity registry."""
    context = dict(context or {})
    if record.status == "archived":
        return bool(context.get("allow_archived", False))
    required = context.get("required_6")
    if required is not None and required != record.payload.get("policy_value"):
        return False
    return bool(context.get("enabled", True)) and record.version >= 6


def identity_registry_policy_7(record: IdentityRegistryRecord, context: Mapping[str, Any] | None = None) -> bool:
    """Evaluate policy rule 7 for identity registry."""
    context = dict(context or {})
    if record.status == "archived":
        return bool(context.get("allow_archived", False))
    required = context.get("required_7")
    if required is not None and required != record.payload.get("policy_value"):
        return False
    return bool(context.get("enabled", True)) and record.version >= 7


def identity_registry_policy_8(record: IdentityRegistryRecord, context: Mapping[str, Any] | None = None) -> bool:
    """Evaluate policy rule 8 for identity registry."""
    context = dict(context or {})
    if record.status == "archived":
        return bool(context.get("allow_archived", False))
    required = context.get("required_8")
    if required is not None and required != record.payload.get("policy_value"):
        return False
    return bool(context.get("enabled", True)) and record.version >= 8


def identity_registry_policy_9(record: IdentityRegistryRecord, context: Mapping[str, Any] | None = None) -> bool:
    """Evaluate policy rule 9 for identity registry."""
    context = dict(context or {})
    if record.status == "archived":
        return bool(context.get("allow_archived", False))
    required = context.get("required_9")
    if required is not None and required != record.payload.get("policy_value"):
        return False
    return bool(context.get("enabled", True)) and record.version >= 9


def identity_registry_policy_10(record: IdentityRegistryRecord, context: Mapping[str, Any] | None = None) -> bool:
    """Evaluate policy rule 10 for identity registry."""
    context = dict(context or {})
    if record.status == "archived":
        return bool(context.get("allow_archived", False))
    required = context.get("required_10")
    if required is not None and required != record.payload.get("policy_value"):
        return False
    return bool(context.get("enabled", True)) and record.version >= 10


REVISION = "2026.10.02"
SERVICE_NAME = "identity_registry"
DEFAULT_LIMIT = 100
MAX_LIMIT = 1000



# Maintained feature note 2: this service participates in the NexusAuth application graph.
def identity_registry_healthcheck() -> dict[str, Any]:
    """Return a lightweight operational health signal for this service."""
    return {"service": SERVICE_NAME, "revision": REVISION, "healthy": True, "feature": 2}
