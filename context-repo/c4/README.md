# C4 Architecture Diagrams

This directory contains C4 architecture diagrams using Mermaid syntax. The diagrams are automatically validated against existing context entities and generate JSON projections.

## Quick Start

```bash
# Validate all C4 diagrams
pnpm c4

# Output artifacts are written to c4/out/
```

## Diagram Format

C4 diagrams use Mermaid flowchart syntax with a special header directive.

**Example structure** (see `context-sync-mvp.md` for a real example):

1. Create a markdown file in `c4/` directory
2. Add a Mermaid code block with `%% c4:` header:
   - `system=YourSystem` (required)
   - `level=C2` (required: C1, C2, C3, or C4)
   - `feature=FEAT-XXX` (optional: link to feature)
3. Use node format: `Name[label :: kind :: technology]`
4. Use relationships: `A -->|description| B`

### Header Attributes

- **system** (required): System name
- **level** (required): C4 level (C1=Context, C2=Container, C3=Component, C4=Code)
- **feature** (optional): Link to feature ID (e.g., `FEAT-042`)
- **specs** (optional): Array of spec IDs (e.g., `[SPEC-123,SPEC-124]`)
- **stories** (optional): Array of user story IDs (e.g., `[US-101,US-102]`)

### Node Format

Nodes follow the pattern: `label :: kind :: technology`

**Supported kinds:**
- `system` - External systems
- `container` - Containers (services, apps)
- `component` - Components within containers
- `datastore` - Databases, caches
- `queue` - Message queues, event hubs
- `external` - External/planned components (not validated)

### Relationship Labels

Edge labels support special patterns:

- **REST paths**: `REST /api/invoices` → extracts `restPath: "/api/invoices"`
- **Event emission**: `emit invoice.created.v1` → extracts `emit: ["invoice.created.v1"]`
- **Event consumption**: `consume invoice.created.v1` → extracts `consume: ["invoice.created.v1"]`

## Validation Rules

The C4 pipeline validates diagrams against existing context entities:

### Cross-Reference Validation

1. **Feature references**: `feature=FEAT-042` must exist in `contexts/features/`
2. **Spec references**: `specs=[SPEC-123]` must exist in `contexts/specs/`
3. **Story references**: `stories=[US-101]` must exist in `contexts/userstories/`
4. **Service nodes**: Nodes with `kind=container` ending in `-svc` must exist in `contexts/services/`

### External Nodes

Nodes marked as `external` are **not validated** against context entities. Use this for:
- Planned services not yet implemented
- Third-party systems
- Future architecture

## Output Artifacts

The pipeline generates:

### JSON Projections

`c4/out/<path>/<file>.0.json` - Machine-readable representation:

```json
{
  "system": "Billing",
  "level": "C2",
  "feature": "FEAT-042",
  "nodes": [
    {
      "id": "BLL",
      "name": "billing-svc",
      "kind": "container",
      "tech": ".NET"
    }
  ],
  "relationships": [
    {
      "source": "UI",
      "target": "BLL",
      "description": "REST /api/invoices",
      "restPath": "/api/invoices"
    }
  ],
  "sourceDiagram": "c4/examples/billing-system.md"
}
```

## CI/CD Integration

The C4 validation runs in GitHub Actions **before** the main validation:

```yaml
jobs:
  c4:
    # Validates C4 diagrams first
  validate:
    needs: c4  # Runs after C4 validation
```

This ensures **architecture drift** is caught early in PRs.

## Example

See `context-sync-mvp.md` for the real Context-Sync application architecture.

## Best Practices

1. **Start with C2 (Container level)** for most system architectures
2. **Use `external` kind** for services not yet in `contexts/services/`
3. **Link diagrams to features** using `feature=FEAT-XXX` for traceability
4. **Extract REST paths and events** in relationship labels for API/event validation
5. **One system per file** - keeps diagrams focused and maintainable

## Future Enhancements (Option B)

After Option A is working, we'll add:
- Optional `architecture.c4Diagram` property in feature/spec schemas
- Bidirectional links: features → diagrams
- SVG/PNG rendering with `mermaid-cli`
- Auto-generated architecture documentation index
