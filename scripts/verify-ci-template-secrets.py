#!/usr/bin/env python3
"""Verify reusable-workflow secret forwarding and environment-backed token scope.

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
WORKFLOW_USE = re.compile(
    r"^\s*uses:\s*mukimovd/\.github/\.gitea/workflows/([\w.-]+)@([^\s]+)\s*$"
)
APPROVED_WORKFLOW_REVISION = "2f407c7d643b4aafa3d72c45e394097fc6de3108"
EXPECTED_GO_WORKFLOWS = {
    "go.yml": ["go-ci.yml"],
    "go-integration.yml": ["go-integration-ci.yml"],
    "go-service.yml": ["go-ci.yml", "base-images-guard.yml", "docker-ci.yml"],
}
SECRET_KEY = re.compile(r"^(\s+)([A-Z][A-Z0-9_]*):\s*$")
STEP = re.compile(r"(?m)^      - name:\s+")


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


def verify_pub_token_scope() -> list[str]:
    """Reject Pub commands that cannot resolve an environment-backed token."""
    workflow = WORKFLOWS / "flutter-ci.yml"
    if not workflow.is_file():
        return [f"{workflow.relative_to(REPO)}: workflow not found"]

    failures: list[str] = []
    steps = STEP.split(workflow.read_text())[1:]
    for step in steps:
        name, _, body = step.partition("\n")
        needs_pub_token = "flutter pub get" in body
        if needs_pub_token and "PUB_TOKEN: ${{ secrets.PUB_TOKEN }}" not in body:
            failures.append(
                f"{workflow.relative_to(REPO)}: step {name!r} may run Pub after "
                "`dart pub token add --env-var PUB_TOKEN`, but does not expose "
                "`secrets.PUB_TOKEN` in that step."
            )

        invokes_custom_verify = "run: ${{ inputs.verify-command }}" in body
        if invokes_custom_verify and "PUB_TOKEN: ${{ secrets.PUB_TOKEN }}" in body:
            failures.append(
                f"{workflow.relative_to(REPO)}: step {name!r} exposes "
                "`secrets.PUB_TOKEN` to a custom verification command; registry "
                "credentials must remain scoped to the locked install step."
            )

        invokes_flutter_analyze = "flutter analyze" in body
        if invokes_flutter_analyze and "--no-pub" not in body:
            failures.append(
                f"{workflow.relative_to(REPO)}: step {name!r} runs "
                "`flutter analyze` without `--no-pub`; dependency resolution "
                "must stay in the authenticated install step."
            )

    return failures


def verify_template_workflow_pins(name: str, body: str) -> list[str]:
    """Require the exact reviewed revision and workflow set for one template."""
    failures: list[str] = []
    found: list[str] = []
    for number, line in enumerate(body.splitlines(), start=1):
        if "uses: mukimovd/.github/.gitea/workflows/" not in line:
            continue
        match = WORKFLOW_USE.match(line)
        if not match:
            failures.append(
                f"templates/ci/{name}:{number}: malformed reusable workflow reference"
            )
            continue
        workflow, revision = match.groups()
        found.append(workflow)
        if revision != APPROVED_WORKFLOW_REVISION:
            failures.append(
                f"templates/ci/{name}:{number}: {workflow} must use reviewed revision "
                f"{APPROVED_WORKFLOW_REVISION}, got {revision}"
            )

    expected = EXPECTED_GO_WORKFLOWS[name]
    if found != expected:
        failures.append(
            f"templates/ci/{name}: reusable workflows {found!r}, want {expected!r}"
        )
    return failures


def verify_go_templates_pin_workflows() -> list[str]:
    """Require reviewed immutable workflow revisions in every Go scaffold."""
    failures: list[str] = []
    for name in EXPECTED_GO_WORKFLOWS:
        template = TEMPLATES / name
        failures.extend(verify_template_workflow_pins(name, template.read_text()))

    # Mutation guards: the validator must reject an unknown SHA even when it
    # is 40 hex characters, and must reject a mixed-ref service scaffold.
    unknown = "0" * 40
    all_unknown = "\n".join(
        f"    uses: mukimovd/.github/.gitea/workflows/{workflow}@{unknown}"
        for workflow in EXPECTED_GO_WORKFLOWS["go-service.yml"]
    )
    if not verify_template_workflow_pins("go-service.yml", all_unknown):
        failures.append("internal verifier accepted an unknown workflow revision")

    mixed = all_unknown.replace(unknown, APPROVED_WORKFLOW_REVISION, 1)
    if not verify_template_workflow_pins("go-service.yml", mixed):
        failures.append("internal verifier accepted mixed workflow revisions")

    return failures


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

    failures.extend(verify_pub_token_scope())
    failures.extend(verify_go_templates_pin_workflows())

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
