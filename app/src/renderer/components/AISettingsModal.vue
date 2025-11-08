<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useContextStore } from '../stores/contextStore';
import { useLangChainStore } from '../stores/langchainStore';
import { useRAGStore } from '../stores/ragStore';
import { useAssistantStore } from '../stores/assistantStore';
import { DEFAULT_PROMPTS } from '../types/ai-prompts';
import type { AIPromptConfig } from '../types/ai-prompts';
import LangChainSettings from './LangChainSettings.vue';
import RAGSettingsPanel from './rag/RAGSettingsPanel.vue';
import SidecarStatus from './assistant/SidecarStatus.vue';

const emit = defineEmits(['close']);
const contextStore = useContextStore();
const langchainStore = useLangChainStore();
const ragStore = useRAGStore();
const assistantStore = useAssistantStore();

const activeTab = ref<'connection' | 'sidecar'>('sidecar'); // Default to sidecar tab

const provider = ref('ollama');
const endpoint = ref('http://localhost:11434');
const model = ref('llama2');
const embeddingModel = ref('text-embedding-3-small');
const apiKey = ref('');
const enabled = ref(false);
const hasStoredKey = ref(false);

const prompts = ref<AIPromptConfig>(JSON.parse(JSON.stringify(DEFAULT_PROMPTS)));

const isSaving = ref(false);
const isTesting = ref(false);
const statusMessage = ref('');
const statusType = ref<'success' | 'error' | ''>('');

// Sidecar configuration
const sidecarProvider = ref('ollama');
const sidecarEndpoint = ref('http://localhost:11434');
const sidecarModel = ref('llama2');
const sidecarApiKey = ref('');
const sidecarHasStoredKey = ref(false);
const isSavingSidecar = ref(false);
const sidecarConfigChanged = computed(() => true); // For now, always show save button
const showRestartDialog = ref(false);
const pendingSaveConfig = ref<any>(null);

onMounted(async () => {
  // Load existing Legacy AI config
  const result = await window.api.ai.getConfig(contextStore.repoPath);
  if (result.ok && result.config) {
    provider.value = result.config.provider || 'ollama';
    endpoint.value = result.config.endpoint || 'http://localhost:11434';
    model.value = result.config.model || 'llama2';
    embeddingModel.value = result.config.embeddingModel || 'text-embedding-3-small';
    enabled.value = result.config.enabled || false;
  }
  
  // Check if credentials exist for Legacy AI
  const credResult = await window.api.ai.getCredentials(provider.value);
  hasStoredKey.value = credResult.hasCredentials || false;
  
  // Load sidecar config (separate from Legacy AI)
  await loadSidecarConfig();
  
  // Load prompts from context file if exists
  // TODO: Implement prompts loading from context repository
  prompts.value = JSON.parse(JSON.stringify(DEFAULT_PROMPTS));
});

async function testConnection() {
  isTesting.value = true;
  statusMessage.value = '';
  
  try {
    const result = await window.api.ai.testConnection(
      contextStore.repoPath,
      provider.value,
      endpoint.value,
      model.value,
      hasStoredKey.value
    );
    
    statusMessage.value = result.message || result.error || 'Test completed';
    statusType.value = result.ok ? 'success' : 'error';
  } catch (error) {
    statusMessage.value = 'Connection test failed';
    statusType.value = 'error';
  } finally {
    isTesting.value = false;
  }
}

async function saveSettings() {
  isSaving.value = true;
  statusMessage.value = '';
  
  try {
    // Save API key separately if provided
    if (apiKey.value && provider.value === 'azure-openai') {
      const keyResult = await window.api.ai.saveCredentials(provider.value, apiKey.value);
      if (!keyResult.ok) {
        statusMessage.value = keyResult.error || 'Failed to save API key';
        statusType.value = 'error';
        return;
      }
      hasStoredKey.value = true;
    }
    
    // Save configuration (without API key)
    const config = { 
      provider: provider.value, 
      endpoint: endpoint.value, 
      model: model.value, 
      embeddingModel: embeddingModel.value,
      enabled: enabled.value 
    };
    const result = await window.api.ai.saveConfig(contextStore.repoPath, config);
    
    if (!result.ok) {
      statusMessage.value = result.error || 'Failed to save settings';
      statusType.value = 'error';
      return;
    }
    
    // Save prompts
    // TODO: Implement prompts saving to context repository
    // For now, prompts are stored with AI configuration
    
    statusMessage.value = 'Settings saved successfully';
    statusType.value = 'success';
    apiKey.value = ''; // Clear the input
    setTimeout(() => emit('close'), 1500);
  } catch (error) {
    statusMessage.value = 'Failed to save settings';
    statusType.value = 'error';
  } finally {
    isSaving.value = false;
  }
}

