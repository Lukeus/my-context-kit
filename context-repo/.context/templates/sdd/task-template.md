# Task: {{taskTitle}}

**Plan**: {{planNumber}}  
**Spec**: {{specNumber}}  
**Assigned**: {{assignedTo}}  
**Priority**: {{priority}}  
**Status**: Not Started

## Objective

{{objective}}

## Pre-Task Constitutional Validation

Before starting this task, verify compliance with constitutional articles:

### Article I: Library-First Principle
- [ ] Is this task adding functionality to an existing library?
- [ ] If creating new functionality, is it being built as a library first?
- [ ] Will this library be usable outside this project?

### Article II: CLI Interface Mandate
- [ ] Does this library expose a CLI?
- [ ] Does the CLI accept text input and produce text/JSON output?
- [ ] Is stdin/stdout properly supported?

### Article III: Test-First Development
- [ ] Are contract tests written and failing?
- [ ] Are integration tests written and failing?
- [ ] Are unit tests written and failing?
- [ ] **GATE**: Do NOT proceed to implementation until tests exist and are RED

### Article IV: Dependency Declaration
- [ ] Are all dependencies explicitly declared in package.json/requirements.txt?
- [ ] Are version constraints specified?
- [ ] No global dependencies required?

### Article V: JSON Configuration
- [ ] Configuration stored as JSON?
- [ ] Schema validation in place?
- [ ] No YAML/TOML/INI files?

### Article VI: Observability
- [ ] Structured logging implemented?
- [ ] Key metrics exposed (latency, errors, throughput)?
- [ ] Trace IDs propagated?

### Article VII: Simplicity
- [ ] Using ≤3 projects/services?
- [ ] No speculative/future-proofing features?
- [ ] Solving current problem only?

### Article VIII: Anti-Abstraction
- [ ] Using framework APIs directly (no wrappers)?
- [ ] Single representation per domain model?
- [ ] No unnecessary interfaces/protocols?

### Article IX: Integration-First
- [ ] Contract defined in contracts/ directory?
- [ ] Contract test written and integrated into CI?
- [ ] Real dependencies used in tests (no mocks)?

**Constitutional Gate**: [PASS/FAIL]

## Implementation Steps

### Step 1: [NEEDS CLARIFICATION - First Implementation Step]

**Action**: {{step1Action}}

**Acceptance Criteria**:
- [ ] [Criterion 1]
- [ ] [Criterion 2]

**Tests**:
- [ ] Test 1: [NEEDS CLARIFICATION]
- [ ] Test 2: [NEEDS CLARIFICATION]

### Step 2: [NEEDS CLARIFICATION - Second Implementation Step]

**Action**: {{step2Action}}

**Acceptance Criteria**:
- [ ] [Criterion 1]
- [ ] [Criterion 2]

**Tests**:
- [ ] Test 1: [NEEDS CLARIFICATION]
- [ ] Test 2: [NEEDS CLARIFICATION]

### Step 3: [NEEDS CLARIFICATION - Third Implementation Step]

**Action**: {{step3Action}}

**Acceptance Criteria**:
- [ ] [Criterion 1]
- [ ] [Criterion 2]

**Tests**:
- [ ] Test 1: [NEEDS CLARIFICATION]
- [ ] Test 2: [NEEDS CLARIFICATION]

## Validation & Testing

### Test Execution Order (TDD Cycle)

1. **Red Phase**: Verify all tests FAIL
   - [ ] Run tests and confirm they fail
   - [ ] Document failure modes
   - [ ] Get user approval to proceed

2. **Green Phase**: Implement to pass tests
   - [ ] Implement minimal code to pass tests
   - [ ] Verify all tests pass
   - [ ] No refactoring yet

3. **Blue Phase**: Refactor
   - [ ] Improve code quality
   - [ ] Verify tests still pass
   - [ ] Review with team

### Integration Validation
- [ ] Integration tests pass against real dependencies
- [ ] Contract tests validate external interfaces
- [ ] End-to-end workflow tested

### Performance Validation
- [ ] Latency meets requirements: [SPECIFY TARGET]
- [ ] Throughput meets requirements: [SPECIFY TARGET]
- [ ] Resource usage acceptable: [SPECIFY LIMITS]

## Dependencies

**Blocking Tasks**: {{blockingTasks}}

**Required Libraries**: {{requiredLibraries}}

**External Services**: {{externalServices}}

## Risk & Complexity Notes

**Complexity Warning**: [Document if this task requires >3 projects or introduces abstraction layers]

**Risks**:
- Risk 1: {{risk1}}
- Risk 2: {{risk2}}

**Mitigations**:
- Mitigation 1: {{mitigation1}}
- Mitigation 2: {{mitigation2}}

## Definition of Done

- [ ] All constitutional gates passed
- [ ] All tests written (contract, integration, unit)
- [ ] All tests verified to FAIL (Red phase)
- [ ] Implementation complete
- [ ] All tests PASS (Green phase)
- [ ] Code refactored (Blue phase)
- [ ] Observability instrumented (logs, metrics, traces)
- [ ] CLI interface tested
- [ ] Documentation updated
- [ ] Code reviewed and approved
- [ ] Deployed to test environment
- [ ] User acceptance validated

---

**Reminder**: Per Article III, implementation MUST NOT begin until all tests are written and failing. The tests define the contract.

**Estimated Effort**: {{estimatedHours}} hours

**Actual Effort**: [Track actual time spent]
