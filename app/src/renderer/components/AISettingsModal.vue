<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useContextStore } from '../stores/contextStore';
import { useAIStore } from '../stores/aiStore';
import { DEFAULT_PROMPTS } from '../types/ai-prompts';
import type { AIPromptConfig } from '../types/ai-prompts';

const emit = defineEmits(['close']);
const contextStore = useContextStore();
const aiStore = useAIStore();

const activeTab = ref<'connection' | 'prompts'>('connection');

const provider = ref('ollama');
const endpoint = ref('http://localhost:11434');
const model = ref('llama2');
const apiKey = ref('');
const enabled = ref(false);
const hasStoredKey = ref(false);

const prompts = ref<AIPromptConfig>(JSON.parse(JSON.stringify(DEFAULT_PROMPTS)));

const isSaving = ref(false);
const isTesting = ref(false);
const statusMessage = ref('');
const statusType = ref<'success' | 'error' | ''>('');

onMounted(async () => {
  // Load existing config
  const result = await window.api.ai.getConfig(contextStore.repoPath);
  if (result.ok && result.config) {
    provider.value = result.config.provider || 'ollama';
    endpoint.value = result.config.endpoint || 'http://localhost:11434';
    model.value = result.config.model || 'llama2';
    enabled.value = result.config.enabled || false;
  }
  
  // Check if credentials exist
  const credResult = await window.api.ai.getCredentials(provider.value);
  hasStoredKey.value = credResult.hasCredentials || false;
  
  // Load prompts
  await aiStore.loadPrompts();
  prompts.value = JSON.parse(JSON.stringify(aiStore.prompts));
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
    const config = { provider: provider.value, endpoint: endpoint.value, model: model.value, enabled: enabled.value };
    const result = await window.api.ai.saveConfig(contextStore.repoPath, config);
    
    if (!result.ok) {
      statusMessage.value = result.error || 'Failed to save settings';
      statusType.value = 'error';
      return;
    }
    
    // Save prompts
    const promptResult = await aiStore.savePrompts(prompts.value);
    if (!promptResult.ok) {
      statusMessage.value = promptResult.error || 'Failed to save prompts';
      statusType.value = 'error';
      return;
    }
    
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
          @click="activeTab = 'connection'"
          class="px-4 py-3 text-sm font-medium transition-colors border-b-2"
          :class="activeTab === 'connection' ? 'text-primary-600 border-primary-600' : 'text-secondary-600 border-transparent hover:text-secondary-900'"
        >
          Connection
        </button>
        <button 
          @click="activeTab = 'prompts'"
          class="px-4 py-3 text-sm font-medium transition-colors border-b-2"
          :class="activeTab === 'prompts' ? 'text-primary-600 border-primary-600' : 'text-secondary-600 border-transparent hover:text-secondary-900'"
        >
          Prompts
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
            <label class="block text-sm font-medium text-secondary-800 mb-2">Model</label>
            <input 
              v-model="model" 
              type="text" 
              class="w-full px-4 py-3 bg-surface-2 border border-surface-variant rounded-m3-md text-secondary-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all shadow-elevation-1 hover:shadow-elevation-2"
              :placeholder="provider === 'ollama' ? 'llama2' : 'gpt-35-turbo'"
            />
            <p class="text-xs text-secondary-600 mt-2">
              <span v-if="provider === 'ollama'">Available models: llama2, mistral, codellama</span>
              <span v-else>Azure deployment name</span>
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

        <!-- Prompts Tab -->
        <div v-if="activeTab === 'prompts'" class="space-y-5">
          <div class="flex items-center justify-between mb-4">
            <p class="text-sm text-secondary-600">Customize the AI prompts and quick actions</p>
            <button 
              @click="resetPromptsToDefault"
              class="px-3 py-1.5 text-xs font-medium text-secondary-700 hover:text-secondary-900 bg-surface-2 hover:bg-surface-3 rounded-m3-md transition-all"
            >
              Reset to Defaults
            </button>
          </div>

          <!-- System Prompts -->
          <div>
            <label class="block text-sm font-medium text-secondary-800 mb-2">General System Prompt</label>
            <textarea 
              v-model="prompts.systemPrompts.general"
              rows="3"
              class="w-full px-4 py-3 bg-surface-2 border border-surface-variant rounded-m3-md text-secondary-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all shadow-elevation-1 hover:shadow-elevation-2 resize-none"
              placeholder="General system prompt for AI assistance"
            ></textarea>
          </div>

          <div>
            <label class="block text-sm font-medium text-secondary-800 mb-2">Improvement Mode Prompt</label>
            <textarea 
              v-model="prompts.systemPrompts.improvement"
              rows="3"
              class="w-full px-4 py-3 bg-surface-2 border border-surface-variant rounded-m3-md text-secondary-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all shadow-elevation-1 hover:shadow-elevation-2 resize-none"
              placeholder="System prompt for improvement suggestions"
            ></textarea>
          </div>

          <div>
            <label class="block text-sm font-medium text-secondary-800 mb-2">Clarification Mode Prompt</label>
            <textarea 
              v-model="prompts.systemPrompts.clarification"
              rows="3"
              class="w-full px-4 py-3 bg-surface-2 border border-surface-variant rounded-m3-md text-secondary-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all shadow-elevation-1 hover:shadow-elevation-2 resize-none"
              placeholder="System prompt for clarifying questions"
            ></textarea>
          </div>

          <!-- Quick Prompts -->
          <div>
            <label class="block text-sm font-medium text-secondary-800 mb-2">Quick Action Prompts</label>
            <p class="text-xs text-secondary-600 mb-3">Use {entityId} as a placeholder for the current entity ID</p>
            
            <div class="space-y-3">
              <div>
                <label class="block text-xs font-medium text-secondary-700 mb-1">Summarize</label>
                <input 
                  v-model="prompts.quickPrompts.summarize"
                  type="text"
                  class="w-full px-3 py-2 bg-surface-2 border border-surface-variant rounded-m3-md text-secondary-900 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                  placeholder="Summarize {entityId}"
                />
              </div>
              
              <div>
                <label class="block text-xs font-medium text-secondary-700 mb-1">Improve</label>
                <input 
                  v-model="prompts.quickPrompts.improve"
                  type="text"
                  class="w-full px-3 py-2 bg-surface-2 border border-surface-variant rounded-m3-md text-secondary-900 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                  placeholder="Suggest improvements for {entityId}"
                />
              </div>
              
              <div>
                <label class="block text-xs font-medium text-secondary-700 mb-1">Clarify</label>
                <input 
                  v-model="prompts.quickPrompts.clarify"
                  type="text"
                  class="w-full px-3 py-2 bg-surface-2 border border-surface-variant rounded-m3-md text-secondary-900 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                  placeholder="Clarify {entityId}"
                />
              </div>
            </div>
          </div>

          <!-- Example Questions -->
          <div>
            <label class="block text-sm font-medium text-secondary-800 mb-2">Example Questions</label>
            <p class="text-xs text-secondary-600 mb-3">Questions displayed to guide users</p>
            
            <div class="space-y-2">
              <div v-for="(question, index) in prompts.exampleQuestions" :key="index" class="flex gap-2">
                <input 
                  v-model="prompts.exampleQuestions[index]"
                  type="text"
                  class="flex-1 px-3 py-2 bg-surface-2 border border-surface-variant rounded-m3-md text-secondary-900 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                  :placeholder="`Example question ${index + 1}`"
                />
                <button 
                  @click="removeExampleQuestion(index)"
                  class="px-3 py-2 text-error-600 hover:text-error-700 hover:bg-error-50 rounded-m3-md transition-all"
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <button 
                @click="addExampleQuestion"
                class="w-full px-3 py-2 text-sm font-medium text-primary-600 hover:text-primary-700 bg-primary-50 hover:bg-primary-100 rounded-m3-md transition-all"
              >
                + Add Question
              </button>
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
      <div class="px-6 py-5 border-t border-surface-variant flex items-center justify-end gap-3">
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
    </div>
  </div>
</template>
