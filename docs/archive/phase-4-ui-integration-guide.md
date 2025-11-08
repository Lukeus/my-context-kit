# Phase 4 UI Integration Guide

**Status**: Infrastructure complete, UI integration remaining  
**Estimated Time**: 1-2 hours

---

## What's Already Complete ✅

Phase 4 core infrastructure is **100% complete**:

1. ✅ **SidecarManager** - Process lifecycle management (351 lines)
2. ✅ **SidecarClient** - HTTP client with Zod validation (447 lines)
3. ✅ **IPC Handlers** - All sidecar operations bridged (252 lines)
4. ✅ **Schemas** - Complete type contracts (264 TS + 327 Python lines)

---

## Remaining Tasks

### 1. Add Sidecar Status to Assistant Store

**File**: `app/src/renderer/stores/assistantStore.ts`

**Add State** (around line 120, near health state):
```typescript
// Sidecar state
const sidecarStatus = ref<'stopped' | 'starting' | 'running' | 'error' | 'stopping'>('stopped');
const sidecarBaseUrl = ref<string | null>(null);
const sidecarHealthy = ref(false);
```

**Add Computed** (around line 180):
```typescript
const isSidecarRunning = computed(() => sidecarStatus.value === 'running');
const canUseSidecar = computed(() => isSidecarRunning.value && sidecarHealthy.value);
```

**Add Actions**:
```typescript
async function startSidecar() {
  try {
    const result = await window.api.invoke('sidecar:start');
    if (result.success) {
      sidecarStatus.value = 'running';
      sidecarBaseUrl.value = result.baseUrl;
      await checkSidecarHealth();
    }
  } catch (error) {
    console.error('Failed to start sidecar:', error);
    sidecarStatus.value = 'error';
  }
}

async function stopSidecar() {
  try {
    await window.api.invoke('sidecar:stop');
    sidecarStatus.value = 'stopped';
    sidecarBaseUrl.value = null;
  } catch (error) {
    console.error('Failed to stop sidecar:', error);
  }
}

async function checkSidecarHealth() {
  try {
    const result = await window.api.invoke('sidecar:health');
    sidecarHealthy.value = result.healthy;
  } catch (error) {
    sidecarHealthy.value = false;
  }
}
```

**Add to Store Return** (at the end):
```typescript
return {
  // ... existing exports
  sidecarStatus,
  sidecarHealthy,
  isSidecarRunning,
  canUseSidecar,
  startSidecar,
  stopSidecar,
  checkSidecarHealth,
};
```

---

### 2. Add Sidecar Status UI Component

**File**: `app/src/renderer/components/assistant/SidecarStatus.vue` (NEW)

```vue
<template>
  <div class="sidecar-status">
    <div class="status-indicator" :class="statusClass">
      <span class="status-dot"></span>
      <span class="status-text">{{ statusText }}</span>
    </div>
    
    <button
      v-if="showStartButton"
      @click="handleStart"
      class="btn-start"
      :disabled="isStarting"
    >
      {{ isStarting ? 'Starting...' : 'Start Sidecar' }}
    </button>
    
    <button
      v-if="showStopButton"
      @click="handleStop"
      class="btn-stop"
      :disabled="isStopping"
    >
      {{ isStopping ? 'Stopping...' : 'Stop Sidecar' }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue';
import { useAssistantStore } from '@/stores/assistantStore';

const assistantStore = useAssistantStore();

const statusClass = computed(() => {
  switch (assistantStore.sidecarStatus) {
    case 'running':
      return 'status-running';
    case 'error':
      return 'status-error';
    case 'starting':
    case 'stopping':
      return 'status-transitioning';
    default:
      return 'status-stopped';
  }
});

const statusText = computed(() => {
  if (assistantStore.sidecarStatus === 'running') {
    return assistantStore.sidecarHealthy ? 'Sidecar Running' : 'Sidecar Unhealthy';
  }
  return assistantStore.sidecarStatus.charAt(0).toUpperCase() + assistantStore.sidecarStatus.slice(1);
});

const isStarting = computed(() => assistantStore.sidecarStatus === 'starting');
const isStopping = computed(() => assistantStore.sidecarStatus === 'stopping');
const showStartButton = computed(() => 
  assistantStore.sidecarStatus === 'stopped' || assistantStore.sidecarStatus === 'error'
);
const showStopButton = computed(() => assistantStore.sidecarStatus === 'running');

async function handleStart() {
  await assistantStore.startSidecar();
}

async function handleStop() {
  await assistantStore.stopSidecar();
}

// Poll health while running
let healthInterval: number | null = null;

onMounted(() => {
  // Check initial status
  assistantStore.checkSidecarHealth();
  
  // Poll health every 5 seconds
  healthInterval = window.setInterval(() => {
    if (assistantStore.sidecarStatus === 'running') {
      assistantStore.checkSidecarHealth();
    }
  }, 5000);
});

onUnmounted(() => {
  if (healthInterval) {
    clearInterval(healthInterval);
  }
});
</script>

<style scoped>
.sidecar-status {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  background: var(--color-background-soft);
  border-radius: 6px;
}

.status-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--color-text-muted);
}

.status-running .status-dot {
  background: #10b981;
  animation: pulse 2s infinite;
}

.status-error .status-dot {
  background: #ef4444;
}

.status-transitioning .status-dot {
  background: #f59e0b;
  animation: blink 1s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}

.btn-start,
.btn-stop {
  padding: 6px 12px;
  border: none;
  border-radius: 4px;
  font-size: 13px;
  cursor: pointer;
  transition: background 0.2s;
}

.btn-start {
  background: #10b981;
  color: white;
}

.btn-start:hover:not(:disabled) {
  background: #059669;
}

.btn-stop {
  background: #ef4444;
  color: white;
}

.btn-stop:hover:not(:disabled) {
  background: #dc2626;
}

.btn-start:disabled,
.btn-stop:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
```

