<script setup lang="ts">
import { ref } from 'vue';
import { useContextStore } from '../stores/contextStore';

const contextStore = useContextStore();
const activeSection = ref<'overview' | 'setup' | 'features' | 'workflow'>('overview');
</script>

<template>
  <div class="h-full flex flex-col bg-surface">
    <!-- Hero Section -->
    <div class="bg-gradient-to-br from-primary-500 to-primary-700 text-white px-8 py-12 shadow-elevation-2">
      <div class="max-w-4xl mx-auto">
        <div class="flex items-center gap-4 mb-4">
          <svg class="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <div>
            <h1 class="text-4xl font-bold mb-2">Context-Sync</h1>
            <p class="text-xl text-primary-100">Spec-Driven Development Context Manager</p>
          </div>
        </div>
        <p class="text-lg text-primary-50 max-w-2xl">
          A powerful desktop application for managing GitHub context repositories, enabling spec-driven development workflows with impact analysis, version control integration, and intelligent context management.
        </p>
      </div>
    </div>

    <!-- Navigation Tabs -->
    <div class="bg-surface-2 shadow-elevation-1 px-8 border-b border-surface-variant">
      <div class="max-w-4xl mx-auto flex gap-1">
        <button
          @click="activeSection = 'overview'"
          class="px-6 py-4 text-sm font-medium border-b-2 transition-all hover:bg-surface-3"
          :class="activeSection === 'overview' ? 'border-primary text-primary-700' : 'border-transparent text-secondary-600'"
        >
          Overview
        </button>
        <button
          @click="activeSection = 'setup'"
          class="px-6 py-4 text-sm font-medium border-b-2 transition-all hover:bg-surface-3"
          :class="activeSection === 'setup' ? 'border-primary text-primary-700' : 'border-transparent text-secondary-600'"
        >
          Setup Guide
        </button>
        <button
          @click="activeSection = 'features'"
          class="px-6 py-4 text-sm font-medium border-b-2 transition-all hover:bg-surface-3"
          :class="activeSection === 'features' ? 'border-primary text-primary-700' : 'border-transparent text-secondary-600'"
        >
          Features
        </button>
        <button
          @click="activeSection = 'workflow'"
          class="px-6 py-4 text-sm font-medium border-b-2 transition-all hover:bg-surface-3"
          :class="activeSection === 'workflow' ? 'border-primary text-primary-700' : 'border-transparent text-secondary-600'"
        >
          Workflow
        </button>
      </div>
    </div>

    <!-- Content Area -->
    <div class="flex-1 overflow-y-auto px-8 py-8">
      <div class="max-w-4xl mx-auto">
        <!-- Overview Section -->
        <div v-if="activeSection === 'overview'" class="space-y-6">
          <div class="bg-white rounded-m3-lg shadow-elevation-1 p-6">
            <h2 class="text-2xl font-bold text-primary-700 mb-4">What is Context-Sync?</h2>
            <p class="text-secondary-700 mb-4">
              Context-Sync is designed to manage context repositories for spec-driven development. It helps you maintain a structured repository of features, user stories, specifications, and tasks while analyzing the impact of changes across your project.
            </p>
            <p class="text-secondary-700">
              Think of it as a central hub for your project's living documentation, where every entity (feature, spec, task) is interconnected, versioned, and validated automatically.
            </p>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div class="bg-white rounded-m3-lg shadow-elevation-1 p-6">
              <div class="w-12 h-12 bg-primary-100 rounded-m3-full flex items-center justify-center mb-4">
                <svg class="w-6 h-6 text-primary-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <h3 class="text-lg font-semibold text-primary-700 mb-2">Context Management</h3>
              <p class="text-sm text-secondary-600">
                Browse, edit, and manage all your context entities in a hierarchical tree structure.
              </p>
            </div>

            <div class="bg-white rounded-m3-lg shadow-elevation-1 p-6">
              <div class="w-12 h-12 bg-tertiary-100 rounded-m3-full flex items-center justify-center mb-4">
                <svg class="w-6 h-6 text-tertiary-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 class="text-lg font-semibold text-tertiary-700 mb-2">Impact Analysis</h3>
              <p class="text-sm text-secondary-600">
                Instantly see which entities are affected by changes and identify stale dependencies.
              </p>
            </div>

            <div class="bg-white rounded-m3-lg shadow-elevation-1 p-6">
              <div class="w-12 h-12 bg-secondary-100 rounded-m3-full flex items-center justify-center mb-4">
                <svg class="w-6 h-6 text-secondary-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                </svg>
              </div>
              <h3 class="text-lg font-semibold text-secondary-700 mb-2">Git Integration</h3>
              <p class="text-sm text-secondary-600">
                Seamless Git workflow with branch management, commits, and status tracking built-in.
              </p>
            </div>
          </div>

          <div class="bg-primary-50 border-l-4 border-primary-500 rounded-m3-md p-6">
            <h3 class="text-lg font-semibold text-primary-900 mb-2">Quick Start</h3>
            <ol class="list-decimal list-inside space-y-2 text-secondary-700">
              <li>Set your context repository path below</li>
              <li>Browse entities in the Context Tree (left sidebar)</li>
              <li>Select an entity to view and edit its YAML definition</li>
              <li>Run impact analysis to see affected entities</li>
              <li>Use Git integration to commit your changes</li>
            </ol>
          </div>

          <!-- Path Configuration -->
          <div class="bg-white rounded-m3-lg shadow-elevation-2 p-6">
            <h3 class="text-xl font-semibold text-primary-700 mb-4">Configure Repository Path</h3>
            <div class="space-y-4">
              <div>
                <label class="block text-sm font-medium text-secondary-700 mb-2">
                  Context Repository Path
                </label>
                <input
                  :value="contextStore.repoPath"
                  @input="contextStore.setRepoPath(($event.target as HTMLInputElement).value)"
                  type="text"
                  placeholder="C:\path\to\your\context-repo"
                  class="w-full px-4 py-3 border border-surface-variant rounded-m3-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-surface"
                />
                <p class="mt-2 text-xs text-secondary-600">
                  Enter the full path to your context repository containing the contexts/ directory.
                </p>
              </div>
            </div>
          </div>
        </div>

        <!-- Setup Guide Section -->
        <div v-if="activeSection === 'setup'" class="space-y-6">
          <div class="bg-white rounded-m3-lg shadow-elevation-1 p-6">
            <h2 class="text-2xl font-bold text-primary-700 mb-4">Setup Guide</h2>
            <p class="text-secondary-700 mb-6">
              Follow these steps to set up your context repository for use with Context-Sync.
            </p>

            <div class="space-y-6">
              <div>
                <h3 class="text-lg font-semibold text-primary-700 mb-3 flex items-center gap-2">
                  <span class="w-8 h-8 bg-primary-500 text-white rounded-m3-full flex items-center justify-center text-sm font-bold">1</span>
                  Repository Structure
                </h3>
                <p class="text-secondary-700 mb-3 ml-10">
                  Your context repository should follow this structure:
                </p>
                <div class="ml-10 bg-surface-2 rounded-m3-md p-4 font-mono text-sm">
                  <pre class="text-secondary-800">
