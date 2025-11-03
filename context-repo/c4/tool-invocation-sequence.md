# Sequence Diagram: Tool Invocation & Gating (Unified Assistant)

<!-- Created 2025-11-03 (T081). References FR-032, FR-032a, FR-039, FR-040, FR-041, FR-022, FR-030. -->

```mermaid
sequenceDiagram
    autonumber
    participant U as User
    participant UA as UnifiedAssistant.vue
    participant AS as assistantStore
    participant QM as queueManager
    participant CL as SidecarClientAdapter
    participant SC as Python Sidecar (FastAPI)
    participant TP as TelemetryEmitter
    participant GA as GatingArtifactReader
    participant EP as EmbeddingsPipelineScript

    U->>UA: Initiate Tool Execution
    UA->>AS: requestExecution(toolId, safetyClass)
    AS->>AS: validate classification (FR-032/032a)
    AS->>GA: read gate-status.json (FR-040)
    alt gating blocks tool
        GA-->>AS: classificationEnforced=false
        AS-->>UA: show Limited Read-Only banner (FR-011)
        return
    end
    AS->>QM: enqueue(toolInvocation)
    QM->>CL: dispatch when slot available (<=3 active) (FR-022)
    CL->>SC: POST /assistant/tools/{toolId}
    SC-->>CL: 202 Accepted (taskId)
    loop stream (optional)
        SC-->>CL: SSE chunk
        CL-->>TP: telemetry stream.chunk
        CL-->>AS: update partial output
    end
    SC-->>CL: Final result (success|error)
    CL-->>TP: telemetry tool.executed {durationMs, outcome, safetyClass}
    TP-->>GA: update gating fields (sidecarOnly, classificationEnforced)
    opt embeddings pipeline triggered
        UA->>EP: start embeddings build (FR-039)
        EP->>EP: generate & sort vectors
        EP->>TP: emit checksum telemetry
        TP->>GA: write checksumMatch
    end
    GA-->>AS: gating artifact refreshed
    AS-->>UA: render result & status transitions (FR-009)
    UA-->>U: show summary or timeout formatting (FR-041 on error)
```

## Notes
- Partial retry path (FR-030) not shown; extension adds user selection before queue enqueue.
- Large output summarization (FR-010/FR-037) occurs inside AS before final render if thresholds triggered.
- RAG features remain disabled (TODO:RAG_ENABLE) until GA reports checksumMatch=true.

<!-- TODO: Add failure branch for network timeouts including formatted duration (FR-041) and fallback classification enforcement indicator. -->