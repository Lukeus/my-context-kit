# Integration Testing Guide

## Overview

This guide provides step-by-step instructions to test all newly integrated features end-to-end.

---

## Prerequisites

1. **Development Environment**:
   - Node.js and npm installed
   - Git configured with credentials
   - Repository with remote configured

2. **Application Setup**:
   - Run `npm install` in both root and `/app` directories
   - Start the app in development mode: `npm run dev`

3. **Test Repository**:
   - Have a context repository with `.context/agents.json`
   - Ensure Git remote is configured: `git remote -v`

---

## Test Suite 1: Agent Library & CRUD Operations

### 1.1 View Built-in Agents

**Steps**:
1. Open the app
2. Navigate to Agent Library (add nav item or access via developer tools)
3. Verify 7 built-in agents are displayed:
   - General Assistant
   - Code Generator
   - Documentation Writer
   - Testing Specialist
   - Code Reviewer
   - Debugging Assistant
   - Architecture Advisor

**Expected Results**:
- ✅ All 7 built-in agents visible
- ✅ Each has icon, name, description, tags, complexity badge
- ✅ Grid and list view modes work
- ✅ Filtering by tag and complexity works
- ✅ Search filters agents correctly

---

### 1.2 Create Custom Agent

**Steps**:
1. Click "New" button in Agent Library header
2. Fill in the form:
   - **Name**: "Test Custom Agent"
   - **Description**: "Testing custom agent creation"
   - **Icon**: 🧪
   - **System Prompt**: "You are a test assistant."
   - **Tags**: Select "testing"
   - **Complexity**: "basic"
3. Click "Create Agent"

**Expected Results**:
- ✅ Modal closes
- ✅ New agent appears in "Custom Agents" section
- ✅ Agent has correct icon, name, description
- ✅ "Custom" badge displayed

---

### 1.3 Edit Custom Agent

**Steps**:
1. Find your custom agent in the list
2. Click "Edit" button
3. Modify description to "Updated test agent"
4. Add another tag
5. Click "Save Changes"

**Expected Results**:
- ✅ Modal closes
- ✅ Agent updated with new description
- ✅ New tag appears in agent card

---

### 1.4 Duplicate Built-in Agent

**Steps**:
1. Find "Code Generator" in built-in agents
2. Click "Duplicate" button
3. Modify name to "My Code Generator"
4. Click "Create Agent"

**Expected Results**:
- ✅ New custom agent created
- ✅ Inherits all properties from original
- ✅ Name includes " (Copy)" initially
- ✅ Marked as custom, not built-in

---

### 1.5 Delete Custom Agent

**Steps**:
1. Find your test custom agent
2. Click "Delete" button
3. Confirm deletion in modal

**Expected Results**:
- ✅ Confirmation modal appears
- ✅ After confirmation, agent removed from list
- ✅ No errors in console

---

## Test Suite 2: Git Sync Features

### 2.1 Check Sync Status

**Steps**:
1. In Agent Library, expand the "Git Sync" panel
2. Observe sync status information

**Expected Results**:
- ✅ Shows current branch
- ✅ Shows commit count (ahead/behind)
- ✅ Shows "Changes detected" if `.context/agents.json` modified
- ✅ Displays last sync time

---

### 2.2 Pull Agents from Remote

**Steps**:
1. (Setup) In another clone of your repo, add a new custom agent and push
2. In the app, expand Git Sync panel
3. Click "Pull" button
4. Wait for operation to complete

**Expected Results**:
- ✅ Success message displayed
- ✅ New agent appears in Agent Library
- ✅ Sync status updates
- ✅ No conflicts reported (clean pull)

---

### 2.3 Push Agents to Remote

**Steps**:
1. Create a new custom agent (see 1.2)
2. Expand Git Sync panel
3. Enter commit message: "Add test agent"
4. Click "Push" button
5. Wait for operation to complete

**Expected Results**:
- ✅ Success message displayed
- ✅ Commit created with your message
- ✅ Changes pushed to remote
- ✅ Verify via `git log` in terminal

---

### 2.4 Bidirectional Sync

**Steps**:
1. Create a new agent locally
2. (Setup) Add a different agent in another clone and push
3. Expand Git Sync panel
4. Enter commit message: "Sync agents"
5. Click "Sync" button

**Expected Results**:
- ✅ Pulls remote changes first
- ✅ Pushes local changes second
- ✅ Both agents now present
- ✅ No conflicts

