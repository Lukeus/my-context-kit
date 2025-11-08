# Phase 4 Manual Testing Guide

**Status**: Ready for testing  
**Date**: 2025-11-07

---

## Prerequisites

### 1. Python Sidecar Dependencies

Ensure Python dependencies are installed:

```powershell
cd C:\Users\lukeu\source\repos\my-context-kit\context-kit-service
pnpm install
```

This will install the Python FastAPI service dependencies.

### 2. TypeScript Compilation

Verify there are no compilation errors:

```powershell
cd C:\Users\lukeu\source\repos\my-context-kit\app
pnpm run typecheck
```

Expected: ✅ 0 errors

---

## Test Plan

### Test 1: Start Electron App

**Steps**:
```powershell
cd C:\Users\lukeu\source\repos\my-context-kit\app
pnpm run dev
```

**Expected**:
- ✅ App launches successfully
- ✅ No errors in console
- ✅ UI loads without crashes

---

### Test 2: Navigate to Sidecar Settings

**Steps**:
1. Press **Ctrl+K** to open the Command Palette
2. Type **"AI Settings"** or **"sidecar"**
3. Press **Enter** to open AI Settings modal
4. Click on the **"🐍 Sidecar"** tab

**Alternative**: Look for a ⚙️ settings icon or menu (if available in UI)

**Expected**:
- ✅ Sidecar tab is visible
- ✅ SidecarStatus component is displayed
- ✅ Status shows **"Stopped"**
- ✅ **"Start Sidecar"** button is visible
- ✅ Status indicator shows gray dot
- ✅ Status Info panel shows:
  - Status: stopped
  - Base URL: Not running
  - Health: ❌ Unhealthy

---

### Test 3: Start the Sidecar

**Steps**:
1. Click **"Start Sidecar"** button

**Expected**:
- ✅ Button becomes disabled with text **"Starting..."**
- ✅ Status changes to **"Starting"**
- ✅ Status dot changes to amber and blinks
- ✅ After 2-5 seconds, status changes to **"Running"**
- ✅ Status dot changes to green and pulses
- ✅ **"Stop Sidecar"** button appears
- ✅ **"Start Sidecar"** button disappears
- ✅ Status Info panel shows:
  - Status: running
  - Base URL: http://localhost:8000
  - Health: ✅ Healthy
- ✅ Console logs show:
  ```
  [SidecarManager] Spawning: python ...
  [Sidecar] INFO: Started server process ...
  [Sidecar] INFO: Uvicorn running on http://0.0.0.0:8000
  ```

**Troubleshooting**:
- If status shows **"Error"**, check console for error messages
- Verify Python is in PATH: `python --version`
- Verify port 8000 is not in use: `netstat -ano | findstr :8000`
- Check Python service manually: `cd context-kit-service && pnpm start`

---

### Test 4: Health Polling

**Steps**:
1. With sidecar running, wait 5-10 seconds

**Expected**:
- ✅ Green dot continues pulsing every ~2 seconds
- ✅ No errors in console
- ✅ Status remains **"Running"**
- ✅ Health remains **"✅ Healthy"**

**Verify**:
- Open browser to `http://localhost:8000/health`
- Should see: `{"status":"healthy"}`

---

### Test 5: Manual Health Check

**Steps**:
1. Kill the Python process manually:
   - Find process: `Get-Process python | Where-Object {$_.Path -like "*context-kit-service*"}`
   - Kill it: `Stop-Process -Id <PID>`
2. Wait 5-10 seconds

**Expected**:
- ✅ Status changes to **"Error"**
- ✅ Status dot changes to red
- ✅ Health changes to **"❌ Unhealthy"**
- ✅ **"Start Sidecar"** button reappears
- ✅ Console shows error message

---

### Test 6: Restart After Error

**Steps**:
1. Click **"Start Sidecar"** button again

**Expected**:
- ✅ Sidecar restarts successfully
- ✅ Status returns to **"Running"**
- ✅ Health returns to **"✅ Healthy"**

---

### Test 7: Graceful Shutdown

**Steps**:
1. With sidecar running, click **"Stop Sidecar"** button

**Expected**:
- ✅ Button becomes disabled with text **"Stopping..."**
- ✅ Status changes to **"Stopping"**
- ✅ Status dot changes to amber
- ✅ After 1-2 seconds, status changes to **"Stopped"**
- ✅ **"Start Sidecar"** button reappears
- ✅ **"Stop Sidecar"** button disappears
- ✅ Console shows process terminated
- ✅ Python process is no longer running: `Get-Process python` (should not show context-kit-service)

---

