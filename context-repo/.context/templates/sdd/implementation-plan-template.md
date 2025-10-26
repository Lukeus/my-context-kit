# Implementation Plan: {{specTitle}}

**Spec**: {{specNumber}}  
**Tech Stack**: {{techStack}}  
**Date**: {{date}}  
**Status**: Draft

## Requirements Summary

{{requirements}}

## User Stories

{{userStories}}

## Phase -1: Pre-Implementation Gates

### Simplicity Gate (Article VII)
- [ ] Using ≤3 projects? [Document if >3]
- [ ] No future-proofing? [Document speculative features]

### Anti-Abstraction Gate (Article VIII)
- [ ] Using framework directly? [Document wrappers/abstractions]
- [ ] Single model representation? [Document data model duplication]

### Integration-First Gate (Article IX)
- [ ] Contracts defined? [Link to contracts/]
- [ ] Contract tests written? [Link to test files]

**Gate Status**: [PASS/FAIL]

## Phase 0: Test Scaffolds (TDD-First)

Per Article III of the Constitution, tests MUST be written and validated before implementation.

### Contract Tests
- [ ] API contract tests (if applicable)
- [ ] Service contract tests
- [ ] Interface contracts defined

### Integration Tests
- [ ] Database integration tests (use real DB, not mocks)
- [ ] External service integration tests
- [ ] End-to-end workflow tests

### Unit Tests
- [ ] Core business logic tests
- [ ] Edge case coverage
- [ ] Error handling tests

**Test-First Checklist:**
1. Write contracts → contract tests
2. Write integration tests
3. Write unit tests
4. Verify all tests FAIL (Red phase)
5. Get user approval
6. Implement to make tests pass (Green phase)
7. Refactor (Blue phase)

## Phase 1: Core Implementation

[Detail implementation steps here]

### Libraries to Create
Per Article I (Library-First Principle), features begin as standalone libraries:

- [ ] Library 1: [Name and purpose]
- [ ] Library 2: [Name and purpose]
- [ ] Library 3: [Name and purpose, or document why >3 needed]

### CLI Interfaces
Per Article II (CLI Interface Mandate), each library must expose CLI:

- [ ] CLI for Library 1 (text I/O, JSON support)
- [ ] CLI for Library 2 (text I/O, JSON support)

### Dependencies
Per Article IV (Dependency Declarations):

**Declared Dependencies:**
```json
{
  "dependencies": {
    // List all dependencies with versions
  }
}
```

- [ ] All dependencies declared in package.json/requirements.txt
- [ ] No undeclared global dependencies

## Phase 2: Integration & Refinement

[Detail integration steps here]

### Observability
Per Article VI (Observability Requirements):

- [ ] Structured logging implemented
- [ ] Key metrics exposed (performance, errors, usage)
- [ ] Trace IDs propagated across services

## Complexity Tracking

Document any gates that failed and justification:

- **Gate**: [Name]
- **Status**: FAIL
- **Justification**: [Why this complexity is necessary]
- **Mitigation**: [How we minimize impact]
- **Approvers**: [Who approved this exception]

## Non-Functional Requirements

### Performance
- Target latency: [SPECIFY]
- Target throughput: [SPECIFY]
- Resource constraints: [SPECIFY]

### Security
- Authentication: [SPECIFY]
- Authorization: [SPECIFY]
- Data encryption: [SPECIFY]
- Secrets management: [SPECIFY]

### Scalability
- Expected load: [SPECIFY]
- Scaling strategy: [SPECIFY]

---

**Implementation Order:**
1. Write contracts → contract tests
2. Write integration tests
3. Write unit tests
4. Verify all tests FAIL (Red phase)
5. Get user approval
6. Implement to make tests pass (Green phase)
7. Refactor (Blue phase)
8. Deploy with observability

**Constitutional Compliance**: This plan must pass all Phase -1 gates before implementation begins.
