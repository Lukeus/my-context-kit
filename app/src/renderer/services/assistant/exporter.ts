// Session Exporter (T028)
// -----------------------------------------------------------------------------
// Provides export utilities for unified assistant sessions.
// Supports markdown, JSON, and structured formats for sharing and archiving.
// TODO(T028-UI): Add export button to UnifiedAssistant.vue toolbar.
// TODO(T028-Formats): Add HTML export with syntax highlighting.

import type {
  AssistantSessionExtended,
  ConversationTurn,
  ToolInvocationRecord
} from '@shared/assistant/types';
import type { AssistantTelemetryEvent } from '@shared/assistant/telemetry';

export type ExportFormat = 'markdown' | 'json' | 'text';

export interface ExportOptions {
  format?: ExportFormat;
  includeMetadata?: boolean;
  includeTelemetry?: boolean;
  includeApprovals?: boolean;
  includeSystemPrompt?: boolean;
  sanitize?: boolean; // Remove sensitive data
}

const DEFAULT_OPTIONS: Required<ExportOptions> = {
  format: 'markdown',
  includeMetadata: true,
  includeTelemetry: false,
  includeApprovals: true,
  includeSystemPrompt: false,
  sanitize: false
};

/**
 * Export session to specified format.
 */
export function exportSession(
  session: AssistantSessionExtended,
  telemetry?: ToolInvocationRecord[],
  telemetryEvents?: AssistantTelemetryEvent[],
  options: ExportOptions = {}
): string {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  switch (opts.format) {
    case 'markdown':
      return exportMarkdown(session, telemetry, telemetryEvents, opts);
    case 'json':
      return exportJSON(session, telemetry, telemetryEvents, opts);
    case 'text':
      return exportText(session, telemetry, opts);
    default:
      throw new Error(`Unsupported export format: ${opts.format}`);
  }
}

/**
 * Export session as Markdown.
 */
function exportMarkdown(
  session: AssistantSessionExtended,
  telemetry: ToolInvocationRecord[] | undefined,
  telemetryEvents: AssistantTelemetryEvent[] | undefined,
  options: Required<ExportOptions>
): string {
  const lines: string[] = [];

  // Header
  lines.push(`# Assistant Session Export`);
  lines.push('');

  // Metadata
  if (options.includeMetadata) {
    lines.push(`## Session Information`);
    lines.push('');
    lines.push(`- **Session ID**: \`${session.id}\``);
    lines.push(`- **Provider**: ${session.provider}`);
    lines.push(`- **Created**: ${formatDate(session.createdAt)}`);
    lines.push(`- **Updated**: ${formatDate(session.updatedAt)}`);
    lines.push(`- **Messages**: ${session.messages.length}`);
    if (session.activeTools.length > 0) {
      lines.push(`- **Active Tools**: ${session.activeTools.map(t => t.id).join(', ')}`);
    }
    lines.push('');
  }

  // System Prompt
  if (options.includeSystemPrompt) {
    lines.push(`## System Prompt`);
    lines.push('');
    lines.push('```');
    lines.push(session.systemPrompt);
    lines.push('```');
    lines.push('');
  }

  // Conversation
  lines.push(`## Conversation`);
  lines.push('');

  for (const turn of session.messages) {
    const role = turn.role === 'user' ? '**User**' : turn.role === 'assistant' ? '**Assistant**' : '**System**';
    lines.push(`### ${role} (${formatTime(turn.timestamp)})`);
    lines.push('');
    lines.push(turn.content);
    lines.push('');
  }

  // Approvals
  if (options.includeApprovals && session.pendingApprovals.length > 0) {
    lines.push(`## Pending Approvals`);
    lines.push('');
    
    for (const approval of session.pendingApprovals) {
      lines.push(`- **${approval.toolId}** (${approval.approvalState})`);
      if (approval.diffPreview) {
        lines.push(`  - Preview: ${approval.diffPreview.substring(0, 100)}...`);
      }
    }
    lines.push('');
  }

  // Telemetry
  if (options.includeTelemetry && telemetry && telemetry.length > 0) {
    lines.push(`## Telemetry`);
    lines.push('');
    lines.push(`| Tool | Status | Duration |`);
    lines.push(`|------|--------|----------|`);
    
    for (const record of telemetry) {
      const duration = record.finishedAt && record.startedAt
        ? `${Math.round((new Date(record.finishedAt).getTime() - new Date(record.startedAt).getTime()) / 1000)}s`
        : '-';
      lines.push(`| ${record.toolId} | ${record.status} | ${duration} |`);
    }
    lines.push('');
  }

  // Footer
  lines.push('---');
  lines.push(`*Exported on ${formatDate(new Date().toISOString())}*`);

  return lines.join('\n');
}

/**
 * Export session as JSON.
 */
