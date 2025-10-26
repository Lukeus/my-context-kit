import { defineStore } from 'pinia';
import { ref } from 'vue';

export interface SnackbarAction {
  label: string;
  callback: () => void;
}

export interface SnackbarOptions {
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  timeout?: number; // milliseconds, 0 = no auto-dismiss
  action?: SnackbarAction;
}

interface Snackbar extends SnackbarOptions {
  id: string;
  visible: boolean;
}

export const useSnackbarStore = defineStore('snackbar', () => {
  const snackbars = ref<Snackbar[]>([]);
  let idCounter = 0;

  const show = (options: SnackbarOptions): string => {
    const id = `snackbar-${++idCounter}`;
    const timeout = options.timeout ?? 5000; // Default 5 seconds

    const snackbar: Snackbar = {
      ...options,
      id,
      visible: true,
    };

    snackbars.value.push(snackbar);

    // Auto-dismiss after timeout if not 0
    if (timeout > 0) {
      setTimeout(() => {
        dismiss(id);
      }, timeout);
    }

    return id;
  };

  const dismiss = (id: string) => {
    const snackbar = snackbars.value.find((s) => s.id === id);
    if (snackbar) {
      snackbar.visible = false;
      // Remove from array after transition
      setTimeout(() => {
        snackbars.value = snackbars.value.filter((s) => s.id !== id);
      }, 300);
    }
  };

  const dismissAll = () => {
    snackbars.value.forEach((s) => {
      s.visible = false;
    });
    setTimeout(() => {
      snackbars.value = [];
    }, 300);
  };

  // Convenience methods
  const success = (message: string, options?: Partial<SnackbarOptions>) => {
    return show({ message, type: 'success', ...options });
  };

  const error = (message: string, options?: Partial<SnackbarOptions>) => {
    return show({ message, type: 'error', timeout: 0, ...options }); // Errors don't auto-dismiss
  };

  const warning = (message: string, options?: Partial<SnackbarOptions>) => {
    return show({ message, type: 'warning', ...options });
  };

  const info = (message: string, options?: Partial<SnackbarOptions>) => {
    return show({ message, type: 'info', ...options });
  };

  return {
    snackbars,
    show,
    dismiss,
    dismissAll,
    success,
    error,
    warning,
    info,
  };
});

// Export composable for convenience
export const useSnackbar = () => useSnackbarStore();