function resetPromptsToDefault() {
  prompts.value = JSON.parse(JSON.stringify(DEFAULT_PROMPTS));
  statusMessage.value = 'Prompts reset to defaults (not saved yet)';
  statusType.value = 'success';
  setTimeout(() => {
    statusMessage.value = '';
  }, 3000);
}

function addExampleQuestion() {
  prompts.value.exampleQuestions.push('');
}

function removeExampleQuestion(index: number) {
  prompts.value.exampleQuestions.splice(index, 1);
}

// Sidecar configuration functions
async function loadSidecarConfig() {
  try {
    const configPath = await window.api.app.getDefaultRepoPath().then(r => r.path);
    const result = await window.api.fs.readFile(`${configPath}/.context-kit/sidecar-config.json`);
    
    if (result.ok && result.content) {
      const config = JSON.parse(result.content);
      sidecarProvider.value = config.provider || 'ollama';
      sidecarEndpoint.value = config.endpoint || 'http://localhost:11434';
      sidecarModel.value = config.model || 'llama2';
      
      // Check if API key exists for this provider
      if (config.provider === 'azure-openai') {
        const credResult = await window.api.ai.getCredentials('sidecar-' + config.provider);
        sidecarHasStoredKey.value = credResult.hasCredentials || false;
      }
    }
  } catch (error) {
    // Config doesn't exist yet, use defaults
    sidecarProvider.value = 'ollama';
    sidecarEndpoint.value = 'http://localhost:11434';
    sidecarModel.value = 'llama2';
  }
}

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

async function performSaveConfig(withRestart: boolean) {
  isSavingSidecar.value = true;
  statusMessage.value = '';
  showRestartDialog.value = false;
  
  try {
    // Validate config
    const validation = validateSidecarConfig();
    if (!validation.valid) {
      statusMessage.value = validation.error || 'Invalid configuration';
      statusType.value = 'error';
      return;
    }
    
    // Save API key separately if provided
    if (sidecarApiKey.value && sidecarProvider.value === 'azure-openai') {
      const keyResult = await window.api.ai.saveCredentials(
        'sidecar-' + sidecarProvider.value, 
        sidecarApiKey.value
      );
      if (!keyResult.ok) {
        statusMessage.value = keyResult.error || 'Failed to save API key';
        statusType.value = 'error';
        return;
      }
      sidecarHasStoredKey.value = true;
      sidecarApiKey.value = ''; // Clear input
    }
    
    // Save configuration
    const config = {
      provider: sidecarProvider.value,
      endpoint: sidecarEndpoint.value,
      model: sidecarModel.value,
    };
    
    const configPath = await window.api.app.getDefaultRepoPath().then(r => r.path);
    const writeResult = await window.api.fs.writeFile(
      `${configPath}/.context-kit/sidecar-config.json`,
      JSON.stringify(config, null, 2)
    );
    
    if (!writeResult.ok) {
      statusMessage.value = writeResult.error || 'Failed to save sidecar config';
      statusType.value = 'error';
      return;
    }
    
    // If user confirmed restart, do it now
    if (withRestart) {
      statusMessage.value = '✅ Configuration saved! Restarting sidecar...';
      statusType.value = 'success';
      
      try {
        await assistantStore.stopSidecar();
        // Wait a moment for clean shutdown
        await new Promise(resolve => setTimeout(resolve, 1000));
        await assistantStore.startSidecar();
        
        statusMessage.value = '✅ Sidecar restarted successfully with new configuration!';
      } catch (err) {
        statusMessage.value = '⚠️ Config saved but restart failed. Please restart manually.';
        statusType.value = 'error';
      }
    } else {
      statusMessage.value = '✅ Sidecar configuration saved!';
      statusType.value = 'success';
    }
    
    setTimeout(() => {
      statusMessage.value = '';
    }, 5000);
  } catch (error) {
    statusMessage.value = 'Failed to save sidecar configuration';
    statusType.value = 'error';
  } finally {
    isSavingSidecar.value = false;
    pendingSaveConfig.value = null;
  }
}

function cancelRestart() {
  showRestartDialog.value = false;
  pendingSaveConfig.value = null;
}

