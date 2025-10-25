import { ref } from 'vue';

interface SnackbarOptions {
  message: string;
  type?: 'info' | 'success' | 'warning' | 'error';
  duration?: number;
  action?: string;
  onAction?: () => void;
}

const show = ref(false);
const message = ref('');
const type = ref<'info' | 'success' | 'warning' | 'error'>('info');
const action = ref('');
const onAction = ref<(() => void) | undefined>(undefined);
let timeoutId: ReturnType<typeof setTimeout> | null = null;

export function useSnackbar() {
  function showSnackbar(options: SnackbarOptions) {
    // Clear existing timeout
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    message.value = options.message;
    type.value = options.type || 'info';
    action.value = options.action || '';
    onAction.value = options.onAction;
    show.value = true;

    // Auto-hide after duration
    const duration = options.duration ?? 3000;
    if (duration > 0) {
      timeoutId = setTimeout(() => {
        hide();
      }, duration);
    }
  }

  function hide() {
    show.value = false;
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  }

  function handleAction() {
    if (onAction.value) {
      onAction.value();
    }
    hide();
  }

  return {
    // State
    show,
    message,
    type,
    action,
    // Methods
    showSnackbar,
    hide,
    handleAction
  };
}
