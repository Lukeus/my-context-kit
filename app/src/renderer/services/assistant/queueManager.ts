// Queue Manager (T012)
// -----------------------------------------------------------------------------
// Provides concurrency-controlled execution for assistant tasks (tool invocations,
// pipelines, contextual reads). This isolates scheduling logic from the store
// and will integrate with telemetry emitter + capability gating.
// Concurrency default: 3 (from spec decisions).
// TODO(T012-Integration): Wire enqueue calls from assistantStore executeTool / runPipeline.
// TODO(T012-Telemetry): Emit tool.invoked/tool.completed events via telemetryEmitter.
// TODO(T012-Retry): Add retry strategy for transient failures.

export type QueueTaskStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'aborted';

export interface QueueTask<T = unknown> {
  id: string;
  type: 'tool' | 'pipeline' | 'context-read' | 'generic';
  createdAt: string;
  startedAt?: string;
  finishedAt?: string;
  status: QueueTaskStatus;
  action: () => Promise<T>;
  metadata?: Record<string, unknown>;
  result?: T;
  error?: string;
}

export interface QueueEventBase { taskId: string; timestamp: string; }
export interface QueueTaskStartedEvent extends QueueEventBase { kind: 'task.started'; }
export interface QueueTaskFinishedEvent extends QueueEventBase { kind: 'task.finished'; status: QueueTaskStatus; durationMs: number; }
export interface QueueTaskEnqueuedEvent extends QueueEventBase { kind: 'task.enqueued'; }
export interface QueueTaskAbortedEvent extends QueueEventBase { kind: 'task.aborted'; reason?: string; }
export type QueueEvent = QueueTaskStartedEvent | QueueTaskFinishedEvent | QueueTaskEnqueuedEvent | QueueTaskAbortedEvent;

export interface QueueSnapshot {
  active: number;
  limit: number;
  queued: number;
  running: QueueTask[];
  pending: QueueTask[];
  completed: QueueTask[];
}

export interface QueueManagerOptions {
  concurrency?: number;
  idFactory?: () => string;
}

export class QueueManager {
  private limit: number;
  private tasks: QueueTask[] = [];
  private listeners: Set<(e: QueueEvent) => void> = new Set();
  private idFactory: () => string;
  private runningCount = 0;

  constructor(options: QueueManagerOptions = {}) {
    this.limit = options.concurrency ?? 3;
    this.idFactory = options.idFactory ?? (() => `qt-${crypto.randomUUID?.() || `${Date.now()}-${Math.floor(Math.random()*10000)}`}`);
  }

  on(listener: (e: QueueEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  setConcurrency(next: number) {
    if (next < 1) throw new Error('Concurrency must be >= 1');
    this.limit = next;
    this.pump();
  }

  enqueue<T>(type: QueueTask<T>['type'], action: () => Promise<T>, metadata?: Record<string, unknown>): QueueTask<T> {
    const task: QueueTask<T> = {
      id: this.idFactory(),
      type,
      createdAt: new Date().toISOString(),
      status: 'queued',
      action,
      metadata
    };
    this.tasks.push(task);
    this.emit({ kind: 'task.enqueued', taskId: task.id, timestamp: task.createdAt });
    this.pump();
    return task;
  }

  abort(taskId: string, reason?: string): boolean {
    const task = this.tasks.find(t => t.id === taskId);
    if (!task) return false;
    if (task.status === 'running') {
      // Cooperative cancellation not yet implemented.
      // TODO(T012-Abort): Add abort signal support to actions.
      return false;
    }
    if (task.status === 'queued') {
      task.status = 'aborted';
      task.finishedAt = new Date().toISOString();
      this.emit({ kind: 'task.aborted', taskId, timestamp: task.finishedAt, reason });
      this.tasks = this.tasks.filter(t => t.id !== taskId);
      return true;
    }
    return false;
  }

  getSnapshot(): QueueSnapshot {
    const running = this.tasks.filter(t => t.status === 'running');
    const pending = this.tasks.filter(t => t.status === 'queued');
    const completed = this.tasks.filter(t => t.status === 'succeeded' || t.status === 'failed' || t.status === 'aborted');
    return {
      active: running.length,
      limit: this.limit,
      queued: pending.length,
      running,
      pending,
      completed
    };
  }

  private pump() {
    while (this.runningCount < this.limit) {
      const next = this.tasks.find(t => t.status === 'queued');
      if (!next) break;
      this.startTask(next);
    }
  }

  private startTask(task: QueueTask) {
    task.status = 'running';
    task.startedAt = new Date().toISOString();
    this.runningCount += 1;
    this.emit({ kind: 'task.started', taskId: task.id, timestamp: task.startedAt });
    
    // Execute task asynchronously
    void (async () => {
      try {
        const result = await task.action();
        task.result = result;
        task.status = 'succeeded';
      } catch (err) {
        task.error = err instanceof Error ? err.message : String(err);
        task.status = 'failed';
      } finally {
        task.finishedAt = new Date().toISOString();
        const durationMs = task.startedAt 
          ? new Date(task.finishedAt).getTime() - new Date(task.startedAt).getTime()
          : 0;
        this.emit({ kind: 'task.finished', taskId: task.id, timestamp: task.finishedAt, status: task.status, durationMs });
        this.runningCount -= 1;
        this.pump();
      }
    })();
  }

  private emit(evt: QueueEvent) {
    for (const l of [...this.listeners]) {
      try { l(evt); } catch {/* ignore listener errors */}
    }
  }
}

export function createQueueManager(options?: QueueManagerOptions): QueueManager {
  return new QueueManager(options);
}

// Example usage:
// const qm = createQueueManager({ concurrency: 3 });
// qm.enqueue('tool', () => runTool());
// qm.on(e => console.log('queue event', e));
