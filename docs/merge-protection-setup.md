# Merge Protection Rules Setup

This document describes how to configure GitHub repository protection rules to enforce schema validation and impact analysis on the Context-Sync repository.

## Overview

Branch protection rules ensure that all changes to the context repository go through validation before being merged. This prevents schema violations, broken references, and unreviewed impact from reaching the main branch.

## Prerequisites

- Repository administrator access
- GitHub Actions workflows deployed (`.github/workflows/context-validate.yml` and `.github/workflows/impact-analysis.yml`)
- At least one successful workflow run

## Protection Rules Configuration

### Step 1: Access Branch Protection Settings

1. Navigate to your GitHub repository
2. Go to **Settings** → **Branches**
3. Under "Branch protection rules", click **Add rule** (or edit existing rule for `main`)

### Step 2: Configure Branch Protection for `main`

**Branch name pattern:** `main`

#### Required Settings

✅ **Require a pull request before merging**
- Enable this option
- **Require approvals:** 1 (minimum)
- ✅ **Dismiss stale pull request approvals when new commits are pushed**
- ✅ **Require review from Code Owners** (optional, if you have CODEOWNERS file)

✅ **Require status checks to pass before merging**
- Enable this option
- ✅ **Require branches to be up to date before merging**
- **Status checks that are required:**
  - `Validate YAML Schemas` (from context-validate.yml)
  - `Build Dependency Graph` (from context-validate.yml)
  - `Check Dangling References` (from context-validate.yml)
  - `Analyze Impact of Changes` (from impact-analysis.yml)
  - `Check Consistency Rules` (from impact-analysis.yml)

✅ **Require conversation resolution before merging**
- Enable this option to ensure all PR comments are addressed

❌ **Require signed commits** (optional)
- Enable if your organization requires commit signing

✅ **Require linear history** (optional)
- Enable to prevent merge commits (forces rebase or squash)

✅ **Include administrators**
- Recommended: enforce rules even for repository admins

❌ **Allow force pushes** 
- Keep disabled for safety

❌ **Allow deletions**
- Keep disabled for safety

### Step 3: Configure Branch Protection for `develop` (if applicable)

If you use a `develop` branch for integration:

**Branch name pattern:** `develop`

Use same settings as `main`, but you may optionally:
- Reduce required approvals to 0 for faster iteration
- Keep all status checks required

### Step 4: Configure Rulesets (Optional - Modern Approach)

GitHub now offers "Rulesets" as an alternative to branch protection rules. To use rulesets:

1. Go to **Settings** → **Rules** → **Rulesets**
2. Click **New ruleset** → **New branch ruleset**
3. Configure similar rules as above with more flexibility

**Advantages of Rulesets:**
- Can apply to multiple branches with patterns
- More granular control
- Can target specific file paths

## Status Checks Reference

### From `context-validate.yml`

| Check Name | Purpose | Failure Condition |
|------------|---------|-------------------|
| **Validate YAML Schemas** | Validates all YAML files against JSON schemas | Schema validation errors detected |
| **Build Dependency Graph** | Builds entity dependency graph | Graph build fails or produces no nodes |
| **Check Dangling References** | Finds references to non-existent entities | Warning only (does not block) |

### From `impact-analysis.yml`

| Check Name | Purpose | Failure Condition |
|------------|---------|-------------------|
| **Analyze Impact of Changes** | Detects affected entities | Warning if issues found (can be configured to block) |
| **Check Consistency Rules** | Validates consistency rules | Currently placeholder (does not block) |

## Workflow Permissions

Ensure the GitHub Actions workflows have appropriate permissions:

### In Workflow Files

```yaml
permissions:
  contents: read        # Read repository contents
  pull-requests: write  # Post comments on PRs
```

### In Repository Settings

1. Go to **Settings** → **Actions** → **General**
2. Under "Workflow permissions":
   - Select **Read and write permissions**
   - ✅ Enable **Allow GitHub Actions to create and approve pull requests**

## CODEOWNERS File (Optional)

Create a `.github/CODEOWNERS` file to automatically request reviews:

```
# Context Repository Owners
/context-repo/ @your-team/context-maintainers

# Schema Changes Require Extra Review
/context-repo/.context/schemas/ @your-team/architects

# Pipelines Require DevOps Review
/context-repo/.context/pipelines/ @your-team/devops
```

## Notifications

Configure notifications for workflow failures:

1. Go to **Settings** → **Notifications**
2. Enable notifications for:
   - Failed workflow runs
   - New pull request reviews requested

