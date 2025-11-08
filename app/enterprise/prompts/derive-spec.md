# Derive Specification From Code

You are a software architect tasked with deriving a formal specification document from an existing codebase. Your goal is to analyze the code structure, patterns, and implementation details to produce a comprehensive spec that could have been written before the code.

## Context

- **Repository Path**: {{repoPath}}
- **Constitution Path**: {{constitutionPath}}
- **Include Tests**: {{includeTests}}
- **Include Documentation**: {{includeDocs}}

## Instructions

1. **Analyze the codebase structure**:
   - Identify main entry points and architectural patterns
   - Map out module dependencies and relationships
   - Note key abstractions, interfaces, and contracts
   - Identify design patterns in use

2. **Extract functional requirements**:
   - What does this code accomplish?
   - What are the primary use cases?
   - What are the user-facing features?
   - What business logic is implemented?

3. **Document technical specifications**:
   - Technology stack and dependencies
   - Data models and schemas
   - API contracts (internal and external)
   - State management approach
   - Error handling patterns
   - Security considerations

4. **Identify constraints and assumptions**:
   - Performance requirements (if evident)
   - Scalability considerations
   - Browser/platform compatibility
   - Regulatory or compliance requirements

5. **Generate the specification**:
   - Write in clear, structured markdown
   - Use headings, lists, and code blocks appropriately
   - Be specific and avoid vague language
   - Include diagrams where helpful (mermaid syntax)
   - Cross-reference with constitution principles

## Output Format

```markdown
# Specification: {{projectName}}

## Overview
[High-level description of what this system does]

## Functional Requirements
### FR-1: [Requirement Name]
**Description**: [What it does]
**Acceptance Criteria**:
- [ ] Criterion 1
- [ ] Criterion 2

### FR-2: [Next Requirement]
...

## Technical Architecture
### Technology Stack
- **Frontend**: [frameworks, libraries]
- **Backend**: [services, APIs]
- **Data**: [storage, caching]

### System Components
[Describe major components and their responsibilities]

### Data Models
```typescript
// Key interfaces and types
```

## API Contracts
### Endpoint: [Name]
- **Method**: GET/POST/etc.
- **Path**: /api/path
- **Request**: [schema]
- **Response**: [schema]

## Non-Functional Requirements
### Performance
- [Specific performance targets]

### Security
- [Security requirements]

### Scalability
- [Scaling considerations]

## Constraints
- [Technical constraints]
- [Business constraints]

## Assumptions
- [Key assumptions made]

## Future Considerations
- [Potential enhancements]
- [Known limitations]
```

## Important Notes

- **Accuracy**: Base the spec on what the code actually does, not on assumptions
- **Constitution Compliance**: Ensure the derived spec aligns with organizational standards
- **Completeness**: Cover all major functional areas
- **Clarity**: Write for an audience that hasn't seen the code
- **Actionability**: The spec should be sufficient to rebuild the system

## Variables

- `{{repoPath}}`: Absolute path to the repository being analyzed
- `{{constitutionPath}}`: Path to constitution file (if provided)
- `{{projectName}}`: Name of the project/repository
- `{{includeTests}}`: Whether to analyze test files for requirements
- `{{includeDocs}}`: Whether to include existing documentation
