# Data Model: Assistant Sidecar Unification

**Branch**: 001-assistant-sidecar-unify  
**Date**: 2025-11-02  
**Spec Reference**: ./spec.md
**Research Reference**: ./research.md

## Overview
Normalized entities required for unified assistant operations, migration, tooling, and telemetry. No relational DB; persistence via Git versioned artifacts (pipelines) and in-memory session state. Some records (telemetry summaries) may be persisted as JSON for audit.

## Entities

### 1. AssistantSession
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| id | string | yes | Unique session identifier (UUID) |
| provider | string | yes | Active provider id (azure-openai, ollama, etc.) |
| systemPrompt | string | yes | Prompt applied to session |
| createdAt | ISO datetime | yes | Session creation time |
| messages | ConversationMessage[] | yes | Ordered transcript entries |
| tools | ToolInvocation[] | yes | Tool runs linked to session |
| approvals | PendingApproval[] | yes | Outstanding or resolved approvals |
| telemetry | TelemetryEvent[] | yes | Events captured for observability |
| migratedFrom | string | no | Legacy source id if migrated |
| streamingEnabled | boolean | yes | Per-session streaming toggle |
| modeTagsEnabled | boolean | yes | Whether improvement/clarification/general tags active |
| capabilityVersion | string | yes | Sidecar capability manifest version at session start |

Validation Rules:
- messages, tools, approvals, telemetry initialize empty arrays
- provider must be among supported provider list from manifest
- systemPrompt length <= 10k chars

### 2. ConversationMessage
| Field | Type | Required | Description |
| role | enum(user|assistant) | yes | Author role |
| id | string | yes | Unique message id |
| content | string | yes | Plain text content |
| createdAt | ISO datetime | yes | Timestamp |
| mode | enum(improvement|clarification|general) | no | Tag for legacy parity |
| references | Reference[] | no | Linked context items |
| suggestions | EditSuggestion[] | no | Proposed edits tied to content |
| streaming | boolean | yes | Whether message was streamed |
| provider | string | no | Provider at generation time |
| tokensConsumed | number | no | Token count metadata |

Constraints:
- content non-empty
- If streaming=true, tokensConsumed recorded when complete

### 3. ToolInvocation
| Field | Type | Required | Description |
| id | string | yes | Unique invocation id |
| sessionId | string | yes | Linking back to session |
| toolId | string | yes | Tool identifier (validate, build-graph, impact, generate, etc.) |
| status | enum(queued|running|succeeded|failed|canceled) | yes | Execution status |
| paramsSummary | string | no | Redacted parameter summary |
| queuedAt | ISO datetime | yes | When added |
| startedAt | ISO datetime | no | When execution began |
| finishedAt | ISO datetime | no | Completion time |
| durationMs | number | no | (finishedAt - startedAt) |
| resultSummary | string | no | Human-readable summary |
| errorDetail | string | no | Error info if failed |
| source | string | yes | Always "sidecar" for this feature |
| tokensConsumed | number | no | If tool invoked model internally |

Derived:
- durationMs computed post-completion
- status transitions: queued -> running -> (succeeded|failed|canceled)

### 4. PendingApproval
| Field | Type | Required | Description |
| id | string | yes | Approval id |
| type | enum(edit-apply|file-write|destructive-action) | yes | Approval category |
| status | enum(pending|approved|denied|expired) | yes | Current state |
| createdAt | ISO datetime | yes | Creation time |
| decidedAt | ISO datetime | no | Decision timestamp |
| diffSummary | string | no | Short textual diff summary |
| rationale | string | no | User-provided reason on deny |
| relatedToolInvocationId | string | no | Link back to tool if originating there |

### 5. EditSuggestion
| Field | Type | Required | Description |
| id | string | yes | Suggestion id |
| filePath | string | yes | Target file path |
| diff | string | yes | Unified diff (full file or summarized) |
| summary | string | no | Short description |
| applied | boolean | yes | Whether applied |
| appliedAt | ISO datetime | no | Timestamp when applied |

