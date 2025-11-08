# Phase 5 Task 2: Config Validation Before Starting - COMPLETE

**Status**: ✅ Complete  
**Date**: 2025-01-07  
**Goal**: Add configuration validation before starting the sidecar to prevent startup failures

## Summary

Task 2 of Phase 5 is complete. The sidecar now validates configuration before starting, checking endpoint reachability, API key presence, and model specification. Users receive clear error messages if validation fails, preventing startup issues.

## Changes Made

### 1. assistantStore.ts - Added Validation Function

**File**: `app/src/renderer/stores/assistantStore.ts`

#### Added `validateSidecarConfig()` Function (lines 1115-1168)

**Validation Checks:**

1. **Endpoint URL Format**
   - Validates URL is properly formatted using `new URL()`
   - Returns immediately if URL is invalid

2. **Model Name**
   - Checks model name is not empty or whitespace

3. **API Key (Azure OpenAI only)**
   - Checks if API key is configured
   - Shows helpful error message with instructions

4. **Endpoint Reachability (Ollama only)**
   - Performs HTTP GET request to endpoint with 3-second timeout
   - Accepts 404 status (server running, endpoint may not exist)
   - Detects timeouts and connection failures
   - Shows clear error messages

**Return Value:**
```typescript
{
  valid: boolean,
  errors: string[],
  config: Config | null
}
```

#### Updated `startSidecar()` Function (lines 1170-1196)

**New Behavior:**
1. Call `validateSidecarConfig()` before starting
2. If validation fails:
   - Set status to 'error'
   - Set error message with all validation errors
   - Return early without starting sidecar
3. If validation succeeds:
   - Proceed with normal startup

#### Exported Function (line 1282)

Added `validateSidecarConfig` to store exports so UI can call it independently.

### 2. SidecarStatus.vue - Added Test Button & Error Display

**File**: `app/src/renderer/components/assistant/SidecarStatus.vue`

#### Added Test Configuration Button (lines 9-16)

**Features:**
- Blue button next to Start/Stop
- Shows "Testing..." while running validation
- Disabled while testing
- Only visible when sidecar is stopped or in error state

#### Added Error Display Sections (lines 37-49)

**Validation Errors Panel:**
- Shows yellow/amber warning box
- Lists all validation errors as bullet points
- Special styling for success message (✅ Configuration is valid!)
- Auto-dismisses success message after 3 seconds

**Sidecar Error Panel:**
- Shows red error box
- Displays sidecar startup/runtime errors
- Pre-formatted error message with monospace font

#### Updated Script Section (lines 53-122)

**New State:**
- `isTesting` ref - tracks validation in progress
- `validationErrors` ref - stores validation error messages
- `sidecarError` computed - gets error from store

**New Function: `handleTest()`** (lines 93-112)
- Clears previous errors
- Calls `assistantStore.validateSidecarConfig()`
- Shows success message if valid
- Shows error list if invalid
- Auto-dismisses success after 3 seconds

**Updated Functions:**
- `handleStart()` - Clears validation errors before starting
- `handleStop()` - Clears validation errors when stopping

#### Added Styles (lines 146-299)

**New Styles:**
- `.sidecar-status-wrapper` - Flex container for status + errors
- `.btn-test` - Blue test button styling
- `.validation-errors` - Yellow warning panel
- `.sidecar-error` - Red error panel
- `.error-header` - Bold error section headers
- `.error-list` - Styled bullet list
- `.error-message` - Monospace pre-formatted error text
- Special styling for success message (green color)

## Validation Flow

### User Testing Configuration

1. User clicks "Test Configuration" button
2. Button shows "Testing..." and disables
3. `validateSidecarConfig()` runs:
   - Validates URL format
   - Checks model name
   - Checks API key (Azure only)
   - Pings Ollama endpoint (Ollama only)
4. Results displayed:
   - ✅ Success: Green "Configuration is valid!" message (auto-dismiss after 3s)
   - ❌ Failure: Yellow panel with list of errors

### User Starting Sidecar

1. User clicks "Start Sidecar" button
2. Validation runs automatically (behind the scenes)
3. If validation fails:
   - Sidecar status changes to "error"
   - Red error panel shows validation failures
   - Sidecar doesn't start
4. If validation succeeds:
   - Sidecar starts normally
   - Status changes to "starting" then "running"

## Validation Rules

### Common Checks

| Check | Rule | Error Message |
|-------|------|---------------|
| Endpoint URL | Must be valid URL format | "Invalid endpoint URL format" |
| Model Name | Must not be empty | "Model name is required" |

### Azure OpenAI Specific

| Check | Rule | Error Message |
|-------|------|---------------|
| API Key | Must be configured in secure storage | "API key is required for Azure OpenAI. Please configure it in AI Settings." |

### Ollama Specific

