# Phase 5 Task 1: Dedicated Sidecar Config UI - COMPLETE

**Status**: ✅ Complete  
**Date**: 2025-01-XX  
**Goal**: Add dedicated configuration UI for the sidecar in the AI Settings modal, removing dependency on Legacy AI settings

## Summary

Task 1 of Phase 5 is complete. The sidecar now has its own configuration UI with dedicated config file storage. Users can configure provider, endpoint, model, and API key directly in the Sidecar tab without relying on Legacy AI settings.

## Changes Made

### 1. AISettingsModal.vue - Added Config UI

**File**: `app/src/renderer/components/AISettingsModal.vue`

#### Added State Variables (lines 36-43)
```typescript
// Sidecar configuration
const sidecarProvider = ref('ollama');
const sidecarEndpoint = ref('http://localhost:11434');
const sidecarModel = ref('llama2');
const sidecarApiKey = ref('');
const sidecarHasStoredKey = ref(false);
const isSavingSidecar = ref(false);
const sidecarConfigChanged = computed(() => true);
```

#### Added Config Functions (lines 157-262)

**`loadSidecarConfig()`** - Loads config from `.context-kit/sidecar-config.json`
- Uses `window.api.fs.readFile()` to read config file
- Checks for stored API key via `window.api.ai.getCredentials('sidecar-azure-openai')`
- Falls back to defaults if config doesn't exist

**`saveSidecarConfig()`** - Saves config with validation
- Validates config using `validateSidecarConfig()`
- Saves API key separately via `window.api.ai.saveCredentials()`
- Writes config to `.context-kit/sidecar-config.json` via `window.api.fs.writeFile()`
- Shows success message with restart reminder

**`validateSidecarConfig()`** - Validates config before saving
- Validates endpoint is a valid URL
- Validates model name is not empty
- Checks API key exists for Azure OpenAI

#### Replaced Sidecar Tab UI (lines 381-467)

Old UI:
- Warning banner about using Legacy AI settings
- SidecarStatus component
- Status info panel
- Quick start guide

New UI:
- SidecarStatus component (kept)
- Configuration section with fields:
  - Provider dropdown (Ollama / Azure OpenAI)
  - Endpoint input with dynamic placeholder
  - Model input with dynamic placeholder
  - API Key input (Azure only)
  - Save button with validation
  - Restart warning when sidecar is running

### 2. assistantStore.ts - Updated Config Loading

**File**: `app/src/renderer/stores/assistantStore.ts`

#### Updated `getSidecarConfig()` (lines 1018-1113)

New behavior:
1. **Primary**: Try to load from `.context-kit/sidecar-config.json` (sidecar-specific)
2. **Fallback**: Load from legacy AI config via `window.api.ai.getConfig()`
3. **Final Fallback**: Default Ollama config

Key changes:
- Uses `window.api.fs.readFile()` instead of `window.api.app.readFile()`
- Checks for API keys using prefixed credential key: `'sidecar-' + provider`
- Logs when falling back to legacy settings

## Configuration Storage

### File Structure

```
<repo>/.context-kit/sidecar-config.json
```

### Config Schema

```json
{
  "provider": "ollama" | "azure-openai",
  "endpoint": "http://localhost:11434",
  "model": "llama2"
}
```

### API Key Storage

- API keys stored separately via OS-level security (Windows Credential Manager)
- Credential key format: `sidecar-azure-openai` (prefixed to avoid conflicts with Legacy AI)

## User Flow

### First Time Setup

1. User opens AI Settings (Ctrl+K → "AI Settings")
2. Clicks "Sidecar" tab (default tab)
3. Sees SidecarStatus component (sidecar is stopped)
4. Scrolls down to "Sidecar Configuration" section
5. Selects provider (Ollama is default)
6. Enters endpoint and model
7. For Azure: enters API key
8. Clicks "Save Configuration"
9. Config validated and saved to `.context-kit/sidecar-config.json`
10. Success message shows: "✅ Sidecar configuration saved! Restart the sidecar for changes to take effect."
11. Clicks "Start Sidecar" button
12. Sidecar starts with saved config

### Updating Config

