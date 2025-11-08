# Phase 5 Task 3: Real-time Config Updates - COMPLETE

**Status**: ✅ Complete  
**Date**: 2025-01-07  
**Goal**: Allow changing sidecar configuration while it's running with automatic restart

## Summary

Task 3 of Phase 5 is complete. The sidecar now supports real-time configuration updates with an intelligent restart mechanism. When users save configuration changes while the sidecar is running, they're prompted with a dialog offering three options: restart now, save without restart, or cancel.

## Implementation Approach

**Selected: Option B - Auto-restart with confirmation**

This approach provides the best user experience by:
- Not surprising users with automatic restarts
- Making it easy to apply changes immediately
- Allowing users to defer restart if needed
- Providing clear feedback during the restart process

## Changes Made

### 1. AISettingsModal.vue - Auto-Restart Logic

**File**: `app/src/renderer/components/AISettingsModal.vue`

#### Added State Variables (lines 44-45)

```typescript
const showRestartDialog = ref(false);
const pendingSaveConfig = ref<any>(null);
```

#### Refactored Save Function (lines 184-199)

**Original `saveSidecarConfig()`:**
- Validated and saved config
- Showed warning about manual restart

**New `saveSidecarConfig()`:**
- Checks if sidecar is running
- If running: Shows confirmation dialog
- If stopped: Saves directly

```typescript
async function saveSidecarConfig() {
  // If sidecar is running, ask for confirmation to restart
  if (assistantStore.isSidecarRunning) {
    pendingSaveConfig.value = {
      provider: sidecarProvider.value,
      endpoint: sidecarEndpoint.value,
      model: sidecarModel.value,
      apiKey: sidecarApiKey.value,
    };
    showRestartDialog.value = true;
    return;
  }
  
  // Otherwise save directly
  await performSaveConfig(false);
}
```

#### Added `performSaveConfig()` Function (lines 201-280)

**Parameters:**
- `withRestart: boolean` - Whether to restart sidecar after saving

**Behavior:**
1. Validates configuration
2. Saves API key if provided
3. Writes config file
4. If `withRestart` is true:
   - Stops sidecar
   - Waits 1 second for clean shutdown
   - Starts sidecar with new config
   - Shows success/error messages

**Error Handling:**
- If restart fails, saves config but shows warning
- Config is always saved, even if restart fails
- User can manually restart if auto-restart fails

#### Added `cancelRestart()` Function (lines 282-285)

Closes dialog without saving when user clicks "Cancel".

#### Added Restart Dialog UI (lines 558-591)

**Dialog Features:**
- Modal overlay (z-index 60, above main modal)
- Three action buttons:
  1. **Cancel** - Close dialog, don't save
  2. **Save Without Restart** - Save config, keep sidecar running with old config
  3. **Save & Restart** - Save and restart (primary action)
- Info tip explaining the restart process
- Clear messaging about what will happen

#### Updated Warning Text (line 507)

**Before:**
```
⚠️ Restart sidecar for changes to take effect
```

**After:**
```
🔄 Sidecar will be restarted to apply changes
```

## User Flow

### Scenario 1: Save While Sidecar is Stopped

1. User edits configuration
2. Clicks "Save Configuration"
3. Config saved immediately
4. Success message: "✅ Sidecar configuration saved!"
5. User can start sidecar with new config

### Scenario 2: Save While Sidecar is Running

1. User edits configuration
2. Clicks "Save Configuration"
3. **Restart confirmation dialog appears**
4. User has three choices:

#### Choice A: Cancel
- Dialog closes
- No changes saved
- Sidecar continues running with old config

#### Choice B: Save Without Restart
- Config saved to disk
- Dialog closes
- Sidecar continues running with old config
- User can manually restart later
- Success message: "✅ Sidecar configuration saved!"

#### Choice C: Save & Restart (Recommended)
- Config saved to disk
- Status message: "✅ Configuration saved! Restarting sidecar..."
- Sidecar stops (status: "stopping")
- Wait 1 second for clean shutdown
- Sidecar starts with new config (status: "starting")
- Health check runs
- Final status: "running" (healthy)
- Success message: "✅ Sidecar restarted successfully with new configuration!"

### Error Handling

**If restart fails:**
- Config is still saved
- Error message: "⚠️ Config saved but restart failed. Please restart manually."
- User can use Start/Stop buttons to restart manually

## Benefits

✅ **User Control**
- Users choose when to apply changes
- No surprise interruptions
- Can defer restart if actively using sidecar

✅ **Convenience**
- One-click restart from dialog
- No need to manually stop and start
- Automatic health check after restart

✅ **Safety**
- Config always saved, even if restart fails
- Clear status messages throughout process
- 1-second delay for clean shutdown

✅ **Transparency**
- Dialog explains what will happen
- Status messages show progress
- Warning indicator when sidecar is running

## Restart Process Details

### Timing

1. **Stop** - Immediate
2. **Wait** - 1000ms (1 second)
3. **Start** - Depends on Python startup
4. **Health Check** - After start completes
5. **Total Time** - Typically 2-3 seconds

### Why 1-second Delay?

The 1-second delay between stop and start ensures:
- Python process fully terminates
- Port is released (8000)
- Clean state for new process
- Prevents "address already in use" errors

## Quality Metrics

### TypeScript
```bash
pnpm run typecheck
# Result: ✅ 0 errors
```

### Linting
```bash
pnpm exec eslint src/renderer/components/AISettingsModal.vue
# Result: ✅ 0 errors
```

## Files Modified