---

### 3. Integrate Status Component

**Option A: Add to Settings/AI Settings**

Edit `app/src/renderer/components/AISettingsModal.vue`:

```vue
<template>
  <div class="ai-settings">
    <!-- Existing content -->
    
    <!-- Add sidecar status section -->
    <section class="settings-section">
      <h3>Python Sidecar</h3>
      <SidecarStatus />
    </section>
    
    <!-- Rest of content -->
  </div>
</template>

<script setup lang="ts">
// Add import
import SidecarStatus from './assistant/SidecarStatus.vue';
// ... rest of script
</script>
```

**Option B: Add to ContextAssistant**

Edit `app/src/renderer/components/assistant/ContextAssistant.vue`:

Add the status indicator at the top:
```vue
<div class="assistant-header">
  <h2>AI Assistant</h2>
  <SidecarStatus />
</div>
```

---

### 4. Update Assistant Store to Use Sidecar IPC

**For Entity Generation**, replace calls to old AI service:

```typescript
// OLD
const result = await window.api.assistant.someOldMethod(params);

// NEW - using sidecar
async function generateWithSidecar(type: string, prompt: string) {
  const request = {
    entityType: type,
    userPrompt: prompt,
    config: {
      provider: 'ollama', // or from settings
      endpoint: 'http://localhost:11434',
      model: 'llama2',
      temperature: 0.7,
    },
  };
  
  const result = await window.api.invoke('sidecar:generate-entity', request);
  if (!result.success) {
    throw new Error(result.error);
  }
  return result.data;
}
```

**For Streaming**, add streaming support:

```typescript
async function streamAssistance(question: string) {
  const request = {
    question,
    conversationHistory: conversation.value.map(turn => ({
      role: turn.role,
      content: turn.content,
    })),
    config: {
      provider: 'ollama',
      endpoint: 'http://localhost:11434',
      model: 'llama2',
      temperature: 0.7,
    },
  };
  
  // Start stream
  const result = await window.api.invoke('sidecar:assist-stream', request);
  if (!result.success) {
    throw new Error(result.error);
  }
  
  const streamId = result.streamId;
  
  // Listen for stream events
  window.api.on('sidecar:stream-token', (event) => {
    if (event.streamId === streamId) {
      // Append token to conversation
      appendTokenToConversation(event.token);
    }
  });
  
  window.api.on('sidecar:stream-complete', (event) => {
    if (event.streamId === streamId) {
      // Finalize conversation
      finalizeConversation(event.fullContent);
    }
  });
  
  window.api.on('sidecar:stream-error', (event) => {
    if (event.streamId === streamId) {
      error.value = event.error;
    }
  });
  
  return streamId;
}
```

---

### 5. Update Preload Bridge

**File**: `app/preload/assistantBridge.ts` (or wherever IPC is exposed)

Add sidecar methods to the bridge:

