# GitHub Actions Workflows

Enterprise-grade CI/CD pipeline for Context-Sync.

## Quick Reference

| Workflow | Trigger | Purpose | Duration | Cost |
|----------|---------|---------|----------|------|
| **ci.yml** | PR, Push | Lint, test, build | ~20 min | $0.50 |
| **cd.yml** | Manual | Deploy to staging/prod | ~30 min | $1.00 |
| **security.yml** | PR, Push, Daily | Security scans | ~20 min | $0.50 |
| **pr-automation.yml** | PR events | Auto-label, validate | ~5 min | $0.10 |
| **context-validate.yml** | Context changes | Validate YAML/schemas | ~10 min | $0.30 |
| **impact-analysis.yml** | Context changes | Impact analysis | ~10 min | $0.30 |
| **release.yml** | Tags | Build releases | ~45 min | $2.00 |

## Status Badges

Add to README.md:

```markdown
[![CI](https://github.com/lukeus/my-context-kit/actions/workflows/ci.yml/badge.svg)](https://github.com/lukeus/my-context-kit/actions/workflows/ci.yml)
[![Security](https://github.com/lukeus/my-context-kit/actions/workflows/security.yml/badge.svg)](https://github.com/lukeus/my-context-kit/actions/workflows/security.yml)
[![Release](https://github.com/lukeus/my-context-kit/actions/workflows/release.yml/badge.svg)](https://github.com/lukeus/my-context-kit/actions/workflows/release.yml)
```

## Workflow Files

### CI Pipeline (`ci.yml`)
Comprehensive continuous integration with:
- ✅ Pre-flight checks with path filtering
- ✅ Lint & format validation
- ✅ TypeScript type checking
- ✅ Cross-platform unit tests (Ubuntu, Windows, macOS)
- ✅ E2E tests with Playwright
- ✅ Multi-platform builds
- ✅ Bundle size analysis
- ✅ Code coverage reporting

### CD Pipeline (`cd.yml`)
Production-ready continuous deployment:
- ✅ Pre-deployment validation (lint, test, typecheck)
- ✅ Staging deployment with smoke tests
- ✅ Production deployment with manual approval
- ✅ Automatic rollback on failure
- ✅ Deployment tracking and reporting
- ✅ Backup creation before production deploy

### Security Scanning (`security.yml`)
Multi-layered security analysis:
- ✅ Dependency vulnerability scanning (pnpm audit)
- ✅ Secret detection (Gitleaks, TruffleHog)
- ✅ SAST with CodeQL and Semgrep
- ✅ License compliance checking
- ✅ Container/filesystem scanning (Trivy)
- ✅ OpenSSF Scorecard
- ✅ Automated PR comments for vulnerabilities

### PR Automation (`pr-automation.yml`)
Automated PR quality enforcement:
- ✅ Auto-labeling (size, type, area)
- ✅ Reviewer auto-assignment
- ✅ Title validation (conventional commits)
- ✅ Size checks and warnings
- ✅ Description validation
- ✅ Conflict detection
- ✅ Dependency change alerts
- ✅ Stale PR management
- ✅ Metrics tracking

### Context Validation (`context-validate.yml`)
Domain-specific validation:
- ✅ C4 diagram validation
- ✅ YAML schema validation
- ✅ Dependency graph building
- ✅ Dangling reference checks

### Impact Analysis (`impact-analysis.yml`)
Change impact tracking:
- ✅ Detect changed entities
- ✅ Analyze downstream effects
- ✅ PR comments with impact reports
- ✅ Consistency rule checking

### Release (`release.yml`)
Multi-platform release automation:
- ✅ Windows (Squirrel installer)
- ✅ macOS (ZIP)
- ✅ Linux (DEB, RPM)
- ✅ Automatic changelog generation
- ✅ GitHub Release creation
- ✅ Asset uploading

## Configuration Files

