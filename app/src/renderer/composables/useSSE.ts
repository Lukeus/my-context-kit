/**
 * Server-Sent Events (SSE) Composable
 * 
 * Provides utilities for consuming SSE streams from backend.
 */

import { ref, Ref, onUnmounted } from 'vue';

export interface SSEMessage {
  type: 'progress' | 'token' | 'complete' | 'error';
  progress?: number;
  message?: string;
  status?: string;
  token?: string;
  cumulative_text?: string;
  result?: any;
  error?: string;
  error_code?: string;
  metadata?: Record<string, any>;
}

export interface SSEOptions {
  onProgress?: (progress: number, message: string) => void;
  onToken?: (token: string, cumulativeText?: string) => void;
  onComplete?: (result: any) => void;
  onError?: (error: string, errorCode?: string) => void;
  reconnect?: boolean;
  reconnectInterval?: number;
}

export class SSEConnection {
  private eventSource: EventSource | null = null;
  private url: string;
  private options: SSEOptions;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 3;
  
  public isConnected: Ref<boolean> = ref(false);
  public error: Ref<string | null> = ref(null);

  constructor(url: string, options: SSEOptions = {}) {
    this.url = url;
    this.options = {
      reconnect: true,
      reconnectInterval: 3000,
      ...options,
    };
  }

  connect(): void {
    try {
      this.eventSource = new EventSource(this.url);
      this.isConnected.value = true;
      this.error.value = null;
      this.reconnectAttempts = 0;

      // Handle progress events
      this.eventSource.addEventListener('progress', (event) => {
        try {
          const data: SSEMessage = JSON.parse(event.data);
          if (this.options.onProgress && data.progress !== undefined && data.message) {
            this.options.onProgress(data.progress, data.message);
          }
        } catch (err) {
          console.error('Failed to parse progress event:', err);
        }
      });

      // Handle token streaming events
      this.eventSource.addEventListener('token', (event) => {
        try {
          const data: SSEMessage = JSON.parse(event.data);
          if (this.options.onToken && data.token) {
            this.options.onToken(data.token, data.cumulative_text);
          }
        } catch (err) {
          console.error('Failed to parse token event:', err);
        }
      });

      // Handle completion events
      this.eventSource.addEventListener('complete', (event) => {
        try {
          const data: SSEMessage = JSON.parse(event.data);
          if (this.options.onComplete) {
            this.options.onComplete(data.result);
          }
          this.close();
        } catch (err) {
          console.error('Failed to parse complete event:', err);
        }
      });

      // Handle error events
      this.eventSource.addEventListener('error', (event) => {
        try {
          const data: SSEMessage = JSON.parse((event as any).data);
          this.error.value = data.error || 'Unknown error';
          if (this.options.onError) {
            this.options.onError(data.error || 'Unknown error', data.error_code);
          }
        } catch {
          this.error.value = 'Connection error';
          if (this.options.onError) {
            this.options.onError('Connection error');
          }
        }
        
        // Attempt reconnection if enabled
        if (this.options.reconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
          this.attemptReconnect();
        } else {
          this.close();
        }
      });

      // Handle connection errors
      this.eventSource.onerror = () => {
        this.isConnected.value = false;
        
        if (this.options.reconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
          this.attemptReconnect();
        } else {
          this.close();
        }
      };

    } catch (err) {
      this.error.value = err instanceof Error ? err.message : 'Failed to connect';
      this.isConnected.value = false;
    }
  }

  private attemptReconnect(): void {
    this.reconnectAttempts++;
    const delay = this.options.reconnectInterval! * this.reconnectAttempts;
    
    setTimeout(() => {
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        this.connect();
      }
    }, delay);
  }

  close(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    this.isConnected.value = false;
  }

  isActive(): boolean {
    return this.isConnected.value;
  }
}

/**
 * Composable for using SSE streams
 */
export function useSSE(url: string, options: SSEOptions = {}) {
  const messages = ref<SSEMessage[]>([]);
  const lastMessage = ref<SSEMessage | null>(null);
  
  // Track cumulative progress
  const progress = ref(0);
  const statusMessage = ref('');
  const cumulativeText = ref('');
  const isComplete = ref(false);
  const hasError = ref(false);

  // Wrap callbacks to update refs
  const wrappedOptions: SSEOptions = {
    ...options,
    onProgress: (prog, msg) => {
      progress.value = prog;
      statusMessage.value = msg;
      
      const message: SSEMessage = {
        type: 'progress',
        progress: prog,
        message: msg,
        status: 'in_progress',
      };
      messages.value.push(message);
      lastMessage.value = message;
      
      options.onProgress?.(prog, msg);
    },
    onToken: (token, cumulative) => {
      if (cumulative !== undefined) {
        cumulativeText.value = cumulative;
      } else {
        cumulativeText.value += token;
      }
      
      const message: SSEMessage = {
        type: 'token',
        token,
        cumulative_text: cumulativeText.value,
        status: 'streaming',
      };
      messages.value.push(message);
      lastMessage.value = message;
      
      options.onToken?.(token, cumulative);
    },
    onComplete: (result) => {
      progress.value = 100;
      isComplete.value = true;
      
      const message: SSEMessage = {
        type: 'complete',
        status: 'complete',
        result,
      };
      messages.value.push(message);
      lastMessage.value = message;
      
      options.onComplete?.(result);
    },
    onError: (error, errorCode) => {
      hasError.value = true;
      statusMessage.value = error;
      
      const message: SSEMessage = {
        type: 'error',
        status: 'error',
        error,
        error_code: errorCode,
      };
      messages.value.push(message);
      lastMessage.value = message;
      
      options.onError?.(error, errorCode);
    },
  };

  const conn = new SSEConnection(url, wrappedOptions);

  // Auto-cleanup on unmount
  onUnmounted(() => {
    conn.close();
  });

  return {
    connection: conn,
    messages,
    lastMessage,
    progress,
    statusMessage,
    cumulativeText,
    isComplete,
    hasError,
    isConnected: conn.isConnected,
    error: conn.error,
    connect: () => conn.connect(),
    close: () => conn.close(),
  };
}

/**
 * Helper to create SSE URL with query parameters
 */
export function createSSEUrl(baseUrl: string, params: Record<string, any>): string {
  const url = new URL(baseUrl, window.location.origin);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      url.searchParams.append(key, String(value));
    }
  });
  return url.toString();
}
