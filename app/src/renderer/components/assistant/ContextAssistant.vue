<script setup lang="ts">
import { computed, ref } from 'vue';
import { storeToRefs } from 'pinia';
import { useAssistantStore } from '@/stores/assistantStore';
import { useContextStore } from '@/stores/contextStore';
import { useAgentStore } from '@/stores/agentStore';
import AgentSelector from './AgentSelector.vue';

const assistantStore = useAssistantStore();
const contextStore = useContextStore();
const agentStore = useAgentStore();

const { conversation, isBusy, session, healthStatus, isHealthy, isDegraded, isUnhealthy, healthMessage, health } = storeToRefs(assistantStore);
const { selectedAgent } = storeToRefs(agentStore);

const messageInput = ref('');
const showTools = ref(false);

const repoName = computed(() => {
  if (!contextStore.repoPath) return 'No repository';
  const parts = contextStore.repoPath.split(/[/\\]/);
  return parts[parts.length - 1] || 'Repository';
});

const hasMessages = computed(() => conversation.value.length > 0);

const showHealthBanner = computed(() => isDegraded.value || isUnhealthy.value);
const healthBannerClass = computed(() => {
  if (isUnhealthy.value) return 'bg-error-50 border-error-200 text-error-700';
  if (isDegraded.value) return 'bg-orange-50 border-orange-200 text-orange-700';
  return 'bg-surface-100 border-surface-variant text-secondary-700';
});
const healthIconClass = computed(() => {
  if (isUnhealthy.value) return 'text-error-600';
  if (isDegraded.value) return 'text-orange-600';
  return 'text-secondary-600';
});
const healthStatusText = computed(() => {
  const latency = health.value?.latencyMs;
  const latencyStr = latency != null ? ` (${Math.round(latency)}ms)` : '';
  return `${healthStatus.value}${latencyStr}`;
});

function retryHealthCheck() {
  assistantStore.retryHealth();
}

async function sendMessage() {
  if (!messageInput.value.trim() || isBusy.value) return;

  const content = messageInput.value.trim();
  messageInput.value = '';

  try {
    await assistantStore.sendMessage({ content });
  } catch (error) {
    console.error('Failed to send message:', error);
  }
}

function handleKeyDown(event: KeyboardEvent) {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    sendMessage();
  }
}
</script>

