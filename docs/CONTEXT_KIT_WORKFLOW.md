# Context Kit Workflow Guide

## Overview

Context Kit is an AI-powered specification generation and code synthesis pipeline that helps developers generate detailed specifications and production-ready code from natural language requirements.

## Architecture

```
┌─────────────────┐
│   Electron UI   │
│  (Vue 3 + TS)   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Context Kit    │
│    Service      │
│  (FastAPI)      │
└────────┬────────┘
         │
    ┌────┴────┐
    ▼         ▼
┌────────┐ ┌─────────┐
│LangChain│ │Azure AI │
│  RAG   │ │ OpenAI  │
└────────┘ └─────────┘
```

## Complete Workflow

### 1. Setup and Configuration

#### Start the Service

1. Open the Context Kit Hub in the Electron app
2. Click **Start Service** to launch the FastAPI backend
3. Wait for the service status to show "Healthy"

#### Configure API Keys

The service supports Azure OpenAI. Configure via environment variables:

```bash
# .env file in context-kit-service/
AZURE_OPENAI_API_KEY=your-api-key-here
AZURE_OPENAI_ENDPOINT=https://your-endpoint.openai.azure.com/
AZURE_OPENAI_DEPLOYMENT_NAME=gpt-4  # Optional, defaults to gpt-4
```

Alternatively, the Electron app stores API keys securely in Windows Credential Manager.

### 2. Repository Inspection

**Purpose:** Analyze your repository structure to understand entities, relationships, and context.

1. Navigate to **Repository Inspector**
2. Select your repository path
3. Configure inspection parameters:
   - **Include Types:** Filter specific entity types (e.g., `feature`, `component`, `api`)
   - **Depth:** How deep to traverse relationships (default: 2)
4. Click **Inspect**

**Output:**
- Entity overview (total count by type and status)
- Entity list with relationships
- Gap analysis (missing or incomplete entities)
- Recommendations for improvement

**Example Use Case:**
```
Repository: my-web-app
Entities Found: 45 (12 features, 18 components, 15 APIs)
Gaps: Missing test specs for Auth feature
Recommendations: Add integration tests for payment flow
```

### 3. Specification Generation

**Purpose:** Generate detailed technical specifications from natural language requirements.

1. Navigate to **Prompt Builder** or use the **Spec Wizard**
2. Select entities to include in context (from inspection results)
3. Enter your natural language requirement:

   ```
   Create a user authentication feature with email/password login,
   JWT token management, and password reset functionality.
   Include comprehensive error handling and rate limiting.
   ```

4. Optional: Select a specification template (if available)
5. Click **Generate Spec**

**What Happens:**
- The service loads relevant context entities via RAG
- Azure OpenAI generates a structured specification
- The spec is persisted to `.context-kit/spec-log/`
- Related entities are linked automatically

**Generated Spec Includes:**
- Feature description and objectives
- Technical requirements and constraints
- API endpoints and data models
- Security considerations
- Test requirements
- Implementation steps

### 4. Promptification (Optional)

**Purpose:** Transform the specification into an optimized prompt for code generation agents.

1. Navigate to **Prompt Builder**
2. Select the generated spec from the dropdown
3. Choose target agent type (default: `codegen`)
4. Click **Promptify**

**Output:**
- Structured prompt with context
- Includes relevant code examples from your repository
- Formatted for optimal LLM understanding

### 5. Code Generation

**Purpose:** Generate production-ready code artifacts from specifications.

1. Navigate to **Code Generator**
2. Select the specification (or promptified version)
3. Configure generation parameters:
   - **Language:** TypeScript, Python, etc.
   - **Framework:** React, FastAPI, etc.
   - **Style Guide:** Your coding standards
4. Click **Generate Code**

**What Happens:**
- Azure OpenAI generates code based on the spec
- Multiple artifacts are created (components, tests, APIs)
- Code follows your repository's patterns and conventions
- All artifacts are logged to `.context-kit/spec-log/`

**Generated Artifacts May Include:**
- React components with TypeScript
- API route handlers
- Database models/schemas
- Unit and integration tests
- Configuration files

### 6. Review and Apply

1. Review generated code in the Code Generator UI
2. Copy individual artifacts or download all
3. Apply to your repository:
   ```bash
   # Code is not automatically written to avoid conflicts
   # Review first, then manually copy or use git
   ```

4. Run linting and tests:
   ```bash
   npm run lint
   npm run typecheck
   npm test
   ```

### 7. Spec Log Browser

**Purpose:** Browse historical generation sessions and reuse past specifications.

1. Navigate to **Spec Log Browser**
2. View chronological list of all operations
3. Filter by operation type, date, or status
4. Click any entry to view full details
5. Reuse past specs for iteration or reference

## Best Practices

### Writing Effective Requirements