### Test 8: API Endpoint Test (Optional)

**Prerequisites**: Sidecar must be running

**Steps**:
```powershell
# Test health endpoint
curl http://localhost:8000/health

# Test Swagger docs
Start-Process "http://localhost:8000/docs"
```

**Expected**:
- ✅ `/health` returns `{"status":"healthy"}`
- ✅ Swagger UI opens in browser showing all API endpoints:
  - POST /api/ai/generate-entity
  - POST /api/ai/assist/stream
  - POST /api/ai/tools/execute
  - POST /api/ai/rag/query

---

### Test 9: IPC Bridge Test (Advanced)

**Prerequisites**: Sidecar must be running

**Steps**:
1. Open DevTools in Electron (F12 or Ctrl+Shift+I)
2. Run in console:
```javascript
// Test health check
await window.api.sidecar.health()
// Expected: {healthy: true}

// Test status
await window.api.sidecar.status()
// Expected: {status: "running", baseUrl: "http://localhost:8000"}
```

**Expected**:
- ✅ Both commands return expected values
- ✅ No errors thrown

---

### Test 10: App Restart Test

**Steps**:
1. With sidecar **running**, close the Electron app
2. Restart the app: `pnpm run dev`
3. Navigate to Sidecar tab

**Expected**:
- ✅ Status shows **"Stopped"** (sidecar doesn't persist)
- ✅ No errors in console
- ✅ Can start sidecar again successfully

**Note**: This is expected behavior - sidecar is managed per-app session

---

## Success Criteria

Phase 4 is **COMPLETE** if:

- ✅ All 10 tests pass
- ✅ Sidecar can start/stop reliably
- ✅ Health polling works correctly
- ✅ UI updates reflect actual sidecar state
- ✅ No memory leaks or crashes
- ✅ Error recovery works (restart after failure)

---

## Known Limitations

1. **No Auto-Start**: Sidecar must be manually started each time the app launches
2. **No Persistence**: Sidecar state is not saved between app restarts
3. **No Real AI Operations**: Entity generation and streaming are wired but not used by existing UI
4. **Fixed Port**: Sidecar always uses port 8000 (conflicts if port is in use)

---

## Next Steps

Once Phase 4 testing is complete:

1. **Wire Entity Generation**: Update entity generation UI to call `window.api.sidecar.generateEntity`
2. **Wire Streaming**: Update assistant chat to use `window.api.sidecar.assistStream`
3. **Add Real AI Config**: Connect sidecar to Ollama/Azure OpenAI settings
4. **Production Hardening**: Error recovery, auto-restart, logging

---

## Troubleshooting

### Sidecar Won't Start

**Symptoms**:
- Status immediately shows "Error"
- Console shows Python spawn error

**Solutions**:
1. Check Python is installed: `python --version`
2. Check Python dependencies: `cd context-kit-service && pnpm install`
3. Try manual start: `cd context-kit-service && pnpm start`
4. Check port 8000: `netstat -ano | findstr :8000`

### Health Check Fails

**Symptoms**:
- Status shows "Error" after initially showing "Running"
- Health shows "❌ Unhealthy"

**Solutions**:
1. Check if Python process is still running: `Get-Process python`
2. Check console for crash logs
3. Try accessing `http://localhost:8000/health` directly
4. Restart sidecar

### UI Not Updating

**Symptoms**:
- Status doesn't change after clicking buttons
- Health polling doesn't work

**Solutions**:
1. Check DevTools console for errors
2. Verify IPC handlers are registered (check console logs on app start)
3. Restart the Electron app
4. Check that `initializeSidecarHandlers()` is being called in `register.ts`

### Port Already in Use

**Symptoms**:
- Sidecar fails to start
- Error: "Address already in use"

**Solutions**:
1. Find process using port 8000: `netstat -ano | findstr :8000`
2. Kill the process: `Stop-Process -Id <PID>`
3. Or change port in `SidecarManager.ts` (requires rebuild)

---

## Reporting Issues

If tests fail, please provide:

1. **Test number** that failed (e.g., "Test 3: Start the Sidecar")
2. **What happened** (actual behavior)
3. **Console logs** (copy from DevTools console)
4. **Screenshots** (if UI issue)
5. **System info**:
   - Windows version
   - Python version: `python --version`
   - Node version: `node --version`
   - pnpm version: `pnpm --version`

---

## Estimated Testing Time

- **Quick Test** (Tests 1-3, 7): ~5 minutes
- **Full Test Suite**: ~15 minutes
- **With Troubleshooting**: ~30 minutes

---

**Phase 4 Status**: ✅ Implementation complete, ready for manual testing
