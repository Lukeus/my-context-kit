# Changelog

All notable changes to Context-Sync will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Enterprise-grade GitHub release workflow with multi-platform builds
- CHANGELOG.md for tracking version history
- Release documentation (RELEASING.md)

## [0.1.0] - 2025-10-24

### Added

#### Phase 9: Context Building & Generation ✅
- Multi-step wizard modal for entity creation
- AI-assisted entity generation with Ollama and Azure OpenAI
- Streaming AI responses with real-time token display
- Token probability viewer for Azure OpenAI (confidence visualization)
- Smart suggestions for domains and relationships
- Template library with 7 pre-built entity patterns
- Secure credential storage with OS-level encryption (Windows Credential Manager)
- Auto-commit and feature branch creation
- Bulk entity creation mode
- Configurable AI prompts via UI
- Smart edit suggestions with pre-validation

#### AI Assistant (Enhanced)
- Context-aware multi-turn conversations
- Smart YAML edit proposals with validation
- Auto-refresh YAML editor after AI edits
- Enhanced diff viewer with syntax highlighting
- Pre-edit validation for YAML syntax

#### Phase 8: Polish & Documentation ✅
- Error handling for network and file I/O
- Loading states and spinners
- Keyboard shortcuts (Ctrl+N, Ctrl+S, Ctrl+Enter)
- User guide and documentation

#### Phase 7: CI/CD Pipeline ✅
- GitHub Actions workflow for validation
- Impact analysis on pull requests
- PR comment bot with reports
- Merge protection documentation

#### Phase 6: Git Integration ✅
- Git status tracking via simple-git
- Diff viewer for changed files
- Commit UI with smart templates
- Branch creation and switching
- PR creation via GitHub CLI
- Impact analysis in commit messages

#### Phase 5: Graph Visualization ✅
- Cytoscape.js integration
- Interactive dependency graph
- Node coloring by entity type
- Path finding between nodes
- Zoom, pan, and search functionality
- Click to open entity in editor

#### Phase 4: Prompt Generation ✅
- Handlebars template system
- Prompt generation pipeline
- Prompt modal with copy-to-clipboard
- Template-based prompt rendering

#### Phase 3: Core UI ✅
- YAML editor component with CodeMirror
- Live schema validation in editor
- File save/load operations
- Enhanced ContextTree with filtering
- Impact panel with real-time analysis

#### Phase 1-2: Foundation ✅
- Electron Forge + Vite + TypeScript setup
- Vue 3 + Pinia + Tailwind CSS configuration
- IPC bridge between main and renderer processes
- Context repository structure
- JSON Schemas for 6 entity types (Feature, User Story, Spec, Task, Service, Package)
- Validation pipeline with AJV
- Sample YAML entities for testing

#### Design System
- Material 3 Design System implementation
- Intel brand colors integration
- Consistent, modern UI across all components

#### Speckit Workflow
- Fetch & cache lifecycle for Spec Kit
- Automated pipeline verification
- Stale cache detection and warnings
- Seven-day cache freshness policy

### Technology Stack
- **Desktop Framework**: Electron Forge 7
- **Frontend**: Vue 3 (Composition API)
- **State Management**: Pinia
- **Styling**: Tailwind CSS (v4.1.16)
- **Build Tool**: Vite 5
- **Type Safety**: TypeScript (strict mode)
- **Schema Validation**: AJV
- **Templating**: Handlebars
- **Graph Visualization**: Cytoscape.js
- **Git Integration**: simple-git
- **Package Manager**: pnpm 10.19.0
- **AI Integration**: Ollama, Azure OpenAI (openai SDK v6.7.0)

### Requirements
- Node.js 22+ (LTS)
- pnpm 10+ (via corepack)
- Git 2.33+
- PowerShell 7+ (Windows)

### Security
- Context isolation enabled
- No node integration in renderer
- Encrypted credential storage
- No hardcoded secrets

[Unreleased]: https://github.com/lukeus/my-context-kit/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/lukeus/my-context-kit/releases/tag/v0.1.0