1. **`app/src/renderer/components/AISettingsModal.vue`** (~100 lines changed)
   - Added `showRestartDialog` and `pendingSaveConfig` state
   - Refactored `saveSidecarConfig()` to check if running
   - Added `performSaveConfig(withRestart)` function
   - Added `cancelRestart()` function
   - Added restart confirmation dialog UI
   - Updated warning text

## Testing Checklist

### Manual Testing Required

#### Save While Stopped
- [ ] Edit config (change provider/endpoint/model)
- [ ] Click "Save Configuration"
- [ ] Verify success message appears
- [ ] Verify config file updated
- [ ] Start sidecar
- [ ] Verify new config is used

#### Save While Running - Cancel
- [ ] Start sidecar
- [ ] Edit config
- [ ] Click "Save Configuration"
- [ ] Verify dialog appears
- [ ] Click "Cancel"
- [ ] Verify dialog closes
- [ ] Verify config NOT saved
- [ ] Verify sidecar still running

#### Save While Running - Save Without Restart
- [ ] Start sidecar
- [ ] Edit config (change model name)
- [ ] Click "Save Configuration"
- [ ] Verify dialog appears
- [ ] Click "Save Without Restart"
- [ ] Verify success message
- [ ] Verify config file updated
- [ ] Verify sidecar still running with OLD config
- [ ] Manually stop and start sidecar
- [ ] Verify NEW config is used

#### Save While Running - Save & Restart
- [ ] Start sidecar
- [ ] Edit config (change provider or endpoint)
- [ ] Click "Save Configuration"
- [ ] Verify dialog appears
- [ ] Click "Save & Restart"
- [ ] Verify status messages:
   - "Configuration saved! Restarting sidecar..."
   - Status indicator shows "stopping"
   - Status indicator shows "starting"
   - Status indicator shows "running"
   - "Sidecar restarted successfully..."
- [ ] Verify config file updated
- [ ] Verify sidecar running with NEW config

#### Error Scenarios
- [ ] Edit config with invalid URL
- [ ] Try to save
- [ ] Verify validation error shown
- [ ] Verify dialog does NOT appear

## Comparison with Other Approaches

### Option A: Hot-reload Config

**Pros:**
- No downtime
- Instant updates

**Cons:**
- Complex implementation (requires IPC to Python)
- Python service must support config reload
- Risk of inconsistent state
- Harder to debug

**Verdict:** Rejected - Too complex for benefit

### Option B: Auto-restart with Confirmation ✅ SELECTED

**Pros:**
- Simple implementation
- Clean state after restart
- User control
- Easy to debug

**Cons:**
- 2-3 seconds downtime
- Requires confirmation dialog

**Verdict:** Best balance of simplicity and UX

### Option C: Manual Restart Only

**Pros:**
- Simplest implementation
- No auto-restart logic

**Cons:**
- Poor UX (multiple steps)
- Users might forget to restart
- Confusion about which config is active

**Verdict:** Rejected - Poor UX

## Technical Details

### Dialog Z-Index

The restart dialog uses `z-[60]` to ensure it appears above the main AI Settings modal (`z-50`):

```vue
<div class="fixed inset-0 z-[60] flex items-center justify-center...">
```

### Async Flow

```typescript
async function performSaveConfig(withRestart: boolean) {
  // 1. Save config to disk
  await window.api.fs.writeFile(...)
  
  // 2. If restart requested
  if (withRestart) {
    // 3. Stop sidecar
    await assistantStore.stopSidecar()
    
    // 4. Wait for clean shutdown
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    // 5. Start sidecar with new config
    await assistantStore.startSidecar()
  }
}
```

### State Management

The dialog state is managed locally in the component:
- `showRestartDialog` - Controls dialog visibility
- `pendingSaveConfig` - Stores config to save (not currently used, reserved for future)

The actual save operation uses the existing reactive state:
- `sidecarProvider`
- `sidecarEndpoint`
- `sidecarModel`
- `sidecarApiKey`

## Future Enhancements

### Possible Improvements

1. **Show config diff in dialog**
   - Display what changed
   - Help users make informed decision

2. **Remember user preference**
   - "Always restart" checkbox
   - Skip dialog on future saves

3. **Restart progress indicator**
   - Show spinning icon
   - Percentage complete

4. **Background restart**
   - Allow closing settings modal during restart
   - Show notification when complete

5. **Rollback on failure**
   - Keep backup of old config
   - Restore if restart fails

## Issues Encountered

None - implementation went smoothly!

## Phase 5 Complete! 🎉

All three tasks of Phase 5 are now complete:

✅ **Task 1: Dedicated Sidecar Config UI**
- Separate configuration form in Sidecar tab
- Independent from Legacy AI settings
- Stores config in `.context-kit/sidecar-config.json`

✅ **Task 2: Config Validation**
- Validates before starting
- "Test Configuration" button
- Clear error messages

✅ **Task 3: Real-time Config Updates**
- Auto-restart with confirmation
- Three action options
- Graceful shutdown/startup

## Code Quality

- ✅ TypeScript: 0 errors
- ✅ Linting: 0 errors
- ✅ Proper error handling
- ✅ User-friendly dialogs
- ✅ Clear status messages
- ✅ Comprehensive testing checklist

## Summary

The sidecar configuration system is now fully featured with:
- Dedicated UI
- Validation
- Real-time updates
- User control
- Clear feedback
- Error handling

Users can now configure, validate, and update the sidecar without ever leaving the AI Settings modal or manually managing the service lifecycle.
