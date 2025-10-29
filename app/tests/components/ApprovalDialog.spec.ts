import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import ApprovalDialog from '@/components/assistant/ApprovalDialog.vue';
import { useAssistantStore } from '@/stores/assistantStore';
import type { PendingAction } from '@shared/assistant/types';

describe('ApprovalDialog', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('renders active pending diff and calls approve/reject', async () => {
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

    // spy on approve/reject
    const approveSpy = vi.spyOn(store, 'approvePending');
    const rejectSpy = vi.spyOn(store, 'rejectPending');

    const wrapper = mount(ApprovalDialog, { global: { plugins: [createPinia()] } });
    expect(wrapper.text()).toContain('Approval required');
    expect(wrapper.text()).toContain('context.write');
    expect(wrapper.text()).toContain('+hi');

    // Set notes and trigger approve
    const ta = wrapper.find('textarea');
    await ta.setValue('Looks good');
    await wrapper.find('button.bg-primary-600').trigger('click');
    expect(approveSpy).toHaveBeenCalledWith('p-ui', 'Looks good');

    // reopen for reject path
    store.openPendingApproval('p-ui');
    await wrapper.find('button.bg-secondary-200').trigger('click');
    expect(rejectSpy).toHaveBeenCalledWith('p-ui', 'Rejected via UI');
  });
});