| File | Purpose |
|------|---------|
| `labeler.yml` | Path-based PR labeling rules |
| `auto-assign.yml` | Reviewer auto-assignment rules |
| `dependabot.yml` | Automated dependency updates |

## Required Setup

### 1. GitHub Secrets (Optional)
```bash
# Code coverage
CODECOV_TOKEN

# Security scanning (optional)
GITLEAKS_LICENSE

# Deployment (when needed)
AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY
SLACK_WEBHOOK_URL
```

### 2. GitHub Environments

Create protected environments:

**Staging**:
- No approval required
- URL: https://staging.context-sync.example.com

**Production**:
- Requires 1 reviewer approval
- 5-minute wait timer
- URL: https://context-sync.example.com

### 3. Branch Protection

For `main` branch:
- ✅ Require PR reviews (1 reviewer)
- ✅ Require status checks:
  - CI Pipeline Success
  - Security Scan Summary
  - Context Repository Validation
- ✅ Require conversation resolution
- ✅ No force push

## Usage Examples

### Deploy to Staging
```bash
# Via GitHub UI
Actions → CD Pipeline → Run workflow
Environment: staging
```

### Deploy to Production
```bash
# Via GitHub UI (requires approval)
Actions → CD Pipeline → Run workflow
Environment: production
Version: 1.0.0
```

### Create a Release
```bash
# Tag and push
git tag v1.0.0
git push origin v1.0.0

# Or via GitHub UI
Actions → Release → Run workflow
Version: 1.0.0
```

### Manual Security Scan
```bash
# Via GitHub UI
Actions → Security Scanning → Run workflow
```

## Local Testing

Test workflows locally with [act](https://github.com/nektos/act):

```bash
# Install act
winget install nektos.act

# Test CI workflow
act pull_request -W .github/workflows/ci.yml

# Test with secrets
act -s GITHUB_TOKEN=your_token

# List available workflows
act -l
```

## Monitoring

### GitHub Actions Dashboard
```
https://github.com/lukeus/my-context-kit/actions
```

### Security Dashboard
```
https://github.com/lukeus/my-context-kit/security
```

### Workflow Insights
- View run history
- Check duration trends
- Monitor success rates
- Analyze failure patterns

## Cost Optimization

**Current Usage** (~2,050 min/month):
- Free tier covers basic usage
- Upgrade to Pro ($4/month) for buffer
- Team plan ($21/month) for multiple developers

**Tips**:
- Use path filters to skip unnecessary jobs
- Cache dependencies (60-80% speedup)
- Run expensive jobs only on main branch
- Set appropriate timeouts

## Troubleshooting

### Common Issues

**Workflow not triggering?**
- Check path filters match changed files
- Verify branch names in `on:` triggers
- Check branch protection rules

**Tests failing in CI but passing locally?**
- Check Node.js version mismatch
- Verify environment variables
- Check for timing/race conditions
- Enable debug logging

**Security scan failures?**
- Review SARIF results in Security tab
- Check for false positives
- Update vulnerable dependencies
- Add exceptions if needed

**Deployment failures?**
- Check environment secrets
- Verify deployment permissions
- Review smoke test results
- Check rollback logs

### Debug Mode

Enable in workflow file:
```yaml
env:
  ACTIONS_RUNNER_DEBUG: true
  ACTIONS_STEP_DEBUG: true
```

## Documentation

Full documentation: [`/docs/cicd-documentation.md`](../../docs/cicd-documentation.md)

Topics covered:
- Detailed workflow descriptions
- Architecture diagrams
- Security best practices
- Deployment procedures
- Metrics and KPIs
- Maintenance schedules

## Support

- **Issues**: [GitHub Issues](https://github.com/lukeus/my-context-kit/issues)
- **Documentation**: [/docs](../../docs/)
- **Discussions**: [GitHub Discussions](https://github.com/lukeus/my-context-kit/discussions)

---

**Last Updated**: October 29, 2025  
**Version**: 1.0.0  
**Maintained By**: Luke Adams (@lukeu)