my-context-repo/
├── contexts/
│   ├── features/
│   │   └── feature-001.yaml
│   ├── userstories/
│   │   └── us-001.yaml
│   ├── specs/
│   │   └── spec-001.yaml
│   └── tasks/
│       └── task-001.yaml
├── schemas/
│   └── (JSON schemas for validation)
└── .git/</pre>
                </div>
              </div>

              <div>
                <h3 class="text-lg font-semibold text-primary-700 mb-3 flex items-center gap-2">
                  <span class="w-8 h-8 bg-primary-500 text-white rounded-m3-full flex items-center justify-center text-sm font-bold">2</span>
                  YAML Entity Format
                </h3>
                <p class="text-secondary-700 mb-3 ml-10">
                  Each entity is defined in a YAML file. Example feature:
                </p>
                <div class="ml-10 bg-surface-2 rounded-m3-md p-4 font-mono text-sm">
                  <pre class="text-secondary-800">
id: feature-001
title: User Authentication
status: in-progress
description: |
  Implement secure user authentication
  with OAuth 2.0 support
dependencies:
  - spec-001
  - spec-002
tags:
  - security
  - authentication</pre>
                </div>
              </div>

              <div>
                <h3 class="text-lg font-semibold text-primary-700 mb-3 flex items-center gap-2">
                  <span class="w-8 h-8 bg-primary-500 text-white rounded-m3-full flex items-center justify-center text-sm font-bold">3</span>
                  Initialize Git Repository
                </h3>
                <p class="text-secondary-700 mb-3 ml-10">
                  Make sure your context repository is a Git repository:
                </p>
                <div class="ml-10 bg-surface-2 rounded-m3-md p-4 font-mono text-sm">
                  <pre class="text-secondary-800">