Rules:
- diff size triggers summarization hints if summarized
- applied transitions false -> true only after approval

### 6. MigrationRecord
| Field | Type | Required | Description |
| id | string | yes | Migration id |
| source | string | yes | Legacy store identifier |
| importedAt | ISO datetime | yes | Start time |
| completedAt | ISO datetime | no | Completion time |
| totalMessagesFound | number | yes | Legacy messages scanned |
| totalMessagesImported | number | yes | Messages imported |
| deduplicatedCount | number | yes | Removed duplicates |
| status | enum(succeeded|failed|partial) | yes | Outcome |
| errorDetail | string | no | Error info if failed |

### 7. TelemetryEvent
| Field | Type | Required | Description |
| eventId | string | yes | Unique event id |
| eventType | enum(tool-invocation|approval-decision|migration|stream-start|stream-complete|error) | yes | Kind |
| timestamp | ISO datetime | yes | Event time |
| sessionId | string | no | Session linkage when applicable |
| outcome | enum(success|failure|n/a) | no | Outcome classification |
| durationMs | number | no | Duration for applicable events |
| provider | string | no | Provider involved |
| streaming | boolean | no | If streaming event |
| tokensConsumed | number | no | Token usage |
| capabilityVersion | string | no | Manifest version |

### 8. CapabilityManifest
| Field | Type | Required | Description |
| version | string | yes | Semantic version |
| supportedTools | string[] | yes | Tool ids available |
| unsupportedTools | string[] | no | Tools intentionally disabled |
| providerCapabilities | ProviderCapability[] | yes | Per provider features |
| generatedAt | ISO datetime | yes | Timestamp |

#### ProviderCapability
| Field | Type | Required | Description |
| provider | string | yes | Provider id |
| streaming | boolean | yes | Streaming support |
| tools | string[] | yes | Tool ids allowed |
| embeddings | boolean | yes | Embeddings support |
| tokenMetadata | boolean | yes | Token usage metadata support |
| limitedMode | boolean | yes | Whether provider only partial capability |

## Relationships
- AssistantSession has many ConversationMessage, ToolInvocation, PendingApproval, TelemetryEvent.
- ConversationMessage may have many EditSuggestion.
- ToolInvocation may create PendingApproval(s) and TelemetryEvent(s).
- MigrationRecord stands alone; references sessions indirectly through imported messages.
- CapabilityManifest informs validation for provider/tool compatibility during session creation.

## State Transitions Highlights
- ToolInvocation: queued -> running -> succeeded|failed|canceled.
- PendingApproval: pending -> approved|denied|expired.
- EditSuggestion: applied false -> true after approval event.
- MigrationRecord: (in-progress implicit) -> succeeded|failed|partial.

## Validation & Rules Summary
- All IDs must be UUIDv4 format.
- Timestamps must be ISO8601.
- Provider must match a ProviderCapability entry.
 - Large diff summarization triggers if (total lines >800 OR raw size >100KB) unified threshold matching FR-037.
- Concurrency: enforce <=3 running ToolInvocation per session.
- p95 thresholds: validate <3s, build-graph <5s, impact <7s, generate <4s (used for telemetry alerting).

## Derived / Computed Metrics
- Session success rate = succeeded tool invocations / total tool invocations.
- Migration preservation accuracy = totalMessagesImported / totalMessagesFound.
 - Provider performance snapshot: average streaming initial latency from stream-start to first token event (sample size ≥30, p95 <300ms per SC-005). Atomic state integrity metric: number of partial session mutations MUST remain 0.

## Security & Privacy Considerations
- No sensitive content persisted outside Git repository context; approvals require explicit confirmation.
- Telemetry excludes raw prompt text beyond internal logging (store length only) to avoid leakage.

## Open Items
None.