**Good Example:**
```
Create a shopping cart feature that allows users to:
- Add products with quantity selection (1-99)
- Update quantities or remove items
- View real-time price calculations including tax
- Save cart state between sessions
- Apply discount codes with validation

Technical constraints:
- Must work offline with local storage
- Support for 10,000+ SKUs
- Response time < 200ms for all operations
```

**Poor Example:**
```
Make a cart thing that people can use to buy stuff.
```

### Iterative Refinement

1. Start with a high-level spec
2. Generate code
3. Review and identify gaps
4. Create a new spec addressing gaps
5. Regenerate specific components

### Context Management

- Keep your context repository up to date
- Document architectural decisions
- Link related features explicitly
- Use consistent entity naming

## Troubleshooting

### Service Won't Start

**Symptom:** Service status shows "Offline" or "Degraded"

**Solutions:**
1. Check Python dependencies:
   ```bash
   cd context-kit-service
   pip install -r requirements.txt
   ```

2. Verify port 8000 is available:
   ```bash
   netstat -ano | findstr :8000
   ```

3. Check service logs in `.context-kit/logs/`

### API Key Errors

**Symptom:** "Missing API key" or "Invalid credentials"

**Solutions:**
1. Verify environment variables are set
2. Check Windows Credential Manager for stored keys
3. Ensure Azure OpenAI endpoint is correct
4. Verify API key has proper permissions

### Generation Timeouts

**Symptom:** "Request timed out" during spec or code generation

**Solutions:**
1. Reduce context scope (fewer entities)
2. Simplify the requirement prompt
3. Check Azure OpenAI quota limits
4. Increase timeout in service configuration

### Empty or Poor Quality Output

**Symptom:** Generated specs lack detail or code is incomplete

**Solutions:**
1. Provide more detailed requirements
2. Include more relevant context entities
3. Use specification templates
4. Verify RAG is loading appropriate context

## API Reference

### Service Endpoints

#### Health Check
```
GET /health
Response: { "status": "healthy", "uptime": 12345 }
```

#### Inspect Repository
```
POST /inspect
Body: {
  "repo_path": "C:/path/to/repo",
  "include_types": ["feature", "component"],
  "depth": 2
}
```

#### Generate Specification
```
POST /spec-generate
Body: {
  "repo_path": "C:/path/to/repo",
  "entity_ids": ["feature-001", "component-002"],
  "user_prompt": "Create authentication feature...",
  "template_id": "feature-spec-v1",
  "include_rag": true
}
```

#### Promptify Specification
```
POST /promptify
Body: {
  "repo_path": "C:/path/to/repo",
  "spec_id": "spec-20250131-001",
  "spec_content": "...",
  "target_agent": "codegen",
  "include_context": true
}
```

#### Generate Code
```
POST /codegen
Body: {
  "repo_path": "C:/path/to/repo",
  "spec_id": "spec-20250131-001",
  "prompt": "...",
  "language": "typescript",
  "framework": "react",
  "style_guide": "airbnb"
}
```

#### List Spec Logs
```
GET /spec-log/list?operation=spec-generate&limit=50
Response: {
  "entries": [...],
  "total": 123
}
```

## File Structure

```
.context-kit/
├── spec-log/              # Generation history
│   ├── 20250131-001.json
│   ├── 20250131-002.json
│   └── ...
├── templates/             # Spec templates
│   ├── feature-spec.md
│   ├── api-spec.md
│   └── ...
└── logs/                  # Service logs
    └── service.log
```

## Advanced Usage

### Custom Templates

Create custom specification templates in `.context-kit/templates/`:

```markdown
# Feature Specification: {{ feature_name }}

## Overview
{{ overview }}

## Requirements
{{ requirements }}

## Technical Design
{{ technical_design }}

## Testing Strategy
{{ testing_strategy }}
```

### Batch Generation

Generate multiple specs from a list:

```typescript
const requirements = [
  "User authentication",
  "Product catalog",
  "Shopping cart"
];

for (const req of requirements) {
  await contextKitStore.generateSpec(
    repoPath,
    relevantEntityIds,
    req,
    "feature-spec-v1"
  );
}
```

### Integration with CI/CD

```yaml
# .github/workflows/spec-check.yml
name: Spec Coverage Check

on: [pull_request]

jobs:
  check-specs:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Start Context Kit Service
        run: |
          cd context-kit-service
          uvicorn main:app &
      - name: Verify Spec Coverage
        run: |
          # Custom script to check all features have specs
          python scripts/verify-spec-coverage.py
```

## Support

For issues, questions, or feature requests:
- Check the main README.md
- Review Sprint documentation in `docs/sprints/`
- Examine service logs in `.context-kit/logs/`

---

**Last Updated:** January 31, 2025  
**Version:** 1.0.0