cd my-context-repo
git init
git add .
git commit -m "Initial context repository"</pre>
                </div>
              </div>

              <div>
                <h3 class="text-lg font-semibold text-primary-700 mb-3 flex items-center gap-2">
                  <span class="w-8 h-8 bg-primary-500 text-white rounded-m3-full flex items-center justify-center text-sm font-bold">4</span>
                  Connect to Context-Sync
                </h3>
                <p class="text-secondary-700 ml-10">
                  Open Context-Sync and enter the full path to your repository in the configuration field. Click "Test Validation" to ensure everything is configured correctly.
                </p>
              </div>
            </div>
          </div>
        </div>

        <!-- Features Section -->
        <div v-if="activeSection === 'features'" class="space-y-6">
          <div class="bg-white rounded-m3-lg shadow-elevation-1 p-6">
            <h2 class="text-2xl font-bold text-primary-700 mb-6">Features</h2>

            <div class="space-y-8">
              <div>
                <h3 class="text-xl font-semibold text-primary-700 mb-3">🌳 Context Tree Browser</h3>
                <p class="text-secondary-700 mb-3">
                  Navigate all your context entities organized by type (features, user stories, specs, tasks). Features include:
                </p>
                <ul class="list-disc list-inside space-y-2 text-secondary-700 ml-4">
                  <li>Real-time search across all entities</li>
                  <li>Expandable/collapsible entity type groups</li>
                  <li>Status indicators for each entity</li>
                  <li>Visual warnings for stale entities</li>
                  <li>One-click entity selection</li>
                </ul>
              </div>

              <div>
                <h3 class="text-xl font-semibold text-primary-700 mb-3">✏️ YAML Editor</h3>
                <p class="text-secondary-700 mb-3">
                  Full-featured YAML editor with syntax highlighting powered by CodeMirror:
                </p>
                <ul class="list-disc list-inside space-y-2 text-secondary-700 ml-4">
                  <li>Syntax highlighting and autocomplete</li>
                  <li>Real-time validation on save</li>
                  <li>Keyboard shortcuts (Ctrl+S to save)</li>
                  <li>Unsaved changes indicator</li>
                  <li>Auto-reload on entity selection</li>
                </ul>
              </div>

              <div>
                <h3 class="text-xl font-semibold text-primary-700 mb-3">📊 Impact Analysis</h3>
                <p class="text-secondary-700 mb-3">
                  Understand the ripple effects of your changes:
                </p>
                <ul class="list-disc list-inside space-y-2 text-secondary-700 ml-4">
                  <li>See all entities affected by changes</li>
                  <li>Identify stale dependencies that need review</li>
                  <li>View validation issues and errors</li>
                  <li>Generate AI prompts for entity updates</li>
                  <li>Track entities that need review</li>
                </ul>
              </div>

              <div>
                <h3 class="text-xl font-semibold text-primary-700 mb-3">🔀 Git Integration</h3>
                <p class="text-secondary-700 mb-3">
                  Full Git workflow support built into the app:
                </p>
                <ul class="list-disc list-inside space-y-2 text-secondary-700 ml-4">
                  <li>View repository status and changed files</li>
                  <li>Create and switch branches</li>
                  <li>Stage specific files or all changes</li>
                  <li>Commit with template messages</li>
                  <li>Real-time branch tracking</li>
                </ul>
              </div>

              <div>
                <h3 class="text-xl font-semibold text-primary-700 mb-3">📈 Dependency Graph</h3>
                <p class="text-secondary-700 mb-3">
                  Visualize relationships between entities:
                </p>
                <ul class="list-disc list-inside space-y-2 text-secondary-700 ml-4">
                  <li>Interactive graph visualization</li>
                  <li>See all entity dependencies</li>
                  <li>Identify circular dependencies</li>
                  <li>Zoom and pan controls</li>
                  <li>Click entities to navigate</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        <!-- Workflow Section -->
        <div v-if="activeSection === 'workflow'" class="space-y-6">
          <div class="bg-white rounded-m3-lg shadow-elevation-1 p-6">
            <h2 class="text-2xl font-bold text-primary-700 mb-4">Typical Workflow</h2>
            <p class="text-secondary-700 mb-6">
              Here's how you might use Context-Sync in your day-to-day development workflow:
            </p>

            <div class="space-y-6">
              <div class="flex gap-4">
                <div class="flex-shrink-0">
                  <div class="w-12 h-12 bg-primary-500 text-white rounded-m3-full flex items-center justify-center text-xl font-bold">
                    1
                  </div>
                </div>
                <div class="flex-1">
                  <h3 class="text-lg font-semibold text-primary-700 mb-2">Review Context Tree</h3>
                  <p class="text-secondary-700">
                    Start by browsing the Context Tree to understand existing features, specs, and tasks. Use search to find specific entities relevant to your current work.
                  </p>
                </div>
              </div>

              <div class="flex gap-4">
                <div class="flex-shrink-0">
                  <div class="w-12 h-12 bg-primary-500 text-white rounded-m3-full flex items-center justify-center text-xl font-bold">
                    2
                  </div>
                </div>
                <div class="flex-1">
                  <h3 class="text-lg font-semibold text-primary-700 mb-2">Create or Update Entities</h3>
                  <p class="text-secondary-700">
                    Select an entity from the tree to edit it, or create a new YAML file in your repository's contexts/ directory. Use the YAML editor to make changes, and save with Ctrl+S.
                  </p>
                </div>
              </div>

              <div class="flex gap-4">
                <div class="flex-shrink-0">
                  <div class="w-12 h-12 bg-primary-500 text-white rounded-m3-full flex items-center justify-center text-xl font-bold">
                    3
                  </div>
                </div>
                <div class="flex-1">
                  <h3 class="text-lg font-semibold text-primary-700 mb-2">Run Impact Analysis</h3>
                  <p class="text-secondary-700">
                    After making changes, click "Analyze Impact" in the right panel to see which other entities are affected. Review any stale dependencies or validation issues.
                  </p>
                </div>
              </div>

              <div class="flex gap-4">
                <div class="flex-shrink-0">
                  <div class="w-12 h-12 bg-primary-500 text-white rounded-m3-full flex items-center justify-center text-xl font-bold">
                    4
                  </div>
                </div>
                <div class="flex-1">
                  <h3 class="text-lg font-semibold text-primary-700 mb-2">Update Affected Entities</h3>
                  <p class="text-secondary-700">
                    If the impact analysis reveals stale entities, update them to ensure consistency. You can click on any stale entity to quickly navigate to it and make updates.
                  </p>
                </div>
              </div>

              <div class="flex gap-4">
                <div class="flex-shrink-0">
                  <div class="w-12 h-12 bg-primary-500 text-white rounded-m3-full flex items-center justify-center text-xl font-bold">
                    5
                  </div>
                </div>
                <div class="flex-1">
                  <h3 class="text-lg font-semibold text-primary-700 mb-2">Visualize Dependencies</h3>
                  <p class="text-secondary-700">
                    Use the Graph view to visualize how entities connect. This helps identify bottlenecks, circular dependencies, and understand the broader context of your changes.
                  </p>
                </div>
              </div>

              <div class="flex gap-4">
                <div class="flex-shrink-0">
                  <div class="w-12 h-12 bg-primary-500 text-white rounded-m3-full flex items-center justify-center text-xl font-bold">
                    6
                  </div>
                </div>
                <div class="flex-1">
                  <h3 class="text-lg font-semibold text-primary-700 mb-2">Commit Changes</h3>
                  <p class="text-secondary-700">
                    Open the Git panel, review changed files, optionally select specific files to stage, write a commit message (or use the template), and commit your changes.
                  </p>
                </div>
              </div>

              <div class="flex gap-4">
                <div class="flex-shrink-0">
                  <div class="w-12 h-12 bg-primary-500 text-white rounded-m3-full flex items-center justify-center text-xl font-bold">
                    7
                  </div>
                </div>
                <div class="flex-1">
                  <h3 class="text-lg font-semibold text-primary-700 mb-2">Branch Management</h3>
                  <p class="text-secondary-700">
                    For larger changes, create feature branches using the Git panel. Switch between branches to work on multiple features in parallel without conflicts.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div class="bg-tertiary-50 border-l-4 border-tertiary-500 rounded-m3-md p-6">
            <h3 class="text-lg font-semibold text-tertiary-900 mb-2">💡 Pro Tips</h3>
            <ul class="list-disc list-inside space-y-2 text-secondary-700">
              <li>Use consistent ID naming conventions (e.g., feature-001, us-001, spec-001)</li>
              <li>Keep entity files small and focused on a single concern</li>
              <li>Run validation frequently to catch issues early</li>
              <li>Use tags to organize and group related entities</li>
              <li>Generate prompts to help update affected entities with AI assistance</li>
              <li>Review the dependency graph regularly to maintain a clean architecture</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
pre {
  white-space: pre-wrap;
  word-wrap: break-word;
}
</style>