function exportJSON(
  session: AssistantSessionExtended,
  telemetry: ToolInvocationRecord[] | undefined,
  telemetryEvents: AssistantTelemetryEvent[] | undefined,
  options: Required<ExportOptions>
): string {
  const canonicalMessages = session.messages.map((turn, index) =>
    toCanonicalMessage(session.id, turn, index)
  );

  const data: Record<string, unknown> = {
    version: '1.0.0',
    exportedAt: new Date().toISOString(),
    session: {
      id: session.id,
      provider: session.provider,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      ...(options.includeSystemPrompt && { systemPrompt: session.systemPrompt }),
      messages: canonicalMessages,
      ...(options.includeMetadata && {
        activeTools: session.activeTools.map(t => ({ id: t.id, title: t.title })),
        tasks: session.tasks
      })
    }
  };

  if (options.includeApprovals && session.pendingApprovals.length > 0) {
    data.approvals = session.pendingApprovals;
  }

  if (options.includeTelemetry) {
    if (telemetry) data.telemetry = telemetry;
    if (telemetryEvents) data.telemetryEvents = telemetryEvents;
  }

  return JSON.stringify(data, null, 2);
}

/**
 * Export session as plain text.
 */
function exportText(
  session: AssistantSessionExtended,
  telemetry: ToolInvocationRecord[] | undefined,
  options: Required<ExportOptions>
): string {
  const lines: string[] = [];

  lines.push('='.repeat(80));
  lines.push('ASSISTANT SESSION EXPORT');
  lines.push('='.repeat(80));
  lines.push('');

  if (options.includeMetadata) {
    lines.push(`Session ID: ${session.id}`);
    lines.push(`Provider: ${session.provider}`);
    lines.push(`Created: ${formatDate(session.createdAt)}`);
    lines.push(`Messages: ${session.messages.length}`);
    lines.push('');
  }

  lines.push('-'.repeat(80));
  lines.push('CONVERSATION');
  lines.push('-'.repeat(80));
  lines.push('');

  for (const turn of session.messages) {
    const role = turn.role.toUpperCase();
    lines.push(`[${role}] ${formatTime(turn.timestamp)}`);
    lines.push(turn.content);
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Format ISO date string for display.
 */
function formatDate(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleString();
}

/**
 * Format ISO date string as time.
 */
function formatTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleTimeString();
}

/**
 * Generate filename for export.
 */
export function generateExportFilename(
  session: AssistantSessionExtended,
  format: ExportFormat
): string {
  const date = new Date(session.createdAt);
  const dateStr = date.toISOString().split('T')[0];
  const timeStr = date.toTimeString().split(' ')[0].replace(/:/g, '-');
  const extension = format === 'markdown' ? 'md' : format === 'json' ? 'json' : 'txt';
  
  return `assistant-session-${dateStr}-${timeStr}.${extension}`;
}

/**
 * Trigger browser download of exported session.
 */
export function downloadExport(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  
  document.body.appendChild(link);
  link.click();
  
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Export and download session in one operation.
 */
export function exportAndDownload(
  session: AssistantSessionExtended,
  telemetry?: ToolInvocationRecord[],
  telemetryEvents?: AssistantTelemetryEvent[],
  options: ExportOptions = {}
): void {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const content = exportSession(session, telemetry, telemetryEvents, opts);
  const filename = generateExportFilename(session, opts.format);
  
  downloadExport(content, filename);
}

function toCanonicalMessage(sessionId: string, turn: ConversationTurn, index: number) {
  const metadata = isRecord(turn.metadata) ? turn.metadata : {};
  const messageId = resolveMessageId(sessionId, turn, metadata, index);
  const safetyClass = typeof metadata.safetyClass === 'string' ? metadata.safetyClass : null;
  const toolCandidate = 'tool' in metadata ? metadata.tool : undefined;
  const toolMeta = isRecord(toolCandidate) ? toolCandidate : null;
  const approvalsCandidate = 'approvals' in metadata ? metadata.approvals : undefined;
  const approvals = Array.isArray(approvalsCandidate) ? approvalsCandidate : [];

  return {
    id: messageId,
    role: turn.role,
    content: turn.content,
    createdAt: turn.timestamp,
    safetyClass,
    toolMeta,
    approvals
  };
}

function resolveMessageId(
  sessionId: string,
  turn: ConversationTurn,
  metadata: Record<string, unknown>,
  index: number
): string {
  const metadataWithIds = metadata as Record<string, unknown>;
  const metadataId = typeof metadataWithIds.id === 'string' ? metadataWithIds.id : null;
  const metadataMessageId = typeof metadataWithIds.messageId === 'string' ? metadataWithIds.messageId : null;
  const directId = metadataId ?? metadataMessageId;
  const turnIdCandidate = (turn as Partial<ConversationTurn> & { id?: unknown }).id;
  const turnId = typeof turnIdCandidate === 'string' ? turnIdCandidate : null;

  if (directId) {
    return directId;
  }

  if (turnId) {
    return turnId;
  }

  const paddedIndex = String(index + 1).padStart(4, '0');
  return `${sessionId}-msg-${paddedIndex}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

// Example usage:
// const markdown = exportSession(session, telemetry, telemetryEvents, { format: 'markdown' });
// exportAndDownload(session, telemetry, telemetryEvents, { format: 'markdown', includeTelemetry: true });