## Testing Protection Rules

### Step 1: Create a Test PR

```bash
# Create a test branch
git checkout -b test/protection-rules

# Make an intentional schema violation
echo "invalid: yaml: content:" > context-repo/contexts/features/test.yaml

# Commit and push
git add .
git commit -m "test: Intentional schema violation"
git push origin test/protection-rules
```

### Step 2: Open PR

- Open a pull request from `test/protection-rules` to `main`
- Observe that status checks run
- Verify that "Validate YAML Schemas" fails
- Verify you cannot merge until checks pass

### Step 3: Fix and Verify

```bash
# Remove invalid file
git rm context-repo/contexts/features/test.yaml
git commit -m "test: Remove invalid file"
git push origin test/protection-rules
```

- Verify checks now pass
- Verify you can now merge (with required approvals)

## Troubleshooting

### Status Checks Not Appearing

**Problem:** Required status checks don't appear in the list

**Solutions:**
1. Ensure workflows have run at least once on the `main` branch
2. Check that workflow names match exactly (case-sensitive)
3. Verify workflows have not failed due to permissions

### Checks Always Passing (False Positives)

**Problem:** Invalid changes pass validation

**Solutions:**
1. Review pipeline scripts in `.context/pipelines/`
2. Ensure `validate.mjs` returns non-zero exit code on failure
3. Check workflow step error handling (`continue-on-error: true` should be limited)

### Cannot Merge Despite Passing Checks

**Problem:** Merge button is disabled even with passing checks

**Solutions:**
1. Ensure required approvals are met
2. Check for unresolved conversations (if enabled)
3. Verify branch is up to date with base branch
4. Check for merge conflicts

### Bot Comments Not Appearing

**Problem:** Impact analysis runs but doesn't post PR comment

**Solutions:**
1. Verify workflow has `pull-requests: write` permission
2. Check GitHub Actions logs for API errors
3. Ensure `github-token: ${{ secrets.GITHUB_TOKEN }}` is used
4. Verify PR is not from a fork (forks have restricted permissions)

## Advanced Configurations

### Auto-Merge on Success

Enable auto-merge for PRs that pass all checks:

```yaml
# Add to impact-analysis.yml
- name: Enable auto-merge
  if: steps.impact.outputs.issue_count == '0'
  uses: actions/github-script@v7
  with:
    github-token: ${{ secrets.GITHUB_TOKEN }}
    script: |
      await github.rest.pulls.enableAutoMerge({
        owner: context.repo.owner,
        repo: context.repo.repo,
        pull_number: context.issue.number,
        merge_method: 'squash'
      });
```

### Slack/Teams Notifications

Integrate with chat platforms:

```yaml
- name: Notify Slack on Failure
  if: failure()
  uses: slackapi/slack-github-action@v1
  with:
    webhook: ${{ secrets.SLACK_WEBHOOK }}
    payload: |
      {
        "text": "Schema validation failed on PR #${{ github.event.pull_request.number }}"
      }
```

### Custom Status Checks

Add custom validation logic:

```yaml
- name: Custom Validation
  run: |
    # Your custom validation script
    ./scripts/custom-validate.sh
    
    # Set status based on result
    if [ $? -ne 0 ]; then
      echo "::error::Custom validation failed"
      exit 1
    fi
```

## Maintenance

### Regular Reviews

Schedule quarterly reviews of:
- Protection rules effectiveness
- False positive/negative rates
- Developer feedback on friction
- Workflow performance (execution time)

### Updates

Keep workflows updated:
- Use Dependabot for action version updates
- Review GitHub Actions changelog quarterly
- Test workflow changes on feature branches first

## Security Considerations

1. **Secrets Management**
   - Never commit secrets to workflows
   - Use GitHub Secrets for sensitive data
   - Rotate tokens regularly

2. **Permissions**
   - Use least-privilege principle
   - Review workflow permissions quarterly
   - Limit who can modify workflows

3. **Audit Trail**
   - Enable audit log for rule changes
   - Review workflow run history
   - Monitor for suspicious activity

## References

- [GitHub Branch Protection Documentation](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/defining-the-mergeability-of-pull-requests/about-protected-branches)
- [GitHub Actions Permissions](https://docs.github.com/en/actions/security-guides/automatic-token-authentication)
- [Status Checks API](https://docs.github.com/en/rest/commits/statuses)

---

**Last Updated:** 2025-10-24  
**Maintainer:** Context-Sync Team