| Check | Rule | Error Message |
|-------|------|---------------|
| Endpoint Reachable | HTTP GET must succeed within 3s | "Failed to reach Ollama endpoint. Make sure Ollama is running." |
| Timeout | Response within 3 seconds | "Ollama endpoint timeout. Make sure Ollama is running." |
| HTTP Status | 200 or 404 acceptable | "Ollama endpoint returned status {code}" |

**Note**: 404 status is acceptable for Ollama because the base endpoint may not have a route, but the server is running.

## Examples

### Valid Ollama Configuration

**Config:**
```json
{
  "provider": "ollama",
  "endpoint": "http://localhost:11434",
  "model": "llama2"
}
```

**Result:**
```
✅ Configuration is valid!
```

### Invalid Endpoint URL

**Config:**
```json
{
  "provider": "ollama",
  "endpoint": "not-a-url",
  "model": "llama2"
}
```

**Result:**
```
⚠️ Configuration Issues:
• Invalid endpoint URL format
```

### Ollama Not Running

**Config:**
```json
{
  "provider": "ollama",
  "endpoint": "http://localhost:11434",
  "model": "llama2"
}
```

**Result:**
```
⚠️ Configuration Issues:
• Failed to reach Ollama endpoint. Make sure Ollama is running.
```

### Azure Without API Key

**Config:**
```json
{
  "provider": "azure-openai",
  "endpoint": "https://my-resource.openai.azure.com",
  "model": "gpt-35-turbo"
}
```

**Result:**
```
⚠️ Configuration Issues:
• API key is required for Azure OpenAI. Please configure it in AI Settings.
```

## Quality Metrics

### TypeScript
```bash
pnpm run typecheck
# Result: ✅ 0 errors
```

### Linting
```bash
pnpm exec eslint src/renderer/stores/assistantStore.ts src/renderer/components/assistant/SidecarStatus.vue
# Result: ✅ 0 errors
```

## Files Modified

1. **`app/src/renderer/stores/assistantStore.ts`** (~60 lines changed)
   - Added `validateSidecarConfig()` function with comprehensive checks
   - Updated `startSidecar()` to validate before starting
   - Exported validation function

2. **`app/src/renderer/components/assistant/SidecarStatus.vue`** (~125 lines changed)
   - Added Test Configuration button
   - Added validation errors display panel
   - Added sidecar error display panel
   - Added `handleTest()` function
   - Updated `handleStart()` and `handleStop()` to clear errors
   - Added comprehensive styling for error panels

## Benefits

✅ **Prevents Startup Failures**
- Catches configuration issues before attempting to start
- No more "sidecar started but doesn't work"

✅ **Clear Error Messages**
- Specific, actionable error messages
- Users know exactly what to fix

✅ **Better UX**
- Test button allows checking config without starting
- Visual feedback with color-coded error panels
- Success message confirms valid configuration

✅ **Saves Time**
- Quick validation without full startup cycle
- Identifies multiple issues at once

## Testing Checklist

### Manual Testing Required

#### Ollama Validation
- [ ] Test with Ollama running → should show valid
- [ ] Test with Ollama stopped → should show endpoint error
- [ ] Test with invalid URL → should show URL format error
- [ ] Test with empty model → should show model required error

#### Azure Validation
- [ ] Test with valid endpoint + API key → should show valid
- [ ] Test with valid endpoint, no API key → should show API key error
- [ ] Test with invalid URL → should show URL format error
- [ ] Test with empty model → should show model required error

#### UI Testing
- [ ] Click Test Configuration → should show testing state
- [ ] Valid config → should show green success message
- [ ] Valid config → success message auto-dismisses after 3s
- [ ] Invalid config → should show yellow error panel
- [ ] Click Start with valid config → should start normally
- [ ] Click Start with invalid config → should show red error panel
- [ ] Validation errors displayed in user-friendly format

## Next Steps (Phase 5 Remaining Tasks)

### Task 3: Real-time Config Updates
- Option A: Hot-reload config without restart
- Option B: Auto-restart sidecar when config changes  
- Option C: Show "Apply Changes" button with manual restart

## Technical Details

### Timeout Handling

The Ollama endpoint check uses `AbortController` with a 3-second timeout:

```typescript
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 3000);

const response = await fetch(config.endpoint, {
  method: 'GET',
  signal: controller.signal
});
clearTimeout(timeoutId);
```

This prevents the validation from hanging indefinitely if Ollama is not responding.

### Error Aggregation

All validation checks run to completion, collecting all errors before returning:

```typescript
const errors: string[] = [];

// Check 1
if (condition1) errors.push('Error 1');

// Check 2
if (condition2) errors.push('Error 2');

// Check 3
if (condition3) errors.push('Error 3');

return { valid: errors.length === 0, errors, config };
```

This shows users all issues at once rather than one at a time.

## Issues Encountered

None - implementation went smoothly!

## Code Quality

- ✅ TypeScript: 0 errors
- ✅ Linting: 0 errors in modified files
- ✅ Proper error handling
- ✅ User-friendly error messages
- ✅ Timeout handling for network requests
- ✅ Comprehensive validation coverage