---

### 2.5 View Sync History

**Steps**:
1. After several sync operations, expand Git Sync panel
2. Scroll to "Recent Syncs" section

**Expected Results**:
- ✅ Last 5 sync operations listed
- ✅ Each shows timestamp, operation type, and status
- ✅ Success/failure indicated with colors

---

## Test Suite 3: Sync Settings & Auto-Sync

### 3.1 Access Sync Settings

**Steps**:
1. In Agent Library header, click the ⚙️ (settings) button
2. Observe the settings modal

**Expected Results**:
- ✅ Modal opens with sync settings
- ✅ Shows 4 sections: auto-pull, auto-push, background sync, templates
- ✅ All toggles and inputs functional

---

### 3.2 Enable Auto-Pull on Start

**Steps**:
1. Open sync settings
2. Toggle "Auto-pull on start" ON
3. Click "Save Settings"
4. Restart the app
5. Check Agent Library

**Expected Results**:
- ✅ Settings saved (check localStorage: `agent-sync-settings`)
- ✅ On app restart, auto-pull initiated
- ✅ Any remote agents pulled automatically
- ✅ No user interaction required

---

### 3.3 Enable Auto-Push on Save

**Steps**:
1. Open sync settings
2. Toggle "Auto-push on save" ON
3. Set commit message template: "Auto-save: {{action}}"
4. Click "Save Settings"
5. Create a new agent
6. Save the agent

**Expected Results**:
- ✅ Agent saved
- ✅ Auto-push triggered
- ✅ Commit created with template message
- ✅ Changes pushed to remote without manual sync

---

### 3.4 Configure Background Sync

**Steps**:
1. Open sync settings
2. Enable "Background sync"
3. Set interval to 5 minutes
4. Save settings
5. Wait 5+ minutes

**Expected Results**:
- ✅ Auto-sync triggered at interval
- ✅ No interruption to user workflow
- ✅ Sync status updates automatically

---

## Test Suite 4: Context Assistant (New UX)

### 4.1 Access Context Assistant

**Steps**:
1. Navigate to AI Assistant panel (Ctrl+Shift+A or header button)
2. Observe the new ContextAssistant UI

**Expected Results**:
- ✅ Clean chat interface displayed
- ✅ Agent selector visible in header
- ✅ Repository name auto-detected
- ✅ Tools panel collapsed by default

---

### 4.2 Select Agent

**Steps**:
1. Click agent selector dropdown in header
2. Select "Documentation Writer"

**Expected Results**:
- ✅ Dropdown shows all agents (built-in + custom)
- ✅ Selected agent name displayed
- ✅ Agent behavior applies to chat

---

### 4.3 Send Message

**Steps**:
1. Type message: "Explain this repository"
2. Press Enter or click Send

**Expected Results**:
- ✅ Message added to chat as user bubble
- ✅ Typing indicator appears
- ✅ AI response rendered as assistant bubble
- ✅ Response uses selected agent's behavior

---

### 4.4 Toggle Tools Panel

**Steps**:
1. Click "Tools" button in header
2. Observe collapsible panel
3. Click "Validate Context" button
4. Click "Tools" button again to collapse

**Expected Results**:
- ✅ Panel expands smoothly
- ✅ Shows quick actions (Validate, Build Graph, etc.)
- ✅ Actions execute correctly
- ✅ Panel collapses when toggled

---

### 4.5 View Session Info

**Steps**:
1. Expand tools panel
2. Observe "Session Info" section

**Expected Results**:
- ✅ Shows active agent
- ✅ Shows current repository
- ✅ Shows session start time
- ✅ Shows message count

---

### 4.6 Empty State

**Steps**:
1. Clear chat history (or start fresh session)
2. Observe empty state

**Expected Results**:
- ✅ Shows agent icon and name
- ✅ Displays agent description
- ✅ Lists 3 example prompts
- ✅ Prompts are clickable and auto-fill input

---

## Test Suite 5: Conflict Resolution (Manual Trigger)

### 5.1 Simulate Merge Conflict

**Note**: This requires manual Git conflict creation.

**Setup**:
1. In Clone A: Create agent "conflict-test-a", commit, push
2. In Clone B: Create different agent "conflict-test-b" with same ID, commit
3. In Clone B: Try to pull

**Steps in App**:
1. Open Agent Library
2. Click Pull
3. Observe conflict detected

