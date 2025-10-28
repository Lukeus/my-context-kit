# C4 Diagram Builder UI

## Overview
A comprehensive UI for creating, editing, and managing C4 architecture diagrams in your Context Kit application.

## Features Implemented

### 1. **C4DiagramBuilder Component** (`src/renderer/components/C4DiagramBuilder.vue`)
A full-featured diagram management interface with:

- **Diagram List Sidebar**
  - Displays all C4 diagrams from the `c4/` directory
  - Shows diagram metadata (title, level, system)
  - Visual selection indicator
  - Empty state messaging

- **Diagram Viewer/Editor**
  - Three tabs: Preview, Editor, Analysis
  - **Preview Tab**: Live Mermaid C4 diagram rendering
  - **Editor Tab**: Raw markdown/Mermaid syntax editing with textarea
  - **Analysis Tab**: Placeholder for C4AnalyzerService integration
  
- **Create New Diagram**
  - Modal dialog for new diagram creation
  - Generates Mermaid C4 template
  - Auto-creates markdown file in `c4/` directory
  - Filename sanitization (lowercase, hyphens, alphanumeric only)

- **Edit & Save**
  - In-line editor for diagram content
  - Save button updates the markdown file
  - Cancel button reverts changes
  - Auto-reload after save

### 2. **Navigation Integration** (App.vue)
- Added "C4" navigation rail item (3rd position)
- Keyboard shortcut label: "Architecture"
- Lazy-loaded component (defineAsyncComponent)
- Proper routing and active state management

### 3. **IPC Integration**
Uses existing IPC handlers:
- `window.api.c4.loadDiagrams(dir)` - Loads all diagrams from repo
- `window.api.c4.analyze(filePath)` - Analyzes diagram structure
- `window.api.files.write(path, content)` - Saves diagram edits

## Usage

### Accessing the C4 Builder
1. **Via Navigation Rail**: Click the "C4" button (shows letter "C" with "C4" label)
2. **Keyboard Shortcut**: Not yet assigned (could add Ctrl+Shift+C)
3. **Direct Navigation**: The view activates when `activeNavId === 'c4'`

### Creating a New Diagram
1. Click "New Diagram" button in the sidebar
2. Enter a diagram title (e.g., "System Context")
3. Click "Create Diagram"
4. A new markdown file is created with a template:
   ```markdown
   %%c4: system=NewSystem level=C2

   ```mermaid
   C4Context
     title Your Diagram Title
     
     Person(user, "User", "System user")
     System(system, "System", "Main system")
     
     Rel(user, system, "Uses")
   ```
   ```

### Editing Diagrams
1. Select a diagram from the sidebar list
2. Click the "Editor" tab
3. Modify the Mermaid C4 syntax
4. Click "Save Changes" to persist
5. The preview automatically updates

### Viewing Diagrams
- **Preview Tab**: Shows the rendered Mermaid diagram (lazy-loaded C4DiagramRenderer)
- Suspense boundary with loading fallback
- Full diagram visualization

### Analysis (Future)
- Click "Analysis" tab
- Currently shows placeholder UI
- Ready for C4AnalyzerService integration
- Will display:
  - Extracted nodes (Person, System, Container, Component)
  - Relationships
  - Metadata (system, level, feature)
  - Validation results

## Directory Structure

The C4 builder expects diagrams in:
```
{context-repo}/
└── c4/
    ├── system-context.md
    ├── container-diagram.md
    └── component-diagram.md
```

Each markdown file contains:
- Metadata header: `%%c4: system=MySystem level=C2 feature=FEAT-001`
- Mermaid code block with C4 syntax

## Technical Details

### Component Architecture
- **Lazy Loading**: C4DiagramBuilder is loaded only when accessed (code-splitting)
- **Suspense Wrapper**: Provides loading state during async component load
- **Reactive State**: Vue 3 Composition API with TypeScript
- **Store Integration**: Uses `useContextStore()` for repo path

### State Management
```typescript
const diagrams = ref<C4Diagram[]>([]);           // All loaded diagrams
const selectedDiagram = ref<C4Diagram | null>(null); // Currently selected
const activeTab = ref<'preview' | 'editor' | 'analysis'>('preview');
const editorContent = ref('');                   // Editor state
```

### Diagram Interface
```typescript
interface C4Diagram {
  file: string;        // Relative path (e.g., "system-context.md")
  title: string;       // Display title
  content: string;     // Full markdown content
  system?: string;     // From metadata
  level?: string;      // C1/C2/C3/C4
  feature?: string;    // Linked feature ID
  projection?: any;    // JSON projection data
}
```

## Build Status

✅ **Lint**: 0 errors, 136 warnings (only `any` type warnings)  
✅ **Build**: Successfully compiled with electron-forge  
✅ **Integration**: Properly wired into App.vue navigation  
✅ **IPC**: All handlers functional (loadDiagrams, analyze, file write)

## Next Steps / Enhancements

1. **Analysis Tab Implementation**
   - Display parsed nodes and relationships
   - Show validation results
   - Highlight scaffolding readiness

2. **Keyboard Shortcuts**
   - Add Ctrl+Shift+C to open C4 builder
   - Ctrl+S to save in editor mode
   - Escape to cancel edit

3. **Enhanced Editor**
   - Syntax highlighting for Mermaid
   - Code completion/IntelliSense
   - Live preview (split pane)
   - Error indicators

4. **Diagram Templates**
   - Multiple template options (Context, Container, Component, Deployment)
   - Template selector in "New Diagram" modal
   - Pre-populated examples

5. **Diagram Actions**
   - Delete diagram
   - Duplicate diagram
   - Export to PNG/SVG
   - Share/copy link

6. **Search & Filter**
   - Search diagrams by title/content
   - Filter by level (C1/C2/C3/C4)
   - Filter by system
   - Filter by feature

7. **Collaboration Features**
   - Git integration (show uncommitted changes)
   - Diff view for diagram changes
   - Comment annotations

## Testing

To test the C4 builder:

```bash
cd C:\Users\lukeu\source\repos\my-context-kit\app
pnpm dev
```

1. Open the app
2. Configure a repository (if not already)
3. Click the "C4" navigation button
4. Create a new diagram or select an existing one
5. Edit and save changes
6. Verify the file updates in the repo's `c4/` directory

## Troubleshooting

**No diagrams appear**:
- Ensure the `c4/` directory exists in your context repo
- Check that markdown files contain valid Mermaid C4 syntax
- Look for errors in the browser console (F12)

**Diagram doesn't render**:
- Verify Mermaid syntax is valid
- Check that C4 library is properly loaded
- Ensure the `C4DiagramRenderer` component loaded successfully

**Can't save changes**:
- Verify file write permissions
- Check that the file path is valid
- Look for IPC errors in the console

**Analysis tab empty**:
- This is expected - analysis display is not yet implemented
- The C4AnalyzerService can be called, but results aren't displayed
- Future enhancement to show parsed diagram data

## Cost Estimate
Implementation time: ~$0.15 for full UI integration