function validateSidecarConfig() {
  // Validate endpoint URL
  try {
    new URL(sidecarEndpoint.value);
  } catch {
    return { valid: false, error: 'Invalid endpoint URL' };
  }
  
  // Validate model name
  if (!sidecarModel.value.trim()) {
    return { valid: false, error: 'Model name is required' };
  }
  
  // Check API key for Azure
  if (sidecarProvider.value === 'azure-openai' && !sidecarHasStoredKey.value && !sidecarApiKey.value) {
    return { valid: false, error: 'API key is required for Azure OpenAI' };
  }
  
  return { valid: true };
}
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
    <div class="bg-surface-1 rounded-m3-xl shadow-elevation-5 w-full max-w-2xl max-h-[90vh] flex flex-col border border-surface-variant">
      <!-- Header -->
      <div class="px-6 py-5 border-b border-surface-variant flex items-center justify-between">
        <h2 class="text-xl font-semibold text-secondary-900">⚙️ AI Settings</h2>
        <button @click="emit('close')" class="text-secondary-500 hover:text-secondary-900 transition-colors p-1 rounded-m3-md hover:bg-surface-3">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <!-- Tabs -->
      <div class="flex border-b border-surface-variant px-6">
        <button 
          @click="activeTab = 'sidecar'"
          class="px-4 py-3 text-sm font-medium transition-colors border-b-2 flex items-center gap-2"
          :class="activeTab === 'sidecar' ? 'text-primary-600 border-primary-600' : 'text-secondary-600 border-transparent hover:text-secondary-900'"
        >
          <span>🐍 Sidecar</span>
          <span v-if="assistantStore.isSidecarRunning" class="px-1.5 py-0.5 text-[10px] font-bold bg-green-100 text-green-800 rounded-m3-full">ON</span>
        </button>
        <button 
          @click="activeTab = 'connection'"
          class="px-4 py-3 text-sm font-medium transition-colors border-b-2"
          :class="activeTab === 'connection' ? 'text-primary-600 border-primary-600' : 'text-secondary-600 border-transparent hover:text-secondary-900'"
        >
          Legacy AI (Old)
        </button>
      </div>

      <!-- Content -->
      <div class="flex-1 overflow-y-auto px-6 py-6 space-y-5">
        <!-- Connection Tab -->
        <div v-if="activeTab === 'connection'" class="space-y-5">
          <!-- Enable AI -->
          <label class="flex items-center text-sm text-secondary-700 cursor-pointer hover:text-secondary-900 transition-colors">
            <input type="checkbox" v-model="enabled" class="mr-3 h-5 w-5 rounded-m3-md bg-surface-3 border-surface-variant text-primary-600 focus:ring-2 focus:ring-primary-400" />
            <span class="font-medium">Enable AI Assistance</span>
          </label>

          <!-- Provider -->
          <div>
            <label class="block text-sm font-medium text-secondary-800 mb-2">Provider</label>
            <select v-model="provider" class="w-full px-4 py-3 bg-surface-2 border border-surface-variant rounded-m3-md text-secondary-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all shadow-elevation-1 hover:shadow-elevation-2">
              <option value="ollama">Ollama (Local)</option>
              <option value="azure-openai">Azure OpenAI</option>
            </select>
          </div>

          <!-- Endpoint -->
          <div>
            <label class="block text-sm font-medium text-secondary-800 mb-2">Endpoint URL</label>
            <input 
              v-model="endpoint" 
              type="text" 
              class="w-full px-4 py-3 bg-surface-2 border border-surface-variant rounded-m3-md text-secondary-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all shadow-elevation-1 hover:shadow-elevation-2"
              placeholder="http://localhost:11434"
            />
            <p class="text-xs text-secondary-600 mt-2">
              <span v-if="provider === 'ollama'">Ollama default: http://localhost:11434</span>
              <span v-else>Azure: https://your-resource.openai.azure.com</span>
            </p>
          </div>

          <!-- Model -->
          <div>
            <label class="block text-sm font-medium text-secondary-800 mb-2">Chat Model</label>
            <input 
              v-model="model" 
              type="text" 
              class="w-full px-4 py-3 bg-surface-2 border border-surface-variant rounded-m3-md text-secondary-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all shadow-elevation-1 hover:shadow-elevation-2"
              :placeholder="provider === 'ollama' ? 'llama2' : 'gpt-35-turbo'"
            />
            <p class="text-xs text-secondary-600 mt-2">
              <span v-if="provider === 'ollama'">Available models: llama2, mistral, codellama</span>
              <span v-else>Azure deployment name for chat completions</span>
            </p>
          </div>

          <!-- Embedding Model (Azure only) -->
          <div v-if="provider === 'azure-openai'">
            <label class="block text-sm font-medium text-secondary-800 mb-2">
              Embedding Model
              <span class="text-xs text-secondary-600 font-normal ml-2">(for semantic search)</span>
            </label>
            <input 
              v-model="embeddingModel" 
              type="text" 
              class="w-full px-4 py-3 bg-surface-2 border border-surface-variant rounded-m3-md text-secondary-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all shadow-elevation-1 hover:shadow-elevation-2"
              placeholder="text-embedding-3-small"
            />
            <p class="text-xs text-secondary-600 mt-2">
              Azure deployment name for embeddings (e.g., text-embedding-3-small, text-embedding-ada-002)
            </p>
          </div>

          <!-- API Key (Azure only) -->
          <div v-if="provider === 'azure-openai'">
            <label class="block text-sm font-medium text-secondary-800 mb-2">API Key</label>
            <input 
              v-model="apiKey" 
              type="password" 
              class="w-full px-4 py-3 bg-surface-2 border border-surface-variant rounded-m3-md text-secondary-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all shadow-elevation-1 hover:shadow-elevation-2"
              placeholder="Enter API key (stored securely)"
            />
            <p class="text-xs text-green-700 font-medium mt-2" v-if="hasStoredKey">
              ✓ API key is securely stored
            </p>
            <p class="text-xs text-secondary-600 mt-2">
              Keys are encrypted with OS-level security (Windows Credential Manager)
            </p>
          </div>
        </div>

        <!-- Sidecar Tab -->
        <div v-if="activeTab === 'sidecar'" class="space-y-5">
          <div>
            <h3 class="text-lg font-semibold text-secondary-900 mb-2">🐍 Python Sidecar</h3>
            <p class="text-sm text-secondary-600">
              Configure and control the Python sidecar service for AI functionality.
            </p>
          </div>
          
          <!-- Sidecar Status Component -->
          <SidecarStatus />
          
          <!-- Configuration Section -->
          <div class="border-t border-surface-variant pt-5 space-y-5">
            <h4 class="text-base font-semibold text-secondary-900">Sidecar Configuration</h4>
            
            <!-- Provider -->
            <div>
              <label class="block text-sm font-medium text-secondary-800 mb-2">Provider</label>
              <select v-model="sidecarProvider" class="w-full px-4 py-3 bg-surface-2 border border-surface-variant rounded-m3-md text-secondary-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all shadow-elevation-1 hover:shadow-elevation-2">
                <option value="ollama">Ollama (Local)</option>
                <option value="azure-openai">Azure OpenAI</option>
              </select>
            </div>
            
            <!-- Endpoint -->
            <div>
              <label class="block text-sm font-medium text-secondary-800 mb-2">Endpoint</label>
              <input 
                v-model="sidecarEndpoint" 
                type="text" 
                class="w-full px-4 py-3 bg-surface-2 border border-surface-variant rounded-m3-md text-secondary-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all shadow-elevation-1 hover:shadow-elevation-2"
                :placeholder="sidecarProvider === 'ollama' ? 'http://localhost:11434' : 'https://your-resource.openai.azure.com'"
              />
              <p class="text-xs text-secondary-600 mt-2">
                <span v-if="sidecarProvider === 'ollama'">Ollama API endpoint (default: http://localhost:11434)</span>
                <span v-else>Azure OpenAI resource endpoint</span>
              </p>
            </div>
            
            <!-- Model -->
            <div>
              <label class="block text-sm font-medium text-secondary-800 mb-2">Model</label>
              <input 
                v-model="sidecarModel" 
                type="text" 
                class="w-full px-4 py-3 bg-surface-2 border border-surface-variant rounded-m3-md text-secondary-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all shadow-elevation-1 hover:shadow-elevation-2"
                :placeholder="sidecarProvider === 'ollama' ? 'llama2' : 'gpt-35-turbo'"
              />
              <p class="text-xs text-secondary-600 mt-2">
                <span v-if="sidecarProvider === 'ollama'">Model name (e.g., llama2, mistral, codellama)</span>
                <span v-else>Azure deployment name for chat</span>
              </p>
            </div>
            
            <!-- API Key (Azure only) -->
            <div v-if="sidecarProvider === 'azure-openai'">
              <label class="block text-sm font-medium text-secondary-800 mb-2">API Key</label>
              <input 
                v-model="sidecarApiKey" 
                type="password" 
                class="w-full px-4 py-3 bg-surface-2 border border-surface-variant rounded-m3-md text-secondary-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all shadow-elevation-1 hover:shadow-elevation-2"
                placeholder="Enter API key (stored securely)"
              />
              <p class="text-xs text-green-700 font-medium mt-2" v-if="sidecarHasStoredKey">
                ✓ API key is securely stored
              </p>
              <p class="text-xs text-secondary-600 mt-2">
                Keys are encrypted with OS-level security
              </p>
            </div>
            
            <!-- Save Button -->
            <div class="flex items-center gap-3">
              <button 
                @click="saveSidecarConfig"
                :disabled="isSavingSidecar"
                class="px-5 py-2.5 text-sm font-medium bg-primary-600 hover:bg-primary-700 active:bg-primary-800 disabled:bg-surface-3 disabled:text-secondary-400 text-white rounded-m3-md transition-all shadow-elevation-2 hover:shadow-elevation-3"
              >
                {{ isSavingSidecar ? 'Saving...' : 'Save Configuration' }}
              </button>
              <p class="text-xs text-secondary-600" v-if="assistantStore.isSidecarRunning">
                🔄 Sidecar will be restarted to apply changes
              </p>
            </div>
          </div>
        </div>

        <!-- Status Message -->
        <div v-if="statusMessage" class="p-4 rounded-m3-md shadow-elevation-1" :class="{
          'bg-green-50 border border-green-200': statusType === 'success',
          'bg-error-50 border border-error-200': statusType === 'error'
        }">
          <p class="text-sm font-medium" :class="{
            'text-green-800': statusType === 'success',
            'text-error-700': statusType === 'error'
          }">{{ statusMessage }}</p>
        </div>
      </div>

      <!-- Footer -->
      <div v-if="activeTab === 'connection'" class="px-6 py-5 border-t border-surface-variant flex items-center justify-end gap-3">
        <button 
          @click="testConnection"
          :disabled="isTesting || !enabled"
          class="px-5 py-2.5 text-sm font-medium bg-secondary-200 hover:bg-secondary-300 active:bg-secondary-400 disabled:bg-surface-3 disabled:text-secondary-400 text-secondary-900 rounded-m3-md transition-all shadow-elevation-1 hover:shadow-elevation-2"
        >
          {{ isTesting ? 'Testing...' : 'Test Connection' }}
        </button>
        <button 
          @click="emit('close')"
          class="px-5 py-2.5 text-sm font-medium text-secondary-700 hover:text-secondary-900 hover:bg-surface-3 rounded-m3-md transition-all"
        >
          Cancel
        </button>
        <button 
          @click="saveSettings"
          :disabled="isSaving"
          class="px-5 py-2.5 text-sm font-medium bg-primary-600 hover:bg-primary-700 active:bg-primary-800 disabled:bg-surface-3 disabled:text-secondary-400 text-white rounded-m3-md transition-all shadow-elevation-2 hover:shadow-elevation-3"
        >
          {{ isSaving ? 'Saving...' : 'Save Settings' }}
        </button>
      </div>
      <div v-else class="px-6 py-5 border-t border-surface-variant flex items-center justify-end">
        <button 
          @click="emit('close')"
          class="px-5 py-2.5 text-sm font-medium bg-primary-600 hover:bg-primary-700 text-white rounded-m3-md transition-all shadow-elevation-2 hover:shadow-elevation-3"
        >
          Close
        </button>
      </div>
    </div>
    
    <!-- Restart Confirmation Dialog -->
    <div v-if="showRestartDialog" class="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div class="bg-surface-1 rounded-m3-xl shadow-elevation-5 w-full max-w-md border border-surface-variant p-6">
        <h3 class="text-lg font-semibold text-secondary-900 mb-3">🔄 Restart Sidecar?</h3>
        <p class="text-sm text-secondary-700 mb-5">
          The sidecar is currently running. Do you want to restart it now to apply the new configuration?
        </p>
        <div class="bg-blue-50 border border-blue-200 rounded-m3-md p-3 mb-5">
          <p class="text-xs text-blue-800">
            💡 <strong>Tip:</strong> The restart will stop the current sidecar, save your changes, and start it again with the new settings. This takes about 2-3 seconds.
          </p>
        </div>
        <div class="flex items-center justify-end gap-3">
          <button 
            @click="cancelRestart"
            class="px-4 py-2 text-sm font-medium text-secondary-700 hover:text-secondary-900 hover:bg-surface-3 rounded-m3-md transition-all"
          >
            Cancel
          </button>
          <button 
            @click="performSaveConfig(false)"
            class="px-4 py-2 text-sm font-medium bg-secondary-200 hover:bg-secondary-300 text-secondary-900 rounded-m3-md transition-all shadow-elevation-1 hover:shadow-elevation-2"
          >
            Save Without Restart
          </button>
          <button 
            @click="performSaveConfig(true)"
            class="px-4 py-2 text-sm font-medium bg-primary-600 hover:bg-primary-700 text-white rounded-m3-md transition-all shadow-elevation-2 hover:shadow-elevation-3"
          >
            Save & Restart
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