**Expected Results**:
- ✅ ConflictResolutionDialog opens automatically
- ✅ Shows side-by-side diff of conflicting agents
- ✅ Three resolution options: Keep Local, Keep Remote, Merge
- ✅ Can navigate between multiple conflicts

---

### 5.2 Resolve Conflict: Keep Local

**Steps**:
1. In ConflictResolutionDialog, select "Keep Local"
2. Click "Apply Resolutions"

**Expected Results**:
- ✅ Local version retained
- ✅ Remote version discarded
- ✅ Dialog closes
- ✅ Agent list updated

---

### 5.3 Resolve Conflict: Keep Remote

**Steps**:
1. (Recreate conflict)
2. Select "Keep Remote"
3. Click "Apply Resolutions"

**Expected Results**:
- ✅ Remote version retained
- ✅ Local version discarded
- ✅ Agent list reflects remote version

---

### 5.4 Resolve Conflict: Merge

**Steps**:
1. (Recreate conflict)
2. Select "Merge"
3. Click "Apply Resolutions"

**Expected Results**:
- ✅ Merged version created
- ✅ Combines metadata from local and content from remote
- ✅ `updatedAt` timestamp updated

---

## Test Suite 6: Integration with Existing Features

### 6.1 Use Agent in Chat

**Steps**:
1. Select a custom agent in ContextAssistant
2. Send a message
3. Observe agent behavior

**Expected Results**:
- ✅ AI responds according to agent's system prompt
- ✅ Agent config (temperature, max tokens) applied
- ✅ Tools defined in agent profile available

---

### 6.2 Persist Agent Selection

**Steps**:
1. Select an agent
2. Restart the app
3. Check ContextAssistant

**Expected Results**:
- ✅ Last selected agent persists
- ✅ Agent auto-selected on restart

---

### 6.3 Agent Selector Integration

**Steps**:
1. Open AgentSelector component (if standalone)
2. Select different agents
3. Observe behavior in connected chat

**Expected Results**:
- ✅ AgentSelector syncs with store
- ✅ All components reflect active agent
- ✅ Smooth transitions

---

## Test Suite 7: Error Handling

### 7.1 Sync Without Remote

**Steps**:
1. Disconnect from network or remove Git remote
2. Try to pull/push agents

**Expected Results**:
- ✅ Error message displayed
- ✅ User informed: "No remote configured"
- ✅ App doesn't crash

---

### 7.2 Invalid Agent Data

**Steps**:
1. Manually edit `.context/agents.json` with invalid JSON
2. Try to load agents

**Expected Results**:
- ✅ Error message displayed
- ✅ User informed: "Failed to parse agents file"
- ✅ App remains functional

---

### 7.3 Conflicting Local Changes

**Steps**:
1. Create agent locally
2. Don't commit
3. Try to pull

**Expected Results**:
- ✅ Warning: "Local changes detected, commit first"
- ✅ Pull blocked until committed
- ✅ User can either commit or stash

---

## Test Suite 8: Performance & UX

### 8.1 Large Agent List

**Setup**: Create 50+ custom agents (script or manual)

**Steps**:
1. Open Agent Library
2. Scroll through agents
3. Filter and search

**Expected Results**:
- ✅ Smooth scrolling (no lag)
- ✅ Search results instant (<300ms)
- ✅ View mode toggle responsive

---

### 8.2 Sync with Large History

**Setup**: Perform 20+ sync operations

**Steps**:
1. Open Git Sync panel
2. View sync history

**Expected Results**:
- ✅ Only last 5 syncs displayed (pagination)
- ✅ Loads quickly
- ✅ UI remains responsive

---

### 8.3 Concurrent Operations

**Steps**:
1. Start a sync operation
2. Immediately try to create a new agent

**Expected Results**:
- ✅ UI shows loading state
- ✅ Actions queued or blocked appropriately
- ✅ No race conditions
- ✅ Clear feedback to user

---

## Test Suite 9: Accessibility & Responsiveness

### 9.1 Keyboard Navigation

**Steps**:
1. Navigate Agent Library using Tab key
2. Use Enter/Space to activate buttons
3. Use Escape to close modals

**Expected Results**:
- ✅ All interactive elements focusable
- ✅ Focus indicators visible
- ✅ Keyboard shortcuts work

---

### 9.2 Screen Sizes

