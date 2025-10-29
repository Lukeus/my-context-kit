# Release Infrastructure Documentation

This document describes the enterprise-grade release infrastructure for Context-Sync.

## Overview

The release infrastructure provides automated, multi-platform builds with GitHub Releases integration. All releases are triggered by pushing version tags and are built in GitHub Actions.

## Components Created

### 1. GitHub Actions Workflow (`.github/workflows/release.yml`)

**Purpose**: Automated multi-platform release builds

**Triggers**:
- Push tags matching `v*.*.*` (e.g., `v0.2.0`)
- Manual workflow dispatch with version input

**Jobs**:
1. **create-release**: Creates GitHub Release with CHANGELOG extraction
2. **build-windows**: Builds Windows Squirrel installer (.exe, .nupkg)
3. **build-macos**: Builds macOS ZIP package
4. **build-linux**: Builds Debian (.deb) and RPM (.rpm) packages
5. **validate-release**: Ensures all artifacts uploaded successfully

**Features**:
- Parallel builds for all platforms
- Automatic release notes from CHANGELOG.md
- Pre-release detection (alpha, beta, rc)
- Draft releases by default (manual publish step)

### 2. Version Management

#### CHANGELOG.md
- Follows [Keep a Changelog](https://keepachangelog.com/) format
- Tracks all notable changes
- Automatically extracted for GitHub Release notes
- Includes version comparison links

#### Version Bump Script (`scripts/version-bump.mjs`)
- Automatically bumps semantic versions
- Updates `app/package.json`
- Updates `CHANGELOG.md` [Unreleased] → [Version]
- Provides next steps instructions

**Usage**:
```powershell
pnpm version:patch   # Bug fixes: 0.1.0 → 0.1.1
pnpm version:minor   # New features: 0.1.0 → 0.2.0
pnpm version:major   # Breaking changes: 0.1.0 → 1.0.0
```

### 3. Electron Forge Configuration

Updated `app/forge.config.ts` with:
- GitHub publisher configuration
- Bundle ID and app category (macOS)
- Icon paths (to be added)
- Draft release mode

Added dependency:
- `@electron-forge/publisher-github@^7.10.2`

### 4. Documentation

#### RELEASING.md (Comprehensive Guide)
- Manual and automated release processes
- Pre-release checklist
- Hotfix procedures
- Rollback instructions
- Code signing setup (future)
- Troubleshooting guide

#### .github/RELEASE_GUIDE.md (Quick Reference)
- Quick copy-paste commands
- Pre-release checklist
- Version bump shortcuts

### 5. README Updates

Added to README.md:
- Release and download badges
- Installation table with platform-specific instructions
- Links to latest releases
- Security note about code signing status

### 6. GitHub Copilot Instructions

Updated `.github/copilot-instructions.md`:
- Release management guidelines
- Version bump script commands
- Release workflow best practices

## Release Workflow

### Standard Release

```powershell
# 1. Update unreleased changes in CHANGELOG.md
# Add your changes under [Unreleased] section

# 2. Bump version and update files
pnpm version:minor  # or patch/major

# 3. Review changes
git diff app/package.json CHANGELOG.md

# 4. Commit version bump
git add app/package.json CHANGELOG.md
git commit -m "chore: bump version to 0.2.0"
git push origin main

# 5. Create and push tag
git tag -a v0.2.0 -m "Release v0.2.0"
git push origin v0.2.0

# 6. Monitor workflow
# Go to: https://github.com/lukeus/my-context-kit/actions

# 7. Publish release
# Go to: https://github.com/lukeus/my-context-kit/releases
# Review draft release and click "Publish release"
```

### Automated Release (GitHub UI)

1. Navigate to Actions → Release workflow
2. Click "Run workflow"
3. Enter version number
4. Monitor build progress
5. Publish draft release

## Build Artifacts

Each release includes:

| Platform | Artifact | Format | Notes |
|----------|----------|--------|-------|
| Windows | `context-sync-*-Setup.exe` | Squirrel | Auto-updater ready |
| Windows | `context-sync-*-full.nupkg` | NuGet | Update package |
| macOS | `context-sync-*-darwin-x64.zip` | ZIP | Universal binary |
| Linux (Debian) | `context-sync_*_amd64.deb` | DEB | apt/dpkg |
| Linux (RHEL) | `context-sync-*.x86_64.rpm` | RPM | yum/dnf |

## Security & Code Signing

### Current State
- ❌ Windows: Not code signed (SmartScreen warning expected)
- ❌ macOS: Not notarized (Gatekeeper warning expected)
- ❌ Linux: Not signed

### Future Implementation

#### Windows Code Signing
1. Obtain certificate from trusted CA (DigiCert, Sectigo, etc.)
2. Add to GitHub Secrets:
   - `WINDOWS_CERTIFICATE_BASE64`
   - `WINDOWS_CERTIFICATE_PASSWORD`
3. Update workflow to sign `.exe` files
4. Estimated cost: $200-400/year

#### macOS Notarization
1. Enroll in Apple Developer Program ($99/year)
2. Add to GitHub Secrets:
   - `APPLE_CERTIFICATE_BASE64`
   - `APPLE_CERTIFICATE_PASSWORD`
   - `APPLE_ID`
   - `APPLE_APP_SPECIFIC_PASSWORD`
   - `APPLE_TEAM_ID`
3. Update `forge.config.ts` with `osxSign` config
4. Add notarization step to workflow

## Auto-Updates (Future)

To enable auto-updates:

1. Install `electron-updater`:
   ```powershell
   cd app
   pnpm add electron-updater
   ```

2. Configure update server in main process
3. Add update UI in renderer
4. Update `forge.config.ts` with update URLs

## Monitoring & Analytics

### Release Metrics
- Download counts (GitHub Releases)
- Platform distribution
- Version adoption rates

### Build Metrics
- Build duration per platform
- Artifact sizes
- Workflow success rate

## Best Practices

### Before Release
- ✅ All tests passing
- ✅ Lint and typecheck clean
- ✅ CHANGELOG.md updated
- ✅ Version bumped correctly
- ✅ Git tag created

### After Release
- ✅ Test installation on all platforms
- ✅ Verify update mechanisms work
- ✅ Monitor GitHub Issues for problems
- ✅ Update documentation if needed

### Hotfix Process
1. Create `hotfix/X.Y.Z` branch from main
2. Make fix and test thoroughly
3. Merge to main with `--no-ff`
4. Tag and release immediately
5. Delete hotfix branch

## Troubleshooting

### Build Fails
- Check workflow logs in GitHub Actions
- Test locally: `cd app && pnpm run make`
- Verify Node.js/pnpm versions match CI

### Assets Missing
- Verify file paths in workflow match output structure
- Check `GITHUB_TOKEN` permissions
- Ensure workflow runs on main branch

### Version Conflicts
- Ensure `app/package.json` version matches tag
- Check CHANGELOG.md has matching section
- Verify tag follows `v*.*.*` format

## Cost Estimation

Enterprise-grade releases involve:

| Item | Cost | Frequency |
|------|------|-----------|
| GitHub Actions (Public repo) | $0 | N/A |
| Windows Code Signing Cert | $200-400 | Annual |
| Apple Developer Program | $99 | Annual |
| CDN for Updates (optional) | $0-50 | Monthly |
| **Total Annual** | **$299-549** | - |

For private repositories, add GitHub Actions costs (~$0.008/minute).

## References

- [Electron Forge Documentation](https://www.electronforge.io/)
- [GitHub Actions Release](https://docs.github.com/en/actions/publishing-packages)
- [Semantic Versioning](https://semver.org/)
- [Keep a Changelog](https://keepachangelog.com/)
- [Code Signing Guide](https://www.electronjs.org/docs/latest/tutorial/code-signing)

---

**Document Version**: 1.0  
**Last Updated**: 2025-10-29  
**Author**: Luke Adams (@lukeu)