<template>
  <div class="flex flex-col h-full bg-white">
    <!-- Simplified Header -->
    <header class="flex items-center justify-between px-4 py-2 border-b border-surface-variant bg-surface-1">
      <div class="flex items-center gap-3 flex-1 min-w-0">
        <!-- Agent Selector (Prominent) -->
        <div class="flex-1 max-w-sm">
          <AgentSelector />
        </div>
        
        <!-- Repository Context -->
        <div class="flex items-center gap-2 text-xs text-secondary-600">
          <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M2 6a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1H8a3 3 0 00-3 3v1.5a1.5 1.5 0 01-3 0V6z" clip-rule="evenodd" />
            <path d="M6 12a2 2 0 012-2h8a2 2 0 012 2v2a2 2 0 01-2 2H2h2a2 2 0 002-2v-2z" />
          </svg>
          <span class="truncate max-w-[200px]">{{ repoName }}</span>
        </div>
      </div>

      <!-- Tools Toggle -->
      <button
        class="p-2 rounded-m3-md hover:bg-surface-2 transition-colors"
        :class="{ 'bg-primary-100 text-primary-700': showTools }"
        @click="showTools = !showTools"
        title="Toggle tools"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      </button>
    </header>

    <!-- Health Status Banner (T017) -->
    <Transition name="slide-down">
      <div v-if="showHealthBanner" class="px-4 py-3 border-b flex items-center gap-3" :class="healthBannerClass">
        <svg class="w-5 h-5 flex-shrink-0" :class="healthIconClass" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
        </svg>
        <div class="flex-1 min-w-0">
          <div class="text-sm font-medium">Service Status: {{ healthStatusText }}</div>
          <div v-if="healthMessage" class="text-xs mt-1 opacity-90">{{ healthMessage }}</div>
        </div>
        <button
          class="px-3 py-1.5 text-xs font-medium rounded-m3-md transition-colors"
          :class="isUnhealthy.value ? 'bg-error-600 text-white hover:bg-error-700' : 'bg-orange-600 text-white hover:bg-orange-700'"
          @click="retryHealthCheck"
          title="Retry health check"
        >
          Retry
        </button>
      </div>
    </Transition>

    <!-- Main Content Area -->
    <div class="flex-1 flex overflow-hidden">
      <!-- Chat Panel (Primary) -->
      <div class="flex-1 flex flex-col">
        <!-- Conversation -->
        <div class="flex-1 overflow-y-auto p-4 space-y-4">
          <!-- Empty State -->
          <div v-if="!hasMessages" class="flex flex-col items-center justify-center h-full text-center px-4">
            <div class="w-16 h-16 rounded-m3-md-full bg-primary-100 flex items-center justify-center mb-4">
              <span class="text-3xl">{{ selectedAgent?.metadata.icon || '🤖' }}</span>
            </div>
            <h3 class="text-lg font-semibold text-secondary-900 mb-2">
              {{ selectedAgent?.metadata.name || 'Context Assistant' }}
            </h3>
            <p class="text-sm text-secondary-600 max-w-md mb-4">
              {{ selectedAgent?.metadata.description || 'Ask me anything about your repository.' }}
            </p>
            <div class="text-xs text-secondary-500 space-y-1">
              <p>Try asking:</p>
              <p class="font-mono text-secondary-700">"What's in this repository?"</p>
              <p class="font-mono text-secondary-700">"Show me the main features"</p>
            </div>
          </div>

          <!-- Messages -->
          <div v-else class="space-y-4">
            <div
              v-for="(message, index) in conversation"
              :key="index"
              class="flex gap-3"
              :class="message.role === 'user' ? 'justify-end' : 'justify-start'"
            >
              <!-- Assistant Avatar -->
              <div
                v-if="message.role === 'assistant'"
                class="w-8 h-8 rounded-m3-md-full bg-primary-100 flex items-center justify-center flex-shrink-0 text-lg"
              >
                {{ selectedAgent?.metadata.icon || '🤖' }}
              </div>

              <!-- Message Bubble -->
              <div
                class="max-w-[70%] rounded-m3-md px-4 py-2"
                :class="message.role === 'user'
                  ? 'bg-primary-600 text-white'
                  : 'bg-surface-1 text-secondary-900 border border-surface-variant'"
              >
                <div class="text-sm whitespace-pre-wrap">{{ message.content }}</div>
                <div
                  class="text-[10px] mt-1"
                  :class="message.role === 'user' ? 'text-primary-100' : 'text-secondary-500'"
                >
                  {{ new Date(message.timestamp).toLocaleTimeString() }}
                </div>
              </div>

              <!-- User Avatar -->
              <div
                v-if="message.role === 'user'"
                class="w-8 h-8 rounded-m3-md-full bg-secondary-200 flex items-center justify-center flex-shrink-0"
              >
                <svg class="w-4 h-4 text-secondary-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clip-rule="evenodd" />
                </svg>
              </div>
            </div>

            <!-- Typing Indicator -->
            <div v-if="isBusy" class="flex gap-3">
              <div class="w-8 h-8 rounded-m3-md-full bg-primary-100 flex items-center justify-center flex-shrink-0 text-lg">
                {{ selectedAgent?.metadata.icon || '🤖' }}
              </div>
              <div class="bg-surface-1 rounded-m3-md px-4 py-3 border border-surface-variant">
                <div class="flex gap-1">
                  <div class="w-2 h-2 bg-secondary-400 rounded-m3-md-full animate-bounce" style="animation-delay: 0ms"></div>
                  <div class="w-2 h-2 bg-secondary-400 rounded-m3-md-full animate-bounce" style="animation-delay: 150ms"></div>
                  <div class="w-2 h-2 bg-secondary-400 rounded-m3-md-full animate-bounce" style="animation-delay: 300ms"></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Input Area -->
        <div class="border-t border-surface-variant p-4">
          <div class="flex items-end gap-2">
            <textarea
              v-model="messageInput"
              placeholder="Ask about the repository..."
              rows="1"
              class="flex-1 px-4 py-3 text-sm border border-surface-variant rounded-m3-md bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none max-h-32"
              :disabled="isBusy"
              @keydown="handleKeyDown"
            />
            <button
              class="px-4 py-3 rounded-m3-md transition-all flex items-center gap-2"
              :class="messageInput.trim() && !isBusy
                ? 'bg-primary-600 text-white hover:bg-primary-700'
                : 'bg-secondary-200 text-secondary-500 cursor-not-allowed'"
              :disabled="!messageInput.trim() || isBusy"
              @click="sendMessage"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
              <span class="text-sm font-medium">Send</span>
            </button>
          </div>
          <div class="text-xs text-secondary-500 mt-2">
            Press Enter to send, Shift+Enter for new line
          </div>
        </div>
      </div>

      <!-- Tools Panel (Secondary, Collapsible) -->
      <Transition name="slide">
        <div v-if="showTools" class="w-80 border-l border-surface-variant bg-surface-1 overflow-y-auto">
          <div class="p-4 space-y-4">
            <div>
              <h3 class="text-sm font-semibold text-secondary-900 mb-3">Quick Actions</h3>
              
              <!-- Quick Pipeline Actions -->
              <div class="space-y-2">
                <button
                  class="w-full flex items-center gap-3 px-3 py-2 text-sm text-left rounded-m3-md hover:bg-white transition-colors border border-transparent hover:border-surface-variant"
                  @click="() => assistantStore.runPipeline({ repoPath: contextStore.repoPath!, pipeline: 'validate' })"
                  :disabled="!contextStore.repoPath"
                >
                  <svg class="w-4 h-4 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div class="flex-1">
                    <div class="font-medium text-secondary-900">Validate</div>
                    <div class="text-xs text-secondary-600">Check repository</div>
                  </div>
                </button>

                <button
                  class="w-full flex items-center gap-3 px-3 py-2 text-sm text-left rounded-m3-md hover:bg-white transition-colors border border-transparent hover:border-surface-variant"
                  @click="() => assistantStore.runPipeline({ repoPath: contextStore.repoPath!, pipeline: 'build-graph' })"
                  :disabled="!contextStore.repoPath"
                >
                  <svg class="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                  </svg>
                  <div class="flex-1">
                    <div class="font-medium text-secondary-900">Build Graph</div>
                    <div class="text-xs text-secondary-600">Update dependencies</div>
                  </div>
                </button>
              </div>
            </div>

            <!-- Session Info -->
            <div v-if="session" class="pt-4 border-t border-surface-variant">
              <h3 class="text-sm font-semibold text-secondary-900 mb-2">Session</h3>
              <div class="text-xs space-y-1">
                <div class="flex justify-between text-secondary-600">
                  <span>Provider:</span>
                  <span class="font-mono">{{ session.provider }}</span>
                </div>
                <div class="flex justify-between text-secondary-600">
                  <span>Messages:</span>
                  <span class="font-mono">{{ conversation.length }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </div>
  </div>
</template>

<style scoped>
.slide-enter-active,
.slide-leave-active {
  transition: all 0.3s ease;
}

.slide-enter-from {
  transform: translateX(100%);
  opacity: 0;
}

.slide-leave-to {
  transform: translateX(100%);
  opacity: 0;
}

.slide-down-enter-active,
.slide-down-leave-active {
  transition: all 0.3s ease;
}

.slide-down-enter-from {
  transform: translateY(-100%);
  opacity: 0;
}

.slide-down-leave-to {
  transform: translateY(-100%);
  opacity: 0;
}

@keyframes bounce {
  0%, 100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-4px);
  }
}

.animate-bounce {
  animation: bounce 1s infinite;
}
</style>
