<script setup lang="ts">
import { onMounted, ref } from 'vue';

interface SyncSettings {
  autoPullOnStart: boolean;
  autoPushOnSave: boolean;
  syncInterval: number; // in minutes, 0 = disabled
  commitMessageTemplate: string;
}

const emit = defineEmits<{
  close: [];
  save: [settings: SyncSettings];
}>();

const settings = ref<SyncSettings>({
  autoPullOnStart: false,
  autoPushOnSave: false,
  syncInterval: 0,
  commitMessageTemplate: 'Update agent profiles'
});

const intervalOptions = [
  { value: 0, label: 'Disabled' },
  { value: 5, label: 'Every 5 minutes' },
  { value: 15, label: 'Every 15 minutes' },
  { value: 30, label: 'Every 30 minutes' },
  { value: 60, label: 'Every hour' }
];

onMounted(() => {
  // Load settings from localStorage
  const saved = localStorage.getItem('agent-sync-settings');
  if (saved) {
    try {
      settings.value = JSON.parse(saved);
    } catch (e) {
      console.error('Failed to load sync settings:', e);
    }
  }
});

function handleSave() {
  // Save to localStorage
  localStorage.setItem('agent-sync-settings', JSON.stringify(settings.value));
  emit('save', settings.value);
}

function handleCancel() {
  emit('close');
}
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
    <div class="w-full max-w-2xl bg-white rounded-m3-xl shadow-elevation-3 flex flex-col">
      <!-- Header -->
      <header class="flex items-center justify-between px-6 py-4 border-b border-surface-variant">
        <div>
          <h2 class="text-lg font-semibold text-secondary-900">Sync Settings</h2>
          <p class="text-sm text-secondary-600">Configure automatic agent synchronization</p>
        </div>
        <button
          class="text-secondary-600 hover:text-secondary-900 transition-colors p-1"
          @click="handleCancel"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </header>

      <!-- Content -->
      <div class="p-6 space-y-6">
        <!-- Auto-Pull on Start -->
        <div class="space-y-2">
          <label class="flex items-center gap-3 cursor-pointer">
            <input
              v-model="settings.autoPullOnStart"
              type="checkbox"
              class="w-4 h-4 rounded border-surface-variant text-primary-600 focus:ring-primary-500"
            />
            <div>
              <div class="text-sm font-medium text-secondary-900">
                Auto-pull on app start
              </div>
              <div class="text-xs text-secondary-600">
                Automatically check for and pull remote agent updates when the app launches
              </div>
            </div>
          </label>
        </div>

        <!-- Auto-Push on Save -->
        <div class="space-y-2">
          <label class="flex items-center gap-3 cursor-pointer">
            <input
              v-model="settings.autoPushOnSave"
              type="checkbox"
              class="w-4 h-4 rounded border-surface-variant text-primary-600 focus:ring-primary-500"
            />
            <div>
              <div class="text-sm font-medium text-secondary-900">
                Auto-push after saving agents
              </div>
              <div class="text-xs text-secondary-600">
                Automatically commit and push agent changes after creating or editing
              </div>
            </div>
          </label>
          
          <div
            v-if="settings.autoPushOnSave"
            class="ml-7 mt-2 p-3 bg-yellow-50 border border-yellow-200 rounded-m3-md"
          >
            <div class="flex items-start gap-2">
              <svg class="w-4 h-4 text-yellow-700 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
              </svg>
              <div class="text-xs text-yellow-900">
                <strong>Note:</strong> Changes will be pushed immediately. Make sure your repository is configured correctly.
              </div>
            </div>
          </div>
        </div>

        <!-- Background Sync Interval -->
        <div class="space-y-2">
          <div class="text-sm font-medium text-secondary-900">
            Background sync interval
          </div>
          <div class="text-xs text-secondary-600 mb-2">
            Periodically sync agents with the remote repository in the background
          </div>
          <select
            v-model.number="settings.syncInterval"
            class="w-full px-3 py-2 text-sm border border-surface-variant rounded-m3-md bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option
              v-for="option in intervalOptions"
              :key="option.value"
              :value="option.value"
            >
              {{ option.label }}
            </option>
          </select>
          
          <div
            v-if="settings.syncInterval > 0"
            class="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-m3-md"
          >
            <div class="flex items-start gap-2">
              <svg class="w-4 h-4 text-blue-700 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
              </svg>
              <div class="text-xs text-blue-900">
                Automatic sync will pull updates and push local changes every {{ settings.syncInterval }} minutes.
              </div>
            </div>
          </div>
        </div>

        <!-- Commit Message Template -->
        <div class="space-y-2">
          <label class="text-sm font-medium text-secondary-900 block">
            Default commit message
          </label>
          <div class="text-xs text-secondary-600 mb-2">
            Template for automatic commit messages when using auto-push or background sync
          </div>
          <input
            v-model="settings.commitMessageTemplate"
            type="text"
            placeholder="Update agent profiles"
            class="w-full px-3 py-2 text-sm border border-surface-variant rounded-m3-md bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          <div class="text-xs text-secondary-500 mt-1">
            You can always override this message when manually pushing changes
          </div>
        </div>

        <!-- Info Box -->
        <div class="p-4 bg-surface-1 border border-surface-variant rounded-m3-lg">
          <div class="flex items-start gap-3">
            <div class="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
              <svg class="w-4 h-4 text-primary-700" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clip-rule="evenodd" />
              </svg>
            </div>
            <div class="flex-1">
              <h3 class="text-sm font-semibold text-secondary-900 mb-1">Sync Best Practices</h3>
              <ul class="text-xs text-secondary-600 space-y-1">
                <li>• Enable auto-pull to stay updated with team changes</li>
                <li>• Use background sync for seamless collaboration</li>
                <li>• Auto-push is best for personal repositories</li>
                <li>• Manual sync gives you more control in team environments</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <footer class="flex items-center justify-end gap-3 px-6 py-4 border-t border-surface-variant bg-white">
        <button
          class="px-4 py-2 text-sm font-medium text-secondary-700 hover:text-secondary-900 transition-colors"
          @click="handleCancel"
        >
          Cancel
        </button>
        <button
          class="px-4 py-2 text-sm font-medium bg-primary-600 text-white rounded-m3-lg hover:bg-primary-700 transition-colors shadow-elevation-1"
          @click="handleSave"
        >
          Save Settings
        </button>
      </footer>
    </div>
  </div>
</template>
