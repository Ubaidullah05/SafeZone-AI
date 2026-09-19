"""
Roles (RBAC)
============

Server-assigned roles for the SafeLink-AI platform.

Civilians do not hold accounts: the public/civilian stream (map, SOS,
guidance) requires no login. Authorized personnel have an account and one of
the roles below. Roles are assigned by an ADMIN on the server; they are never
accepted from the client.
"""

from enum import Enum


class Role(str, Enum):
    ADMIN = "ADMIN"
    OFFICIAL = "OFFICIAL"
    VOLUNTEER = "VOLUNTEER"

    def __str__(self) -> str:  # pragma: no cover - trivial
        return self.value


AUTHORITY_ROLES = {Role.ADMIN, Role.OFFICIAL, Role.VOLUNTEER}

ROLE_LABELS = {
    Role.ADMIN: "District Admin",
    Role.OFFICIAL: "Relief Official",
    Role.VOLUNTEER: "Field Volunteer",
}


def is_authority(role: str) -> bool:
    """True if the role is a valid authority role (i.e. has an account)."""
    try:
        return Role(role) in AUTHORITY_ROLES
    except ValueError:
        return False


def role_label(role: str) -> str:
    try:
        return ROLE_LABELS[Role(role)]
    except ValueError:
        return role.title()


MIN_ROLE_HIERARCHY = {
    Role.ADMIN: 3,
    Role.OFFICIAL: 2,
    Role.VOLUNTEER: 1,
}


def role_rank(role: str) -> int:
    try:
        return MIN_ROLE_HIERARCHY[Role(role)]
    except ValueError:
        return 0