1. User changes provider/endpoint/model in UI
2. Clicks "Save Configuration"
3. If sidecar is running, sees warning: "⚠️ Restart sidecar for changes to take effect"
4. User stops and restarts sidecar manually
5. New config takes effect

## Config Precedence

When sidecar loads config via `getSidecarConfig()`:

1. **Sidecar config file** (`.context-kit/sidecar-config.json`) - highest priority
2. **Legacy AI config** (from Legacy AI tab) - fallback
3. **Hardcoded defaults** - final fallback

This ensures:
- Users can migrate to dedicated sidecar config at their own pace
- Sidecar still works if dedicated config doesn't exist
- No breaking changes for existing users

## Validation

### TypeScript Errors
```bash
pnpm run typecheck
# Result: ✅ 0 errors
```

### Linting
```bash
pnpm exec eslint src/renderer/stores/assistantStore.ts src/renderer/components/AISettingsModal.vue
# Result: ✅ 0 errors in modified files
```

**Note**: 1 pre-existing lint error in `src/main/utils/errorHandler.ts` (not related to this change)

## Files Modified

1. `app/src/renderer/components/AISettingsModal.vue` - ~120 lines changed
   - Added sidecar config state variables
   - Added load/save/validate functions
   - Replaced Sidecar tab UI with config form

2. `app/src/renderer/stores/assistantStore.ts` - ~40 lines changed
   - Updated `getSidecarConfig()` to read from dedicated config file first
   - Added fallback logic to legacy config

## Testing Checklist

### Manual Testing Required

- [ ] Open AI Settings modal (Ctrl+K → "AI Settings")
- [ ] Verify Sidecar tab is default
- [ ] Change provider to Ollama
- [ ] Enter endpoint: `http://localhost:11434`
- [ ] Enter model: `llama2`
- [ ] Click "Save Configuration"
- [ ] Verify success message appears
- [ ] Check `.context-kit/sidecar-config.json` file exists
- [ ] Start sidecar
- [ ] Verify sidecar uses saved config
- [ ] Change provider to Azure OpenAI
- [ ] Enter endpoint: `https://test.openai.azure.com`
- [ ] Enter model: `gpt-35-turbo`
- [ ] Enter API key
- [ ] Click "Save Configuration"
- [ ] Verify API key stored securely
- [ ] Stop and restart sidecar
- [ ] Verify sidecar uses new config

### Validation Testing

- [ ] Try to save with invalid endpoint URL → should show error
- [ ] Try to save with empty model → should show error
- [ ] Try to save Azure without API key → should show error
- [ ] Save valid config → should succeed

### Fallback Testing

- [ ] Delete `.context-kit/sidecar-config.json`
- [ ] Configure Legacy AI tab with settings
- [ ] Start sidecar
- [ ] Verify sidecar uses Legacy AI settings
- [ ] Save dedicated sidecar config
- [ ] Restart sidecar
- [ ] Verify sidecar now uses dedicated config (not Legacy)

## Next Steps (Phase 5 Remaining Tasks)

### Task 2: Config Validation Before Starting Sidecar
- Validate endpoint is reachable before starting
- Verify model is available
- Check API key is valid (for Azure)
- Show helpful error messages if validation fails

### Task 3: Real-time Config Updates
- Option A: Hot-reload config without restart
- Option B: Auto-restart sidecar when config changes
- Option C: Show "Apply Changes" button

## Benefits

✅ **User Experience**
- All sidecar settings in one place
- No confusion about which settings to use
- Clear separation from Legacy AI

✅ **Flexibility**
- Can use different providers for sidecar vs Legacy AI
- Can test different configs without affecting Legacy AI
- Easy to switch between configs

✅ **Migration Path**
- Backward compatible with Legacy AI settings
- Users can migrate gradually
- No breaking changes

✅ **Security**
- API keys stored securely per-provider
- Separate credential storage for sidecar vs Legacy AI

## Issues Encountered

None - implementation went smoothly!

## Code Quality

- ✅ TypeScript: 0 errors
- ✅ Linting: 0 errors in modified files
- ✅ Follows existing patterns
- ✅ Proper error handling
- ✅ Validation before saving
- ✅ User feedback via status messages
