# Quick Release Guide

## Quick Release (Recommended)

```powershell
# 1. Update version and CHANGELOG
pnpm version:minor  # or version:patch or version:major

# 2. Review changes
git diff app/package.json CHANGELOG.md

# 3. Commit and push
git add app/package.json CHANGELOG.md
git commit -m "chore: bump version to X.Y.Z"
git push origin main

# 4. Create and push tag
git tag -a vX.Y.Z -m "Release vX.Y.Z"
git push origin vX.Y.Z
```

The GitHub Actions workflow will automatically:
- ✅ Build Windows, macOS, and Linux packages
- ✅ Create a GitHub Release with all artifacts
- ✅ Extract release notes from CHANGELOG.md

## Using Workflow Dispatch

Alternative method via GitHub UI:

1. Go to: https://github.com/lukeus/my-context-kit/actions/workflows/release.yml
2. Click **Run workflow**
3. Enter version (e.g., `0.2.0`)
4. Click **Run workflow**

## Pre-Release Checklist

Before releasing, ensure:

- [ ] All tests pass: `pnpm test:all`
- [ ] Lint checks pass: `pnpm lint`
- [ ] Type checking passes: `pnpm typecheck`
- [ ] CHANGELOG.md has [Unreleased] changes documented
- [ ] All changes committed to main branch

## Version Bump Scripts

```powershell
pnpm version:patch   # 0.1.0 → 0.1.1 (bug fixes)
pnpm version:minor   # 0.1.0 → 0.2.0 (new features)
pnpm version:major   # 0.1.0 → 1.0.0 (breaking changes)
```

## After Release is Published

1. Verify installers work on all platforms
2. Update documentation if needed
3. Announce release (if applicable)

## Full Documentation

See [RELEASING.md](../RELEASING.md) for detailed instructions.
