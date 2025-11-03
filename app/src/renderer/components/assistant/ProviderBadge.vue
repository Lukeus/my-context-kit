<template>
  <span
    :class="[
      'inline-flex items-center gap-1 px-2 py-1 rounded-m3-sm text-xs font-medium transition-colors',
      provider === 'azure-openai' ? 'bg-[#E6F2FF] text-[#0078D4]' : 'bg-[#F5F5F5] text-[#000000]'
    ]"
    :title="description"
    role="status"
    aria-label="`Current provider: ${displayName}`"
  >
    <span class="text-sm">{{ icon }}</span>
    <span class="font-semibold">{{ shortName }}</span>
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { AssistantProvider } from '@shared/assistant/types';
import {
  getProviderToken,
  getProviderDisplayName,
  getProviderShortName,
  getProviderIcon,
  getProviderDescription
} from '@/services/assistant/providerTokens';

interface Props {
  provider: AssistantProvider;
}

const props = defineProps<Props>();

// Computed
const token = computed(() => getProviderToken(props.provider));
const displayName = computed(() => getProviderDisplayName(props.provider));
const shortName = computed(() => getProviderShortName(props.provider));
const icon = computed(() => getProviderIcon(props.provider));
const description = computed(() => getProviderDescription(props.provider));
</script>
