import { ipcMain } from 'electron';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

interface C4Diagram {
  file: string;
  title: string;
  content: string;
  system?: string;
  level?: string;
  feature?: string;
  projection?: any;
}

/**
 * Extract C4 header metadata from Mermaid content
 */
function extractC4Metadata(content: string): { system?: string; level?: string; feature?: string; specs?: string[]; stories?: string[] } {
  const headerMatch = content.match(/%%\s*c4:\s*([^\n]+)/);
  if (!headerMatch) return {};
  
  const headerStr = headerMatch[1];
  const metadata: any = {};
  
  // Extract key=value pairs
  const attrRegex = /(\w+)=([^,\s]+|(?:\[[^\]]*\]))/g;
  let match;
  
  while ((match = attrRegex.exec(headerStr)) !== null) {
    const [, key, value] = match;
    
    // Handle arrays
    if (value.startsWith('[')) {
      metadata[key] = value.slice(1, -1).split(',').map((v: string) => v.trim());
    } else {
      metadata[key] = value;
    }
  }
  
  return metadata;
}

/**
 * Extract Mermaid blocks with C4 headers from markdown
 */
function extractMermaidBlocks(content: string): string[] {
  const blocks: string[] = [];
  const mermaidRegex = /```mermaid\s*\n([\s\S]*?)```/g;
  let match;
  
  while ((match = mermaidRegex.exec(content)) !== null) {
    let blockContent = match[1];
    
    // Only include blocks with C4 header
    if (blockContent.match(/%%\s*c4:/)) {
      // Remove invisible characters (zero-width space, BOM, etc.)
      blockContent = blockContent
        .replace(/\u200B/g, '') // Zero-width space
        .replace(/\uFEFF/g, '') // BOM
        .replace(/\u00A0/g, ' ') // Non-breaking space -> regular space
        .trim();
      
      blocks.push(blockContent);
    }
  }
  
  return blocks;
}

/**
 * Find all markdown files in c4 directory
 */
function findC4Files(c4Dir: string): string[] {
  const files: string[] = [];
  
  function traverse(dir: string) {
    try {
      const items = readdirSync(dir);
      
      for (const item of items) {
        const fullPath = join(dir, item);
        
        try {
          const stat = statSync(fullPath);
          
          if (stat.isDirectory()) {
            traverse(fullPath);
          } else if (item.endsWith('.md') || item.endsWith('.markdown')) {
            files.push(fullPath);
          }
        } catch (err) {
          console.warn(`Could not access ${fullPath}:`, err);
        }
      }
    } catch (err) {
      console.warn(`Could not read directory ${dir}:`, err);
    }
  }
  
  traverse(c4Dir);
  return files;
}

/**
 * Load projection JSON for a diagram
 */
function loadProjection(diagramPath: string, index: number, repoPath: string): any {
  try {
    const relativePath = diagramPath.replace(join(repoPath, 'c4'), '');
    const baseName = relativePath.replace(/\.(md|markdown)$/i, '').replace(/^[\\/]/, '');
    const projectionPath = join(repoPath, 'c4', 'out', `${baseName}.${index}.json`);
    
    if (existsSync(projectionPath)) {
      return JSON.parse(readFileSync(projectionPath, 'utf8'));
    }
  } catch (err) {
    console.warn('Could not load projection:', err);
  }
  
  return null;
}

export function registerC4Handlers(): void {
  /**
   * Load all C4 diagrams from the context repository
   */
  ipcMain.handle('c4:load-diagrams', async (_event, { dir }: { dir: string }): Promise<{ success: boolean; diagrams?: C4Diagram[]; error?: string }> => {
    try {
      const repoPath = dir;
      if (!repoPath) {
        return { success: false, error: 'No repository configured' };
      }
      
      const c4Dir = join(repoPath, 'c4');
      if (!existsSync(c4Dir)) {
        return { success: true, diagrams: [] };
      }
      
      const files = findC4Files(c4Dir);
      const diagrams: C4Diagram[] = [];
      
      for (const file of files) {
        try {
          const content = readFileSync(file, 'utf8');
          const blocks = extractMermaidBlocks(content);
          
          // Extract title from markdown (first # heading)
          const titleMatch = content.match(/^#\s+(.+)$/m);
          const baseTitle = titleMatch ? titleMatch[1] : file.split(/[\\/]/).pop()?.replace(/\.(md|markdown)$/i, '') || 'Untitled';
          
          blocks.forEach((block, index) => {
            const metadata = extractC4Metadata(block);
            const projection = loadProjection(file, index, repoPath);
            
            diagrams.push({
              file: file.replace(repoPath, '').replace(/^[\\/]/, ''),
              title: blocks.length > 1 ? `${baseTitle} (${index + 1})` : baseTitle,
              content: block,
              system: metadata.system,
              level: metadata.level,
              feature: metadata.feature,
              projection
            });
          });
        } catch (err) {
          console.error(`Error processing ${file}:`, err);
        }
      }
      
      return { success: true, diagrams };
    } catch (error: any) {
      console.error('Error loading C4 diagrams:', error);
      return { success: false, error: error.message };
    }
  });
}
