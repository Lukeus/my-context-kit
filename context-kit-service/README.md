# Context Kit Service

Python FastAPI sidecar service for Context Kit pipeline orchestration with LangChain integration.

## Overview

The Context Kit Service provides AI-powered endpoints for:
- **Context Inspection**: Analyze repository structure and entity relationships
- **Spec Generation**: Generate technical specifications from requirements
- **Promptification**: Convert specs into agent-ready prompts
- **Code Generation**: Generate implementation artifacts from specifications

All operations are logged to `.context-kit/spec-log/` for traceability.

## Prerequisites

- **Python**: 3.11 or higher
- **uv**: Fast Python package installer and environment manager
- **pnpm**: For integration with the monorepo workspace

## Installation

### Using pnpm (Recommended)

The service is integrated with the pnpm monorepo workspace:

```powershell
# Bootstrap uv if not installed
cd context-kit-service
pnpm run bootstrap

# Setup development environment
pnpm run setup:dev

# Start the service
pnpm start
```

### Manual Installation

```powershell
# Install uv
irm https://astral.sh/uv/install.ps1 | iex

# Create virtual environment and install dependencies
uv venv
uv pip install -e .[dev]

# Start the service
uv run uvicorn context_kit_service.main:app --reload
```

## Available Scripts

All scripts can be run via `pnpm run <script>`:

- `setup`: Install production dependencies
- `setup:dev`: Install production + development dependencies
- `start`: Start the production server (port 8000)
- `dev`: Start development server with hot reload
- `test`: Run pytest test suite
- `test:cov`: Run tests with coverage report
- `lint`: Check code with ruff
- `lint:fix`: Auto-fix linting issues
- `format`: Format code with ruff
- `typecheck`: Run mypy type checking
- `clean`: Remove generated files and virtual environment
- `freeze`: Show installed package versions
- `health`: Check if service is running
- `bootstrap`: Install uv if not present

## Project Structure

```
context-kit-service/
├── src/
│   └── context_kit_service/
│       ├── main.py                 # FastAPI application
│       ├── models/                 # Pydantic models
│       │   ├── requests.py         # Request models
│       │   └── responses.py        # Response models
│       ├── endpoints/              # API route handlers
│       │   ├── inspect.py          # Context inspection
│       │   ├── spec.py             # Spec generation
│       │   ├── promptify.py        # Promptification
│       │   └── codegen.py          # Code generation
│       └── services/               # Business logic
│           ├── context_loader.py   # Context repository loading
│           ├── spec_generator.py   # LangChain spec generation
│           ├── promptifier.py      # Prompt engineering
│           ├── code_generator.py   # Code artifact generation
│           └── spec_log_writer.py  # Spec log persistence
├── tests/                          # Unit and integration tests
│   ├── conftest.py                 # Test fixtures
│   ├── test_context_loader.py     # Context loader tests
│   ├── test_spec_log_writer.py    # Spec log tests
│   └── test_api.py                 # API endpoint tests
├── pyproject.toml                  # Python project configuration
├── package.json                    # pnpm integration
└── README.md                       # This file
```

## API Endpoints

### Health Check

```
GET /health
```

Returns service status and dependency information.

### Context Inspection

```
POST /context/inspect
```

**Request:**
```json
{
  "repo_path": "/path/to/context-repo",
  "include_types": ["feature", "userstory"],
  "depth": 2
}
```

**Response:**
```json
{
  "overview": {
    "total_entities": 10,
    "by_type": {"feature": 3, "userstory": 5, "spec": 2},
    "by_status": {"in-progress": 5, "done": 3, "todo": 2}
  },
  "entities": [...],
  "relationships": {...},
  "gaps": [...],
  "recommendations": [...],
  "duration_ms": 150
}
```

### Specification Generation

```
POST /spec/generate
```

**Request:**
```json
{
  "repo_path": "/path/to/context-repo",
  "entity_ids": ["FEAT-001", "US-001"],
  "user_prompt": "Create a detailed technical specification",
  "template_id": "feature-spec",
  "include_rag": true
}
```

**Response:**
```json
{
  "spec_id": "SPEC-abc123",
  "spec_content": "# Technical Specification...",
  "related_entities": ["FEAT-001", "US-001"],
  "metadata": {...},
  "log_entry_id": "log-xyz789",
  "duration_ms": 2500
}
```

### Promptification

```
POST /spec/promptify
```

**Request:**
```json
{
  "repo_path": "/path/to/context-repo",
  "spec_id": "SPEC-001",
  "target_agent": "codegen",
  "include_context": true
}
```

**Response:**
```json
{
  "spec_id": "SPEC-001",
  "prompt": "Task: Implement SPEC-001...",
  "context_included": ["FEAT-001", "US-001"],
  "metadata": {...},
  "log_entry_id": "log-xyz789",
  "duration_ms": 800
}
```

### Code Generation

```
POST /codegen/from-spec
```

**Request:**
```json
{
  "repo_path": "/path/to/context-repo",
  "spec_id": "SPEC-001",
  "language": "typescript",
  "framework": "vue",
  "style_guide": "Material 3"
}
```

**Response:**
```json
{
  "spec_id": "SPEC-001",
  "artifacts": [
    {
      "path": "src/component.ts",
      "content": "// Generated code...",
      "language": "typescript",
      "description": "Main implementation"
    }
  ],
  "summary": "Generated 2 files",
  "metadata": {...},
  "log_entry_id": "log-xyz789",
  "duration_ms": 3500
}
```

## Testing

Run the full test suite:

```powershell
pnpm test
```

Run with coverage:

```powershell
pnpm test:cov
```

The test suite includes:
- Unit tests for all service classes
- Integration tests for API endpoints
- Fixtures for temporary repository structures
- Tests for spec log persistence

## Development

### Hot Reload Development

```powershell
pnpm dev
```

This starts uvicorn with `--reload` flag, automatically restarting on code changes.

### Code Quality

Run linting and type checking:

```powershell
pnpm lint
pnpm typecheck
```

Auto-fix issues:

```powershell
pnpm lint:fix
pnpm format
```

### Adding Dependencies

```powershell
# Add to pyproject.toml, then:
uv pip install -e .

# Or use uv directly:
uv pip install <package-name>
uv pip freeze
```

## Integration with Electron

The Context Kit Service is designed to run as a sidecar process managed by the Electron main process:

1. **Lifecycle Management**: `ContextKitServiceClient` (to be implemented in Milestone C) spawns the service on app start
2. **Health Monitoring**: Periodic health checks via `/health` endpoint
3. **IPC Bridge**: Electron main process forwards renderer requests to the service
4. **Environment Cleanup**: `uv venv remove` on app quit to clean up virtual environment

## Configuration

Service configuration can be provided via:
- Environment variables
- `.context-kit/` YAML files (project.yml, stack.yml, domains.yml, prompts.yml)
- Model configuration overrides in requests

## Logging

- Application logs: stdout/stderr (captured by uvicorn)
- Spec generation logs: `.context-kit/spec-log/*.json`
- Error tracking: FastAPI exception handlers

## Future Enhancements

- [ ] Implement full LangChain integration for spec generation
- [ ] Add RAG vector search with embeddings
- [ ] Streaming responses for long-running operations
- [ ] WebSocket support for real-time updates
- [ ] Authentication and API key support
- [ ] Rate limiting and request throttling
- [ ] Telemetry and metrics collection

## License

MIT

## Contributing

See main repository CONTRIBUTING.md for guidelines.

---

**Status**: MVP Implementation (Milestone B Complete)  
**Last Updated**: 2025-10-31
