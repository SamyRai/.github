#!/usr/bin/env python3
"""Verify every templates/ci/*.yml surfaces the secrets its reusable workflows declare.

Why this exists
---------------
`go-ci.yml` gained an optional `MODULE_READ_TOKEN` secret so repos importing
private `go.glpx.pro/*` modules could authenticate. The three Go templates were
never updated to forward it, so every repo scaffolded from them silently could
not fetch private modules — the failure surfaced far downstream as
"fatal: Could not read from remote repository" in a consumer's CI.

The drift was invisible because the secret is OPTIONAL: nothing failed here, and
`go-ci.yml` deliberately warns-and-skips rather than erroring. So the check is
not "required secrets must be forwarded" (that would have passed); it is "every
declared secret must be ACCOUNTED FOR in the calling template" — either
forwarded, or explicitly commented out as not-needed, which is the existing
convention for optional secrets like NPM_TOKEN and DOCKERHUB_*.

Mentioning a secret in a comment is enough. The point is that a human made a
decision about it, not that every template forwards everything.

Dependency-free on purpose: no PyYAML, since the runner image is not guaranteed
to have it and these files are simple and uniform.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
TEMPLATES = REPO / "templates" / "ci"
WORKFLOWS = REPO / ".gitea" / "workflows"

# `uses: mukimovd/.github/.gitea/workflows/<name>@<ref>`
USES = re.compile(r"^\s*uses:\s*mukimovd/\.github/\.gitea/workflows/([\w.-]+)@")
SECRET_KEY = re.compile(r"^(\s+)([A-Z][A-Z0-9_]*):\s*$")


def indent_of(line: str) -> int:
    return len(line) - len(line.lstrip())


def declared_secrets(workflow: Path) -> list[str]:
    """Return the secret names a reusable workflow declares under workflow_call."""
    if not workflow.is_file():
        return []
    lines = workflow.read_text().splitlines()
    names: list[str] = []
    secrets_indent: int | None = None
    for line in lines:
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            continue
        if secrets_indent is None:
            if stripped == "secrets:":
                secrets_indent = indent_of(line)
            continue
        # Leaving the secrets block: a key at the same or shallower indent.
        if indent_of(line) <= secrets_indent:
            break
        match = SECRET_KEY.match(line)
        if match and indent_of(line) == secrets_indent + 2:
            names.append(match.group(2))
    return names


def main() -> int:
    if not TEMPLATES.is_dir():
        print(f"error: {TEMPLATES} not found", file=sys.stderr)
        return 2

    failures: list[str] = []
    checked = 0

    for template in sorted(TEMPLATES.glob("*.yml")):
        body = template.read_text()
        targets = {m.group(1) for m in (USES.match(l) for l in body.splitlines()) if m}
        for target in sorted(targets):
            secrets = declared_secrets(WORKFLOWS / target)
            if not secrets:
                continue
            checked += 1
            for secret in secrets:
                # Presence anywhere counts, including inside a comment: the
                # convention for "this optional secret is deliberately not used".
                if secret not in body:
                    failures.append(
                        f"{template.relative_to(REPO)}: calls {target}, which declares "
                        f"secret {secret}, but the template never mentions it. Forward it "
                        f"under `secrets:`, or add a comment saying why it is not needed."
                    )

    if failures:
        print("CI template / reusable-workflow secret drift:\n", file=sys.stderr)
        for failure in failures:
            print(f"  - {failure}", file=sys.stderr)
        print(
            f"\n{len(failures)} problem(s). A reusable workflow gained a secret that its "
            "templates never surfaced — the class of drift that left MODULE_READ_TOKEN "
            "out of the Go templates.",
            file=sys.stderr,
        )
        return 1

    print(f"OK: {checked} template/workflow pair(s) account for every declared secret.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
