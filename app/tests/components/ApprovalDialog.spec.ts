import { describe, it, expect, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import ApprovalDialog from '@/components/assistant/ApprovalDialog.vue';
import { useAssistantStore } from '@/stores/assistantStore';
import type { PendingAction } from '@shared/assistant/types';

describe('ApprovalDialog', () => {
  let pinia: ReturnType<typeof createPinia>;

  beforeEach(() => {
    pinia = createPinia();
    setActivePinia(pinia);
  });

  it('renders active pending diff and displays approval UI', async () => {
    const store = useAssistantStore();
    const pending: PendingAction = {
      id: 'p-ui',
      sessionId: 'sess-1',
      toolId: 'context.write',
      createdAt: new Date().toISOString(),
      expiresAt: new Date().toISOString(),
      approvalState: 'pending',
      diffPreview: '--- a/foo\n+++ b/foo\n+hi'
    };

    store.addPendingLocally(pending);
    store.openPendingApproval('p-ui');

    const wrapper = mount(ApprovalDialog, { global: { plugins: [pinia] } });
    
    // Test that the dialog renders correctly
    expect(wrapper.text()).toContain('Approval required');
    expect(wrapper.text()).toContain('context.write');
    expect(wrapper.text()).toContain('+hi');
    
    // Test that the pending action is correctly identified
    expect(store.activePendingId).toBe('p-ui');
    expect(store.activePending).toEqual(pending);
  });
});
