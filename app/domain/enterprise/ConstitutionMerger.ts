/**
 * ConstitutionMerger - Framework-agnostic constitution merging logic
 * 
 * Merges global (enterprise) and local (project) constitution files.
 * Enforces the principle: local can only tighten rules, not loosen them.
 */

import type { 
  ConstitutionSection, 
  MergedConstitution, 
  ConstitutionConflict 
} from '../../src/types/enterprise';

/**
 * Merges global and local constitutions with conflict detection
 */
export class ConstitutionMerger {
  /**
   * Parse markdown constitution into sections
   */
  parseConstitution(content: string, source: 'global' | 'local'): ConstitutionSection[] {
    const sections: ConstitutionSection[] = [];
    const lines = content.split('\n');
    
    let currentSection: ConstitutionSection | null = null;
    let currentContent: string[] = [];
    let lineNumber = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      lineNumber = i + 1;

      // Check if this is a heading
      const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
      
      if (headingMatch) {
        // Save previous section if exists
        if (currentSection) {
          currentSection.content = currentContent.join('\n').trim();
          sections.push(currentSection);
        }

        // Start new section
        // const level = headingMatch[1].length; // unused for now
        const title = headingMatch[2].trim();
        
        currentSection = {
          title,
          content: '',
          source,
          lineNumber,
        };
        currentContent = [];
      } else if (currentSection) {
        // Add to current section content
        currentContent.push(line);
      }
    }

    // Save last section
    if (currentSection) {
      currentSection.content = currentContent.join('\n').trim();
      sections.push(currentSection);
    }

