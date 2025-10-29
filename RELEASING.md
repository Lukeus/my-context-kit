# Release Process

This document describes the process for creating a new release of Context-Sync.

## Prerequisites

Before creating a release, ensure:

1. ✅ All changes are committed and pushed to `main`
2. ✅ All CI checks are passing (validation, build-graph, tests)
3. ✅ CHANGELOG.md is updated with the new version
4. ✅ Version numbers are updated in package.json files
5. ✅ All lint issues are resolved (`pnpm lint`)
6. ✅ Type checking passes (`pnpm typecheck`)
7. ✅ Local builds work (`pnpm build`)

## Release Types

Context-Sync follows [Semantic Versioning](https://semver.org/):

- **Major** (1.0.0): Breaking changes, major new features
- **Minor** (0.1.0): New features, backward compatible
- **Patch** (0.0.1): Bug fixes, backward compatible

Pre-release versions:
- **Alpha** (0.1.0-alpha.1): Early testing, unstable
- **Beta** (0.1.0-beta.1): Feature complete, testing
- **RC** (0.1.0-rc.1): Release candidate, final testing

## Manual Release Process

### 1. Prepare the Release

```powershell
# Ensure you're on main and up to date
git checkout main
git pull origin main

# Update version in app/package.json
cd app
# Edit package.json: "version": "0.2.0"

# Update CHANGELOG.md
cd ..
# Add a new section for the version with date:
# ## [0.2.0] - 2025-10-30

# Commit version bump
git add app/package.json CHANGELOG.md
git commit -m "chore: bump version to 0.2.0"
git push origin main
```

### 2. Create and Push Tag

```powershell
# Create an annotated tag
git tag -a v0.2.0 -m "Release v0.2.0"

# Push the tag to GitHub
git push origin v0.2.0
```

### 3. Monitor Release Workflow

The GitHub Actions workflow will automatically:
1. Create a GitHub Release (draft)
2. Build Windows installer (.exe, .nupkg)
3. Build macOS package (.zip)
4. Build Linux packages (.deb, .rpm)
5. Upload all artifacts to the release

Monitor progress at: https://github.com/lukeus/my-context-kit/actions

### 4. Review and Publish

1. Go to https://github.com/lukeus/my-context-kit/releases
2. Find the draft release for your version
3. Review the release notes (auto-extracted from CHANGELOG.md)
4. Review all attached assets (should have Windows, macOS, Linux builds)
5. Edit release notes if needed
6. Click **Publish release**

## Automated Release (Future)

For automated releases using GitHub UI:

1. Go to https://github.com/lukeus/my-context-kit/actions/workflows/release.yml
2. Click **Run workflow**
3. Enter the version number (e.g., `0.2.0`)
4. Click **Run workflow**

The workflow will create the release automatically.

## Post-Release Tasks

After publishing a release:

1. ✅ Announce in project README
2. ✅ Update documentation if needed
3. ✅ Close milestone (if using GitHub milestones)
4. ✅ Create a new `[Unreleased]` section in CHANGELOG.md
5. ✅ Test installation on Windows, macOS, and Linux
6. ✅ Monitor GitHub Issues for installation problems

## Hotfix Release Process

For critical bug fixes that need immediate release:

```powershell
# Create hotfix branch from main
git checkout main
git pull origin main
git checkout -b hotfix/0.1.1

# Make fixes, commit, and test
git add .
git commit -m "fix: critical bug description"

# Run full test suite
cd app
pnpm test:all
pnpm lint

# Merge to main
git checkout main
git merge --no-ff hotfix/0.1.1
git push origin main

# Tag and release
git tag -a v0.1.1 -m "Hotfix v0.1.1"
git push origin v0.1.1

# Delete hotfix branch
git branch -d hotfix/0.1.1
```

## Rollback a Release

If a release has critical issues:

1. Delete the GitHub release (makes it unavailable for download)
2. Delete the git tag:
   ```powershell
   git tag -d v0.2.0
   git push origin :refs/tags/v0.2.0
   ```
3. Create a hotfix following the process above

## Code Signing (Future Enhancement)

### Windows Code Signing

To sign Windows executables:

1. Obtain a code signing certificate from a trusted CA
2. Add certificate to GitHub Secrets:
   - `WINDOWS_CERTIFICATE_BASE64`
   - `WINDOWS_CERTIFICATE_PASSWORD`
3. Update `.github/workflows/release.yml` to sign before packaging

### macOS Code Signing & Notarization

To sign and notarize macOS builds:

1. Obtain Apple Developer certificate
2. Add to GitHub Secrets:
   - `APPLE_CERTIFICATE_BASE64`
   - `APPLE_CERTIFICATE_PASSWORD`
   - `APPLE_ID`
   - `APPLE_APP_SPECIFIC_PASSWORD`
   - `APPLE_TEAM_ID`
3. Update forge.config.ts with osxSign configuration
4. Update workflow to notarize after signing

## Release Checklist

Use this checklist for each release:

- [ ] All tests passing locally
- [ ] All CI checks passing
- [ ] CHANGELOG.md updated
- [ ] Version bumped in package.json
- [ ] Changes committed and pushed
- [ ] Tag created and pushed
- [ ] Release workflow completed successfully
- [ ] All build artifacts present in release
- [ ] Release notes reviewed and accurate
- [ ] Release published (not draft)
- [ ] Installation tested on at least one platform
- [ ] README updated if needed
- [ ] Announcement made (if applicable)

## Troubleshooting

### Build Fails on GitHub Actions

1. Check the workflow logs for specific errors
2. Test locally: `cd app && pnpm run make`
3. Ensure all dependencies are in package.json
4. Check Node.js and pnpm versions match locally and in CI

### Assets Not Uploading

1. Check file paths in workflow file match actual output
2. Verify `GITHUB_TOKEN` has write permissions
3. Check workflow permissions in repository settings

### Release Not Created

1. Verify tag format is correct (`v*.*.*`)
2. Check repository permissions
3. Ensure workflow file is on the main branch

## Version History

| Version | Date | Type | Notes |
|---------|------|------|-------|
| 0.1.0 | 2025-10-24 | Minor | Initial MVP release with all phases complete |

## References

- [Semantic Versioning](https://semver.org/)
- [Keep a Changelog](https://keepachangelog.com/)
- [Electron Forge Publishing](https://www.electronforge.io/config/publishers)
- [GitHub Actions Release](https://github.com/softprops/action-gh-release)

---

**Last Updated**: 2025-10-29  
**Maintainer**: Luke Adams (@lukeu)
