<template>
  <span
    class="inline-flex items-center gap-1 px-2 py-1 rounded-m3-sm text-xs font-medium transition-colors"
    :style="{ backgroundColor: colors.bgColor, color: colors.color }"
    :title="description"
    role="status"
    :aria-label="`Current provider: ${displayName}`"
  >
    <span class="text-sm">{{ icon }}</span>
    <span class="font-semibold">{{ shortName }}</span>
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { AssistantProvider } from '@shared/assistant/types';
import {
  getProviderColors,
  getProviderDisplayName,
  getProviderShortName,
  getProviderIcon,
  getProviderDescription
} from '@/services/assistant/providerTokens';

interface Props {
  provider: AssistantProvider;
}

const props = defineProps<Props>();

// Computed values derived from provider metadata
const displayName = computed(() => getProviderDisplayName(props.provider));
const shortName = computed(() => getProviderShortName(props.provider));
const icon = computed(() => getProviderIcon(props.provider));
const description = computed(() => getProviderDescription(props.provider));
const colors = computed(() => getProviderColors(props.provider));
</script>
