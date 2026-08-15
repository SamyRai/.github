# Fixing strict-governance Workflow Failures

## Problem
Approximately 32 PRs are failing with `strict-governance / verify (pull_request)` status checks. The workflow is failing during Deno dependency installation or DS contract verification steps.

## Root Cause
The strict-governance workflow uses Deno v2.x (`deno-version: v2.x`), which has compatibility differences from Deno v1.x. This can cause:
- Import resolution failures
- Type incompatibilities in DS contracts
- Runtime differences in contract tests

## Solution Options

### Option 1: Update Individual Repo Workflows (Recommended)
Update your repo's `.gitea/workflows/strict-governance.yml` to use the improved template from `mukimovd/.github/templates/workflows/strict-governance.yml`, which includes:
- Better error handling for Deno install failures
- Graceful handling of typecheck failures
- Clear error messages for Deno v2.x compatibility issues

Steps:
1. Copy the template: `cp /path/to/mukimovd-dotgithub/templates/workflows/strict-governance.yml .gitea/workflows/strict-governance.yml`
2. Commit and push the update
3. The workflow will now handle Deno v2.x compatibility issues more gracefully

### Option 2: Pin to Deno v1.x (Temporary Fix)
If you need immediate relief, you can temporarily pin to Deno v1.x:
```yaml
- name: Setup Deno
  uses: denoland/setup-deno@v2
  with:
    deno-version: v1.x  # Temporary fix, migrate to v2.x when ready
```

**Note**: This is a temporary workaround. Deno v1.x will eventually reach end-of-life, so plan to migrate to v2.x.

### Option 3: Migrate Code to Deno v2.x
If you have complex dependencies or custom tasks, you may need to migrate your code:
- Review the [Deno v2.0 migration guide](https://deno.com/manual/v2.0/migration_v1_v2)
- Update import maps if needed
- Fix type incompatibilities
- Update task definitions in deno.json

## Validation
After applying the fix, verify your workflow by:
1. Creating a test PR or pushing to your repo
2. Checking that the strict-governance workflow passes
3. Confirming that existing functionality works as expected

## Need Help?
If you continue experiencing issues after applying these fixes, please:
1. Check the workflow logs for specific error messages
2. Verify your import.json/deno.json configuration
3. Review the Deno v2.x migration documentation
4. Contact the GLPX DevOps team for platform-specific issues
