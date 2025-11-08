# Combining Multiple Pull Requests

This guide explains how to combine multiple pull requests (PRs) into a single PR for cleaner merge history and easier review.

## Table of Contents

- [When to Combine PRs](#when-to-combine-prs)
- [Prerequisites](#prerequisites)
- [Methods Overview](#methods-overview)
- [Method 1: Cherry-Pick (Recommended)](#method-1-cherry-pick-recommended)
- [Method 2: Merge Multiple Branches](#method-2-merge-multiple-branches)
- [Method 3: Rebase and Squash](#method-3-rebase-and-squash)
- [Method 4: Manual Merge](#method-4-manual-merge)
- [Updating the Combined PR](#updating-the-combined-pr)
- [Troubleshooting](#troubleshooting)
- [Best Practices](#best-practices)

---

## When to Combine PRs

Consider combining PRs when:

- ✅ Multiple PRs address related features or fixes
- ✅ PRs have dependencies on each other
- ✅ You want to reduce review overhead
- ✅ PRs are small and logically connected
- ✅ Combining provides better context for reviewers

**Don't combine if:**
- ❌ PRs address completely unrelated features
- ❌ One PR needs urgent merge while others need more work
- ❌ PRs have different reviewers or approval requirements
- ❌ Combining makes the change too large to review effectively

---

## Prerequisites

Before combining PRs, ensure:

1. ✅ You have a clean working directory: `git status`
2. ✅ All local changes are committed or stashed
3. ✅ You're on the main/base branch: `git checkout main`
4. ✅ Your local repository is up to date: `git pull origin main`
5. ✅ You know the PR branch names you want to combine

---

## Methods Overview

| Method | Use Case | Pros | Cons | Complexity |
|--------|----------|------|------|------------|
| **Cherry-Pick** | Select specific commits from multiple PRs | Precise control, clean history | Manual selection required | Medium |
| **Merge Branches** | Combine all changes from multiple branches | Simple, preserves all changes | Can create messy history | Easy |
| **Rebase & Squash** | Linear history with single commit | Clean, simple | Loses individual commit messages | Medium |
| **Manual Merge** | Full control over final result | Maximum flexibility | Most labor-intensive | Hard |

---

## Method 1: Cherry-Pick (Recommended)

This method gives you precise control over which commits to include.

### Step-by-Step

```bash
# 1. Create a new branch for the combined PR
git checkout main
git pull origin main
git checkout -b combined/multiple-features

# 2. List commits from each PR branch
git log --oneline pr-branch-1
git log --oneline pr-branch-2
git log --oneline pr-branch-3

# 3. Cherry-pick specific commits (replace with actual commit hashes)
git cherry-pick abc123f  # From PR 1
git cherry-pick def456a  # From PR 1
git cherry-pick 789beef  # From PR 2
git cherry-pick c0ffee1  # From PR 3

# 4. Resolve any conflicts if they occur
# Edit conflicting files, then:
git add .
git cherry-pick --continue

# 5. Push the combined branch
git push origin combined/multiple-features

# 6. Create a new PR on GitHub from 'combined/multiple-features' to 'main'
```

### Example for Context-Sync

```bash
# Scenario: Combine AI features and UI improvements
git checkout main
git pull origin main
git checkout -b combined/ai-ui-enhancements

# Cherry-pick AI service improvements
git cherry-pick 1a2b3c4  # "feat: add semantic search"
git cherry-pick 5d6e7f8  # "feat: enhance impact analysis"

# Cherry-pick UI updates
git cherry-pick 9g0h1i2  # "ui: improve AI settings panel"
git cherry-pick 3j4k5l6  # "ui: add embedding model selector"

git push origin combined/ai-ui-enhancements
```

### Advantages
- ✅ Full control over which commits to include
- ✅ Can reorder commits logically
- ✅ Excludes experimental or broken commits
- ✅ Clean, intentional history

### Disadvantages
- ⚠️ Requires knowing commit hashes
- ⚠️ May need to resolve conflicts manually
- ⚠️ Time-consuming for many commits

---

## Method 2: Merge Multiple Branches

This method merges all changes from multiple branches into one.

### Step-by-Step

```bash
# 1. Create a new combined branch
git checkout main
git pull origin main
git checkout -b combined/merged-features

# 2. Merge each PR branch
git merge --no-ff pr-branch-1 -m "Merge PR 1: Description"
git merge --no-ff pr-branch-2 -m "Merge PR 2: Description"
git merge --no-ff pr-branch-3 -m "Merge PR 3: Description"

# 3. Resolve conflicts if needed
# For each conflict:
git status  # See conflicting files
# Edit files to resolve conflicts
git add .
git merge --continue

# 4. Push the combined branch
git push origin combined/merged-features

# 5. Create new PR on GitHub
```

### Example for Context-Sync

```bash
git checkout main
git pull origin main
git checkout -b combined/enterprise-features

# Merge service refactoring
git merge --no-ff feature/service-layer -m "Merge service architecture (P1/P2)"

# Merge IPC standardization
git merge --no-ff feature/ipc-responses -m "Merge IPC standardization (P3)"

# Merge pipeline improvements
git merge --no-ff feature/pipeline-refactor -m "Merge pipeline refactoring (P4)"

git push origin combined/enterprise-features
```

### Advantages
- ✅ Simple and straightforward
- ✅ Preserves all commits from all branches
- ✅ Clear merge points in history

### Disadvantages
- ⚠️ Creates merge commits (cluttered history)
- ⚠️ Includes all commits (even experimental ones)
- ⚠️ May have many conflict resolution points

---

## Method 3: Rebase and Squash

This method creates a linear history and can squash commits.

### Step-by-Step

```bash
# 1. Create a new combined branch
git checkout main
git pull origin main
git checkout -b combined/squashed-features

# 2. Merge first branch normally
git merge pr-branch-1

# 3. For subsequent branches, use rebase to linearize
git rebase pr-branch-2
git rebase pr-branch-3

# 4. (Optional) Interactive rebase to squash/reorder commits
git rebase -i main

# In the interactive editor:
# - Change 'pick' to 'squash' for commits you want to combine
# - Reorder commits by moving lines
# - Save and close

# 5. Resolve conflicts during rebase
# Edit conflicting files
git add .
git rebase --continue

# 6. Force push (rebasing rewrites history)
git push origin combined/squashed-features --force-with-lease

# 7. Create new PR on GitHub
```

### Interactive Rebase Example

When you run `git rebase -i main`, you'll see:

```
pick 1a2b3c4 feat: add semantic search
pick 5d6e7f8 feat: enhance impact analysis
pick 9g0h1i2 ui: improve AI settings panel
pick 3j4k5l6 ui: add embedding model selector

# Commands:
# p, pick = use commit
# s, squash = combine with previous commit
# f, fixup = like squash, but discard commit message
```

Change to:

```
pick 1a2b3c4 feat: add semantic search
squash 5d6e7f8 feat: enhance impact analysis
pick 9g0h1i2 ui: improve AI settings panel
squash 3j4k5l6 ui: add embedding model selector
```

Result: 2 commits instead of 4.

### Advantages
- ✅ Linear, clean history
- ✅ Can combine many commits into one
- ✅ Easy to understand final changes

### Disadvantages
- ⚠️ Requires force push (risky)
- ⚠️ Loses individual commit history
- ⚠️ More complex conflict resolution

---

## Method 4: Manual Merge

This method gives you complete control but requires manual work.

### Step-by-Step

```bash
# 1. Create a new combined branch
git checkout main
git pull origin main
git checkout -b combined/manual-merge

# 2. For each PR, manually copy changes
# View changes from PR branch
git diff main..pr-branch-1

# Apply changes manually by editing files
# - Copy code from PR 1
# - Copy code from PR 2
# - Copy code from PR 3

# 3. Stage and commit all changes
git add .
git commit -m "feat: combined features from PRs #123, #124, #125

- Feature 1 from PR #123
- Feature 2 from PR #124  
- Feature 3 from PR #125"

# 4. Push the combined branch
git push origin combined/manual-merge

# 5. Create new PR on GitHub
```

### Advantages
- ✅ Complete control over final code
- ✅ Single clean commit
- ✅ No merge conflicts to resolve

### Disadvantages
- ⚠️ Very time-consuming
- ⚠️ Error-prone (easy to miss changes)
- ⚠️ Loses commit history entirely

---

## Updating the Combined PR

After creating your combined PR:

### 1. Close Original PRs

Add a comment to each original PR:

```markdown
Closing this PR in favor of combined PR #XXX which includes:
- Changes from this PR (#123)
- Related changes from PR #124
- Additional improvements from PR #125

See combined PR for full context: #XXX
```

Then close (don't merge) the original PRs.

### 2. Update PR Description

Create a comprehensive description:

```markdown
## Combined PR: [Feature Group Name]

This PR combines changes from multiple related PRs for easier review:

- #123 - Feature/fix description
- #124 - Feature/fix description  
- #125 - Feature/fix description

## Changes Included

### From PR #123
- Change 1
- Change 2

### From PR #124
- Change 3
- Change 4

### From PR #125
- Change 5
- Change 6

## Testing

All changes have been tested individually and in combination:
- [x] Unit tests pass
- [x] Integration tests pass
- [x] Manual testing completed

## Related Issues

Closes #XX, #YY, #ZZ
```

### 3. Request Reviews

- Tag reviewers from all original PRs
- Ask for fresh review of combined changes
- Highlight any integration points between the combined changes

---

## Troubleshooting

### Merge Conflicts

**Problem:** Conflicts occur when combining branches

**Solution:**
```bash
# View conflicting files
git status

# For each conflict:
# 1. Open the file in your editor
# 2. Look for conflict markers:
#    <<<<<<< HEAD
#    Your changes
#    =======
#    Their changes
#    >>>>>>> branch-name

# 3. Manually resolve by choosing the correct code

# 4. Stage resolved files
git add <resolved-file>

# 5. Continue the operation
git merge --continue  # For merge
# or
git cherry-pick --continue  # For cherry-pick
# or
git rebase --continue  # For rebase
```

### Forgot a Commit

**Problem:** Realized you missed a commit after pushing

**Solution:**
```bash
# Cherry-pick the missed commit
git cherry-pick <commit-hash>

# Push the update
git push origin combined/feature-name
```

### Wrong Commits Included

**Problem:** Accidentally included unwanted commits

**Solution:**
```bash
# Option 1: Interactive rebase to remove commits
git rebase -i main
# Delete the line with the unwanted commit
# Save and close

git push origin combined/feature-name --force-with-lease

# Option 2: Revert specific commits
git revert <unwanted-commit-hash>
git push origin combined/feature-name
```

### Force Push Issues

**Problem:** Force push rejected or causes problems

**Solution:**
```bash
# Use --force-with-lease instead of --force
# This prevents overwriting others' work
git push origin combined/feature-name --force-with-lease

# If still rejected, fetch and try again
git fetch origin
git push origin combined/feature-name --force-with-lease
```

### Lost Changes

**Problem:** Changes disappeared during combination

**Solution:**
```bash
# View reflog to find lost commits
git reflog

# Cherry-pick lost commits
git cherry-pick <lost-commit-hash>

# Or reset to a previous state
git reset --hard <commit-before-loss>
```

---

## Best Practices

### Before Combining

1. **Communicate with team**
   - Notify other developers
   - Explain why you're combining PRs
   - Get alignment on approach

2. **Ensure CI passes**
   - All original PRs should have passing tests
   - Fix any issues before combining

3. **Review dependencies**
   - Check if PRs depend on each other
   - Understand the order of changes

4. **Backup branches**
   ```bash
   git branch backup/pr-branch-1 pr-branch-1
   git branch backup/pr-branch-2 pr-branch-2
   ```

### During Combining

1. **Test frequently**
   ```bash
   cd app
   pnpm install
   pnpm typecheck
   pnpm lint
   pnpm build
   pnpm start
   ```

2. **Commit incrementally**
   - Combine in stages
   - Test after each merge/cherry-pick
   - Don't wait until the end

3. **Document decisions**
   - Note why you chose specific commits
   - Explain conflict resolutions
   - Record any changes made during combination

### After Combining

1. **Comprehensive testing**
   ```bash
   # For Context-Sync:
   cd app
   pnpm install
   pnpm typecheck    # Type check
   pnpm lint         # Lint check
   pnpm build        # Build check
   pnpm start        # Manual testing
   
   cd ../context-repo
   pnpm validate     # Validate context
   pnpm build-graph  # Build graph
   ```

2. **Update documentation**
   - Update CHANGELOG.md
   - Update relevant docs
   - Update PR descriptions

3. **Clear communication**
   - Comprehensive PR description
   - Link all related PRs
   - Tag all relevant reviewers

---

## Example Workflow for Context-Sync

Here's a complete example combining three PRs in this repository:

```bash
# Scenario: Combine service refactoring (P1), IPC standardization (P3), 
# and pipeline refactoring (P4) into one PR

# 1. Start fresh
cd /home/runner/work/my-context-kit/my-context-kit
git checkout main
git pull origin main

# 2. Create combined branch
git checkout -b combined/service-architecture-refactoring

# 3. Cherry-pick commits from P1 (service layer)
git log --oneline feature/p1-services | head -10
git cherry-pick a1b2c3d  # "feat: create AIService"
git cherry-pick e4f5g6h  # "feat: create ValidationService"
git cherry-pick i7j8k9l  # "feat: create GitService"
git cherry-pick m0n1o2p  # "test: add service tests"

# 4. Cherry-pick commits from P3 (IPC responses)
git log --oneline feature/p3-ipc | head -10
git cherry-pick q3r4s5t  # "feat: standardize IPC responses"
git cherry-pick u6v7w8x  # "refactor: update handlers"

# 5. Cherry-pick commits from P4 (pipelines)
git log --oneline feature/p4-pipelines | head -10
git cherry-pick y9z0a1b  # "feat: create shared pipeline utilities"
git cherry-pick c2d3e4f  # "refactor: update all pipelines"
git cherry-pick g5h6i7j  # "test: add pipeline tests"

# 6. Test everything
cd app
pnpm install
pnpm typecheck
pnpm lint
pnpm build

cd ../context-repo
pnpm validate
pnpm build-graph

# 7. Push combined branch
cd ..
git push origin combined/service-architecture-refactoring

# 8. Create PR on GitHub with comprehensive description
# 9. Close original PRs with links to combined PR
# 10. Request reviews from all relevant reviewers
```

---

## Related Documentation

- [RELEASING.md](../RELEASING.md) - Release process
- [merge-protection-setup.md](./merge-protection-setup.md) - Branch protection
- [README.md](../README.md) - Project overview

---

## Additional Resources

- [Git Cherry-Pick Documentation](https://git-scm.com/docs/git-cherry-pick)
- [Git Rebase Documentation](https://git-scm.com/docs/git-rebase)
- [Git Merge Documentation](https://git-scm.com/docs/git-merge)
- [GitHub Pull Request Documentation](https://docs.github.com/en/pull-requests)

---

**Last Updated:** 2025-11-08  
**Maintainer:** Luke Adams (@lukeu)