```typescript
// Add to window.api
sidecar: {
  start: () => ipcRenderer.invoke('sidecar:start'),
  stop: () => ipcRenderer.invoke('sidecar:stop'),
  status: () => ipcRenderer.invoke('sidecar:status'),
  health: () => ipcRenderer.invoke('sidecar:health'),
  generateEntity: (request) => ipcRenderer.invoke('sidecar:generate-entity', request),
  assistStream: (request) => ipcRenderer.invoke('sidecar:assist-stream', request),
  cancelStream: (streamId) => ipcRenderer.invoke('sidecar:cancel-stream', streamId),
  executeTool: (request) => ipcRenderer.invoke('sidecar:execute-tool', request),
  ragQuery: (request) => ipcRenderer.invoke('sidecar:rag-query', request),
},
```

---

### 6. Initialize Sidecar Handlers in Main Process

**File**: `app/src/main/index.ts` (or main.ts)

Add initialization:

```typescript
import { initializeSidecarHandlers, cleanupSidecarHandlers } from './ipc/handlers/sidecar.handlers';

// On app ready
app.whenReady().then(() => {
  // Existing initialization...
  
  // Initialize sidecar handlers
  initializeSidecarHandlers();
  
  // Rest of initialization...
});

// Before quit
app.on('before-quit', async () => {
  await cleanupSidecarHandlers();
});
```

---

## Testing Checklist

### Manual Testing

1. **Start the Electron app**
   ```bash
   cd app
   npm run dev
   ```

2. **Check sidecar status component appears**
   - Should show "Stopped" initially
   - Start button should be visible

3. **Click "Start Sidecar"**
   - Status should change to "Starting"
   - Then "Running" with green indicator
   - Logs should show sidecar process starting

4. **Verify health polling**
   - Green dot should pulse
   - Status should update if sidecar becomes unhealthy

5. **Test entity generation** (if integrated)
   - Try generating a feature/spec/task
   - Should see request go to Python sidecar
   - Response should be validated and displayed

6. **Test streaming** (if integrated)
   - Ask a question to assistant
   - Should see tokens streaming in real-time
   - Completion should finalize the response

7. **Click "Stop Sidecar"**
   - Status should change to "Stopping"
   - Then "Stopped"
   - Python process should terminate

### Automated Testing

Create test file: `app/tests/integration/sidecar-integration.spec.ts`

```typescript
import { test, expect } from 'vitest';

test('sidecar lifecycle', async () => {
  // Test start/stop/health cycle
  const result = await window.api.invoke('sidecar:start');
  expect(result.success).toBe(true);
  
  const health = await window.api.invoke('sidecar:health');
  expect(health.healthy).toBe(true);
  
  await window.api.invoke('sidecar:stop');
  // Add assertions
});
```

---

## Troubleshooting

### Sidecar Won't Start

**Check**:
1. Python is in PATH: `python --version`
2. Context-kit-service dependencies installed
3. Port 8000 is not in use: `netstat -ano | findstr :8000`
4. Check console logs for errors

**Fix**:
```bash
cd context-kit-service
pnpm install  # or pip install -e .
pnpm start    # Test manually first
```

### IPC Methods Not Found

**Symptom**: "Method not defined" errors

**Fix**: Ensure sidecar handlers are initialized in main process:
- Check `initializeSidecarHandlers()` is called
- Verify imports are correct
- Restart Electron app

### Streaming Not Working

**Check**:
1. Stream event listeners are attached before calling
2. streamId is correctly matched in event handlers
3. Cleanup function is called on component unmount

---

## Estimated Time Breakdown

| Task | Time |
|------|------|
| Add sidecar state to store | 15 min |
| Create SidecarStatus component | 20 min |
| Integrate component into UI | 10 min |
| Update preload bridge | 10 min |
| Initialize handlers in main | 5 min |
| Manual testing | 20 min |
| Fix issues & polish | 20 min |
| **Total** | **~2 hours** |

---

## Success Criteria

✅ Sidecar status indicator visible in UI  
✅ Can start/stop sidecar from UI  
✅ Health indicator updates automatically  
✅ Can generate entities via sidecar  
✅ Streaming works in real-time  
✅ No errors in console  
✅ Graceful shutdown on app quit

---

## Next Steps After Completion

Once Phase 4 UI integration is complete:

1. **Test with real AI models** (Ollama or Azure OpenAI)
2. **Performance testing** - measure latency
3. **Error recovery testing** - what happens if sidecar crashes?
4. **User acceptance testing** - get feedback on UX

Then proceed to **Phase 5: Production Readiness**

---

**Phase 4 Status**: Infrastructure ✅ Complete | UI Integration ⏳ Guide Ready