    return sections;
  }

  /**
   * Merge global and local constitutions
   */
  merge(
    globalConstitution: ConstitutionSection[],
    localConstitution: ConstitutionSection[]
  ): MergedConstitution {
    const conflicts = this.detectConflicts(globalConstitution, localConstitution);
    const mergedSections: ConstitutionSection[] = [];

    // Create a map of local sections by title for easy lookup
    const localSectionMap = new Map<string, ConstitutionSection>();
    for (const section of localConstitution) {
      localSectionMap.set(this.normalizeTitle(section.title), section);
    }

    // Process global sections
    for (const globalSection of globalConstitution) {
      const normalizedTitle = this.normalizeTitle(globalSection.title);
      const localSection = localSectionMap.get(normalizedTitle);

      if (localSection) {
        // Section exists in both - merge content
        const merged = this.mergeSectionContent(globalSection, localSection);
        mergedSections.push(merged);
        localSectionMap.delete(normalizedTitle); // Mark as processed
      } else {
        // Global section only
        mergedSections.push({ ...globalSection, source: 'global' });
      }
    }

    // Add remaining local-only sections
    for (const localSection of localSectionMap.values()) {
      mergedSections.push({ ...localSection, source: 'local' });
    }

    return {
      sections: mergedSections,
      globalPath: '', // Will be set by caller
      mergedAt: new Date().toISOString(),
      conflicts,
    };
  }

  /**
   * Merge content from global and local sections
   */
  private mergeSectionContent(
    globalSection: ConstitutionSection,
    localSection: ConstitutionSection
  ): ConstitutionSection {
    // For now, append local content to global
    // In the future, we could do more sophisticated merging
    const mergedContent = `${globalSection.content}\n\n---\n\n**Local Additions:**\n\n${localSection.content}`;

    return {
      title: globalSection.title,
      content: mergedContent,
      source: 'merged',
      lineNumber: globalSection.lineNumber,
    };
  }

  /**
   * Detect conflicts between global and local constitutions
   */
  detectConflicts(
    globalSections: ConstitutionSection[],
    localSections: ConstitutionSection[]
  ): ConstitutionConflict[] {
    const conflicts: ConstitutionConflict[] = [];

    // Create maps for easier lookup
    const globalMap = new Map<string, ConstitutionSection>();
    const localMap = new Map<string, ConstitutionSection>();

    for (const section of globalSections) {
      globalMap.set(this.normalizeTitle(section.title), section);
    }

    for (const section of localSections) {
      localMap.set(this.normalizeTitle(section.title), section);
    }

    // Check for contradictions
    for (const [title, localSection] of localMap) {
      const globalSection = globalMap.get(title);
      
      if (globalSection) {
        // Check if local appears to contradict global
        const contradiction = this.detectContradiction(
          globalSection.content,
          localSection.content
        );

        if (contradiction) {
          conflicts.push({
            section: localSection.title,
            path: localSection.path ?? globalSection.path ?? title,
            reason: contradiction,
            globalValue: this.summarizeContent(globalSection.content),
            localValue: this.summarizeContent(localSection.content),
            globalSection: { ...globalSection },
            localSection: { ...localSection },
            resolution: 'manual_review',
          });
        }
      }
    }

    return conflicts;
  }

  /**
   * Detect if local content contradicts global content
   * Returns contradiction reason or null if no contradiction
   */
  private detectContradiction(globalContent: string, localContent: string): string | null {
    const globalLower = globalContent.toLowerCase();
    const localLower = localContent.toLowerCase();

    // Look for negation patterns
    const negationPatterns = [
      'do not',
      'don\'t',
      'never',
      'not required',
      'optional',
      'can skip',
      'unnecessary',
    ];

    const requirementPatterns = [
      'must',
      'required',
      'mandatory',
      'always',
      'shall',
      'critical',
    ];

    // Check if global has requirements that local tries to negate
    for (const requirement of requirementPatterns) {
      if (globalLower.includes(requirement)) {
        for (const negation of negationPatterns) {
          if (localLower.includes(negation)) {
            return `Local constitution appears to weaken global requirement`;
          }
        }
      }
    }

    // Check for explicit contradictions (e.g., "use X" vs "don't use X")
    const globalStatements = this.extractStatements(globalContent);
    const localStatements = this.extractStatements(localContent);

    for (const globalStmt of globalStatements) {
      for (const localStmt of localStatements) {
        if (this.statementsContradict(globalStmt, localStmt)) {
          return `Local statement contradicts global policy`;
        }
      }
    }

    return null;
  }

  /**
   * Extract policy statements from content
   */
  private extractStatements(content: string): string[] {
    const statements: string[] = [];
    const lines = content.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      // Look for list items (-, *, numbers) or imperative statements
      if (trimmed.match(/^[-*]\s+(.+)$/) || trimmed.match(/^\d+\.\s+(.+)$/)) {
        statements.push(trimmed.toLowerCase());
      }
    }

    return statements;
  }

  /**
   * Check if two statements contradict each other
   */
  private statementsContradict(stmt1: string, stmt2: string): boolean {
    // Simple heuristic: if one contains "not" and they share keywords
    const words1 = new Set(stmt1.split(/\s+/).filter(w => w.length > 3));
    const words2 = new Set(stmt2.split(/\s+/).filter(w => w.length > 3));

    // Find common words
    const common = new Set([...words1].filter(w => words2.has(w)));

    // If they share significant words and one has negation
    if (common.size >= 2) {
      const hasNegation1 = stmt1.includes('not') || stmt1.includes('never') || stmt1.includes('don\'t');
      const hasNegation2 = stmt2.includes('not') || stmt2.includes('never') || stmt2.includes('don\'t');

      // XOR: one has negation, the other doesn't
      return hasNegation1 !== hasNegation2;
    }

    return false;
  }

  /**
   * Summarize content for conflict reporting (first 100 chars)
   */
  private summarizeContent(content: string): string {
    const clean = content.trim().replace(/\s+/g, ' ');
    return clean.length > 100 ? clean.substring(0, 97) + '...' : clean;
  }

  /**
   * Normalize section title for comparison (lowercase, remove special chars)
   */
  private normalizeTitle(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Render merged constitution as markdown
   */
  renderMerged(merged: MergedConstitution): string {
    const lines: string[] = [];

    // Header
    lines.push('# Merged Constitution');
    lines.push('');
    lines.push(`**Merged At**: ${merged.mergedAt}`);
    lines.push(`**Global Source**: ${merged.globalPath}`);
    if (merged.localPath) {
      lines.push(`**Local Source**: ${merged.localPath}`);
    }
    lines.push('');

    // Conflicts section if any
    if (merged.conflicts.length > 0) {
      lines.push('## ⚠️ Conflicts Detected');
      lines.push('');
      for (const conflict of merged.conflicts) {
        lines.push(`### ${conflict.section}`);
        lines.push(`**Reason**: ${conflict.reason}`);
        lines.push('');
        lines.push('**Global**:');
        lines.push(`> ${conflict.globalValue}`);
        lines.push('');
        lines.push('**Local**:');
        lines.push(`> ${conflict.localValue}`);
        lines.push('');
        lines.push(`**Resolution**: ${conflict.resolution}`);
        lines.push('');
      }
      lines.push('---');
      lines.push('');
    }

    // Sections
    for (const section of merged.sections) {
      // Add section heading
      lines.push(`## ${section.title}`);
      
      // Add source badge
      const sourceBadge = this.getSourceBadge(section.source);
      lines.push(`*${sourceBadge}*`);
      lines.push('');

      // Add content
      lines.push(section.content);
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Get a visual badge for the section source
   */
  private getSourceBadge(source: 'global' | 'local' | 'merged'): string {
    switch (source) {
      case 'global':
        return '🌐 Global';
      case 'local':
        return '📍 Local';
      case 'merged':
        return '🔀 Merged (Global + Local)';
    }
  }
}