**Steps**:
1. Resize browser window to mobile size (375px)
2. Test tablet size (768px)
3. Test desktop size (1920px)

**Expected Results**:
- ✅ Layouts adapt responsively
- ✅ No horizontal scrolling
- ✅ All features accessible

---

### 9.3 Dark Mode (if implemented)

**Steps**:
1. Toggle dark mode
2. Check all components

**Expected Results**:
- ✅ All text readable
- ✅ Proper contrast ratios
- ✅ Icons visible

---

## Test Suite 10: Documentation & Help

### 10.1 Inline Help

**Steps**:
1. Hover over tooltips in Agent Library
2. Check empty states
3. Review error messages

**Expected Results**:
- ✅ Tooltips informative
- ✅ Empty states guide user
- ✅ Error messages actionable

---

### 10.2 Documentation Links

**Steps**:
1. Check for links to docs
2. Verify they open correct pages

**Expected Results**:
- ✅ Links present where appropriate
- ✅ Links work
- ✅ Docs accurate

---

## Automated Testing

### Unit Tests

Run unit tests for components:

```bash
npm test -- --watch app/src/renderer/components/assistant/
```

**Expected**:
- ✅ AgentLibrary.spec.ts passes
- ✅ AgentProfileEditor.spec.ts passes
- ✅ AgentSelector.spec.ts passes
- ✅ AgentSyncPanel.spec.ts passes
- ✅ ContextAssistant.spec.ts passes

---

### Integration Tests

Run integration tests:

```bash
npm run test:integration
```

**Expected**:
- ✅ Agent CRUD operations pass
- ✅ Sync operations pass
- ✅ Store mutations pass

---

### E2E Tests

Run end-to-end tests (if Cypress/Playwright configured):

```bash
npm run test:e2e
```

**Expected**:
- ✅ Full user flows pass
- ✅ Cross-component interactions work
- ✅ No console errors

---

## Regression Testing

After any code changes, re-run:

1. **Critical Path**:
   - Create agent → Save → Sync → Restart → Verify
   
2. **Edge Cases**:
   - Empty agent list
   - Network offline
   - Invalid data

3. **Performance**:
   - Measure load times
   - Check memory usage
   - Monitor CPU usage

---

## Deployment Checklist

Before deploying to production:

- [ ] All test suites pass
- [ ] No console errors or warnings
- [ ] Linting passes: `npm run lint`
- [ ] Type checking passes: `npm run typecheck`
- [ ] Build succeeds: `npm run build`
- [ ] User documentation updated
- [ ] Changelog updated
- [ ] Version bumped

---

## Reporting Issues

If a test fails:

1. **Document**:
   - Exact steps to reproduce
   - Expected vs. actual behavior
   - Screenshots/videos
   - Console logs

2. **Isolate**:
   - Does it happen consistently?
   - Does it affect other features?
   - Can you narrow down the cause?

3. **Report**:
   - Create GitHub issue
   - Tag appropriately
   - Link to relevant PRs

---

## Summary

### Total Test Cases: 60+

**Breakdown**:
- Agent CRUD: 10 tests
- Git Sync: 10 tests
- Auto-Sync Settings: 8 tests
- Context Assistant: 12 tests
- Conflict Resolution: 8 tests
- Integration: 6 tests
- Error Handling: 6 tests
- Performance: 6 tests
- Accessibility: 6 tests
- Documentation: 4 tests

### Time Estimate

- **Manual Testing**: 3-4 hours (full suite)
- **Automated Testing**: 15-20 minutes
- **Smoke Test**: 30 minutes (critical path only)

---

## Quick Smoke Test (10 min)

1. ✅ Create agent
2. ✅ Edit agent
3. ✅ Push to remote
4. ✅ Pull from remote
5. ✅ Select agent in chat
6. ✅ Send message
7. ✅ Toggle tools panel
8. ✅ Open sync settings
9. ✅ Restart app
10. ✅ Verify persistence

---

## Continuous Improvement

### Add to CI/CD Pipeline

```yaml
# .github/workflows/test.yml
name: Test
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck
      - run: npm test
      - run: npm run build
```

---

## Conclusion

This comprehensive testing guide ensures all integrated features work correctly individually and together. Follow it before each release to maintain quality.

**Status**: ✅ All features integrated and ready for testing  
**Next Steps**: Execute test suites and address any failures  
**Maintenance**: Update this guide as new features are added
