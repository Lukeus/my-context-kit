// Accessibility Focus Traversal Map (T021)
// -----------------------------------------------------------------------------
// Provides keyboard navigation and focus management for unified assistant UI.
// Implements ARIA best practices for complex interactive widgets.
// TODO(T021-UI): Wire focus trap into UnifiedAssistant.vue component.
// TODO(T021-Testing): Add keyboard navigation E2E tests.

export type FocusableElement =
  | 'message-input'
  | 'send-button'
  | 'tool-palette'
  | 'transcript'
  | 'approval-dialog'
  | 'telemetry-panel'
  | 'settings-menu'
  | 'close-button';

export interface FocusNode {
  id: FocusableElement;
  selector: string;
  ariaLabel: string;
  ariaRole: string;
  next?: FocusableElement;
  prev?: FocusableElement;
  up?: FocusableElement;
  down?: FocusableElement;
  left?: FocusableElement;
  right?: FocusableElement;
  escape?: FocusableElement; // Focus target when ESC pressed
}

/**
 * Focus traversal map for unified assistant UI.
 * Defines keyboard navigation between interactive elements.
 */
export const FOCUS_MAP: Record<FocusableElement, FocusNode> = {
  'message-input': {
    id: 'message-input',
    selector: '[data-assistant-focus="message-input"]',
    ariaLabel: 'Message input field',
    ariaRole: 'textbox',
    next: 'send-button',
    up: 'transcript',
    right: 'tool-palette'
  },
  'send-button': {
    id: 'send-button',
    selector: '[data-assistant-focus="send-button"]',
    ariaLabel: 'Send message',
    ariaRole: 'button',
    prev: 'message-input',
    up: 'transcript',
    left: 'message-input'
  },
  'tool-palette': {
    id: 'tool-palette',
    selector: '[data-assistant-focus="tool-palette"]',
    ariaLabel: 'Available tools',
    ariaRole: 'menu',
    down: 'message-input',
    left: 'message-input',
    right: 'telemetry-panel'
  },
  'transcript': {
    id: 'transcript',
    selector: '[data-assistant-focus="transcript"]',
    ariaLabel: 'Conversation transcript',
    ariaRole: 'log',
    down: 'message-input',
    right: 'telemetry-panel'
  },
  'approval-dialog': {
    id: 'approval-dialog',
    selector: '[data-assistant-focus="approval-dialog"]',
    ariaLabel: 'Approval required',
    ariaRole: 'dialog',
    escape: 'message-input'
  },
  'telemetry-panel': {
    id: 'telemetry-panel',
    selector: '[data-assistant-focus="telemetry-panel"]',
    ariaLabel: 'Session telemetry',
    ariaRole: 'complementary',
    left: 'transcript',
    down: 'settings-menu'
  },
  'settings-menu': {
    id: 'settings-menu',
    selector: '[data-assistant-focus="settings-menu"]',
    ariaLabel: 'Assistant settings',
    ariaRole: 'menu',
    up: 'telemetry-panel',
    escape: 'message-input'
  },
  'close-button': {
    id: 'close-button',
    selector: '[data-assistant-focus="close-button"]',
    ariaLabel: 'Close assistant',
    ariaRole: 'button',
    escape: 'message-input'
  }
};

/**
 * Focus manager for keyboard navigation.
 */
export class FocusManager {
  private currentFocus: FocusableElement | null = null;
  private container: HTMLElement | null = null;
  private focusTrap: boolean = false;

  constructor(container?: HTMLElement) {
    this.container = container || null;
  }

  setContainer(container: HTMLElement) {
    this.container = container;
  }

  enableFocusTrap() {
    this.focusTrap = true;
  }

  disableFocusTrap() {
    this.focusTrap = false;
  }

  /**
   * Focus a specific element by ID.
   */
  focus(elementId: FocusableElement): boolean {
    if (!this.container) return false;

    const node = FOCUS_MAP[elementId];
    const element = this.container.querySelector<HTMLElement>(node.selector);
    
    if (element) {
      element.focus();
      this.currentFocus = elementId;
      return true;
    }
    
    return false;
  }

  /**
   * Move focus based on keyboard direction.
   */
  move(direction: 'next' | 'prev' | 'up' | 'down' | 'left' | 'right' | 'escape'): boolean {
    if (!this.currentFocus) {
      // No current focus - focus first element
      return this.focus('message-input');
    }

    const node = FOCUS_MAP[this.currentFocus];
    const targetId = node[direction];

    if (targetId) {
      return this.focus(targetId);
    }

    // No target in that direction
    if (this.focusTrap) {
      // Stay on current element in focus trap mode
      return false;
    }

    return false;
  }

  /**
   * Get current focused element ID.
   */
  getCurrent(): FocusableElement | null {
    return this.currentFocus;
  }

  /**
   * Handle keyboard event for navigation.
   */
  handleKeyDown(event: KeyboardEvent): boolean {
    const { key, shiftKey, ctrlKey, metaKey } = event;

    // Don't interfere with text input
    if (this.currentFocus === 'message-input' && !ctrlKey && !metaKey) {
      if (key.length === 1 || key === 'Backspace' || key === 'Delete') {
        return false;
      }
    }

    switch (key) {
      case 'Tab':
        event.preventDefault();
        return this.move(shiftKey ? 'prev' : 'next');
      
      case 'ArrowUp':
        event.preventDefault();
        return this.move('up');
      
      case 'ArrowDown':
        event.preventDefault();
        return this.move('down');
      
      case 'ArrowLeft':
        event.preventDefault();
        return this.move('left');
      
      case 'ArrowRight':
        event.preventDefault();
        return this.move('right');
      
      case 'Escape':
        event.preventDefault();
        return this.move('escape');
      
      case 'Home':
        event.preventDefault();
        return this.focus('message-input');
      
      default:
        return false;
    }
  }

  /**
   * Attach keyboard event listeners to container.
   */
  attach(): () => void {
    if (!this.container) {
      throw new Error('Container must be set before attaching focus manager');
    }

    const handler = (e: KeyboardEvent) => this.handleKeyDown(e);
    this.container.addEventListener('keydown', handler);

    return () => {
      this.container?.removeEventListener('keydown', handler);
    };
  }
}

/**
 * Create focus manager for assistant component.
 */
export function createFocusManager(container?: HTMLElement): FocusManager {
  return new FocusManager(container);
}

/**
 * Get ARIA attributes for focusable element.
 */
export function getAriaAttributes(elementId: FocusableElement): {
  'aria-label': string;
  role: string;
  'data-assistant-focus': string;
} {
  const node = FOCUS_MAP[elementId];
  return {
    'aria-label': node.ariaLabel,
    'role': node.ariaRole,
    'data-assistant-focus': elementId
  };
}

// Example usage:
// const manager = createFocusManager(document.querySelector('.unified-assistant'));
// manager.enableFocusTrap();
// manager.focus('message-input');
// const cleanup = manager.attach();
