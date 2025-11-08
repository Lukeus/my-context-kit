<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import { useEnterpriseStore } from '../stores/enterpriseStore';
import { useRouter } from 'vue-router';
import type { EnterpriseConfig } from '../../types/enterprise';

const enterpriseStore = useEnterpriseStore();
const router = useRouter();
const isSaving = ref(false);
const saveSuccess = ref(false);

const form = reactive<EnterpriseConfig>({
  gheOrg: '',
  enterpriseSpecsRepo: '',
  azureOpenAIEndpoint: '',
  azureOpenAIKey: '',
  azureOpenAIDeployment: '',
  ollamaEndpoint: '',
  defaultProvider: 'azure'
});

onMounted(async () => {
  await enterpriseStore.loadConfig();
  Object.assign(form, enterpriseStore.config);
});

async function handleSave() {
  isSaving.value = true;
  saveSuccess.value = false;
  try {
    await enterpriseStore.saveConfig(form);
    saveSuccess.value = true;
    setTimeout(() => {
      router.push('/enterprise');
    }, 1500);
  } catch (error) {
    console.error('Failed to save config:', error);
  } finally {
    isSaving.value = false;
  }
}

function handleCancel() {
  router.push('/enterprise');
}
</script>

<template>
  <div class="h-full overflow-auto bg-gradient-to-br from-surface via-surface-1 to-surface-2">
    <div class="max-w-4xl mx-auto px-8 py-6 space-y-6">
      <!-- Header -->
      <div class="flex items-center gap-4">
        <button
          type="button"
          class="p-2 rounded-m3-md hover:bg-surface-2 text-secondary-700 transition-colors"
          @click="handleCancel">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </button>
        <div>
          <h1 class="text-3xl font-bold text-secondary-900">Enterprise Settings</h1>
          <p class="text-sm text-secondary-600 mt-1">Configure GitHub Enterprise and AI provider settings</p>
        </div>
      </div>

      <!-- Success Message -->
      <div v-if="saveSuccess" class="rounded-m3-md border border-primary-200 bg-primary-50 px-6 py-4">
        <div class="flex items-center gap-3">
          <svg class="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p class="text-sm font-semibold text-primary-900">Settings saved successfully! Redirecting...</p>
        </div>
      </div>

      <!-- Form -->
      <form @submit.prevent="handleSave" class="space-y-6">
        <!-- GitHub Enterprise Section -->
        <section class="rounded-m3-md border border-surface-variant bg-surface shadow-elevation-2 overflow-hidden">
          <div class="px-6 py-4 bg-surface-2 border-b border-surface-variant">
            <h2 class="text-lg font-semibold text-secondary-900">GitHub Enterprise</h2>
            <p class="text-sm text-secondary-600 mt-1">Configure your GitHub Enterprise organization and specifications repository</p>
          </div>
          <div class="px-6 py-5 space-y-4">
            <div>
              <label for="gheOrg" class="block text-sm font-semibold text-secondary-900 mb-2">
                Organization Name
                <span class="text-error-600">*</span>
              </label>
              <input
                id="gheOrg"
                v-model="form.gheOrg"
                type="text"
                required
                placeholder="my-enterprise-org"
                class="w-full px-4 py-2.5 rounded-m3-md border border-surface-variant bg-surface-1 text-secondary-900 placeholder-secondary-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
              />
              <p class="text-xs text-secondary-600 mt-1.5">The GitHub organization containing your enterprise repositories</p>
            </div>

            <div>
              <label for="enterpriseSpecsRepo" class="block text-sm font-semibold text-secondary-900 mb-2">
                Specifications Repository
                <span class="text-error-600">*</span>
              </label>
              <input
                id="enterpriseSpecsRepo"
                v-model="form.enterpriseSpecsRepo"
                type="text"
                required
                placeholder="enterprise-specs"
                class="w-full px-4 py-2.5 rounded-m3-md border border-surface-variant bg-surface-1 text-secondary-900 placeholder-secondary-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
              />
              <p class="text-xs text-secondary-600 mt-1.5">Repository name containing global constitutions, prompts, and specifications</p>
            </div>
          </div>
        </section>

        <!-- Azure OpenAI Section -->
        <section class="rounded-m3-md border border-surface-variant bg-surface shadow-elevation-2 overflow-hidden">
          <div class="px-6 py-4 bg-surface-2 border-b border-surface-variant">
            <h2 class="text-lg font-semibold text-secondary-900">Azure OpenAI</h2>
            <p class="text-sm text-secondary-600 mt-1">Configure Azure OpenAI for spec derivation and AI operations</p>
          </div>
          <div class="px-6 py-5 space-y-4">
            <div>
              <label for="azureOpenAIEndpoint" class="block text-sm font-semibold text-secondary-900 mb-2">
                Endpoint URL
              </label>
              <input
                id="azureOpenAIEndpoint"
                v-model="form.azureOpenAIEndpoint"
                type="url"
                placeholder="https://your-resource.openai.azure.com"
                class="w-full px-4 py-2.5 rounded-m3-md border border-surface-variant bg-surface-1 text-secondary-900 placeholder-secondary-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
              />
            </div>

            <div>
              <label for="azureOpenAIKey" class="block text-sm font-semibold text-secondary-900 mb-2">
                API Key
              </label>
              <input
                id="azureOpenAIKey"
                v-model="form.azureOpenAIKey"
                type="password"
                placeholder="••••••••••••••••"
                class="w-full px-4 py-2.5 rounded-m3-md border border-surface-variant bg-surface-1 text-secondary-900 placeholder-secondary-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
              />
              <p class="text-xs text-secondary-600 mt-1.5">Your Azure OpenAI API key (stored securely)</p>
            </div>

            <div>
              <label for="azureOpenAIDeployment" class="block text-sm font-semibold text-secondary-900 mb-2">
                Deployment Name
              </label>
              <input
                id="azureOpenAIDeployment"
                v-model="form.azureOpenAIDeployment"
                type="text"
                placeholder="gpt-4"
                class="w-full px-4 py-2.5 rounded-m3-md border border-surface-variant bg-surface-1 text-secondary-900 placeholder-secondary-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
              />
            </div>
          </div>
        </section>

        <!-- Ollama Section -->
        <section class="rounded-m3-md border border-surface-variant bg-surface shadow-elevation-2 overflow-hidden">
          <div class="px-6 py-4 bg-surface-2 border-b border-surface-variant">
            <h2 class="text-lg font-semibold text-secondary-900">Ollama (Local)</h2>
            <p class="text-sm text-secondary-600 mt-1">Optional local AI provider for offline operations</p>
          </div>
          <div class="px-6 py-5 space-y-4">
            <div>
              <label for="ollamaEndpoint" class="block text-sm font-semibold text-secondary-900 mb-2">
                Endpoint URL
              </label>
              <input
                id="ollamaEndpoint"
                v-model="form.ollamaEndpoint"
                type="url"
                placeholder="http://localhost:11434"
                class="w-full px-4 py-2.5 rounded-m3-md border border-surface-variant bg-surface-1 text-secondary-900 placeholder-secondary-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
              />
            </div>
          </div>
        </section>

        <!-- AI Provider Selection -->
        <section class="rounded-m3-md border border-surface-variant bg-surface shadow-elevation-2 overflow-hidden">
          <div class="px-6 py-4 bg-surface-2 border-b border-surface-variant">
            <h2 class="text-lg font-semibold text-secondary-900">Default AI Provider</h2>
            <p class="text-sm text-secondary-600 mt-1">Select which AI provider to use by default</p>
          </div>
          <div class="px-6 py-5">
            <div class="flex gap-4">
              <label class="flex items-center gap-3 px-4 py-3 rounded-m3-md border-2 cursor-pointer transition-all"
                :class="form.defaultProvider === 'azure' ? 'border-primary-500 bg-primary-50' : 'border-surface-variant bg-surface-1 hover:border-surface-variant-hover'">
                <input
                  v-model="form.defaultProvider"
                  type="radio"
                  value="azure"
                  class="w-4 h-4 text-primary-600 focus:ring-primary-500"
                />
                <div>
                  <span class="text-sm font-semibold text-secondary-900">Azure OpenAI</span>
                  <p class="text-xs text-secondary-600">Cloud-based, enterprise-grade</p>
                </div>
              </label>

              <label class="flex items-center gap-3 px-4 py-3 rounded-m3-md border-2 cursor-pointer transition-all"
                :class="form.defaultProvider === 'ollama' ? 'border-primary-500 bg-primary-50' : 'border-surface-variant bg-surface-1 hover:border-surface-variant-hover'">
                <input
                  v-model="form.defaultProvider"
                  type="radio"
                  value="ollama"
                  class="w-4 h-4 text-primary-600 focus:ring-primary-500"
                />
                <div>
                  <span class="text-sm font-semibold text-secondary-900">Ollama</span>
                  <p class="text-xs text-secondary-600">Local, offline-capable</p>
                </div>
              </label>
            </div>
          </div>
        </section>

        <!-- Action Buttons -->
        <div class="flex items-center justify-end gap-3 pt-4">
          <button
            type="button"
            class="px-6 py-2.5 rounded-m3-md bg-surface-2 hover:bg-surface-3 text-secondary-900 font-semibold border border-surface-variant transition-all"
            @click="handleCancel">
            Cancel
          </button>
          <button
            type="submit"
            class="px-6 py-2.5 rounded-m3-md bg-primary-600 hover:bg-primary-700 active:bg-primary-800 text-white font-semibold shadow-elevation-2 hover:shadow-elevation-3 transition-all disabled:opacity-50"
            :disabled="isSaving || !form.gheOrg || !form.enterpriseSpecsRepo">
            {{ isSaving ? 'Saving...' : 'Save Configuration' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>
