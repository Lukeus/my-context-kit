import { describe, it, expect } from 'vitest';
import { C4AnalyzerService } from './C4AnalyzerService';
import path from 'node:path';

describe('C4AnalyzerService', () => {
  const service = new C4AnalyzerService();
  const testDiagramPath = path.join(
    process.cwd(),
    '..',
    'context-repo',
    'c4',
    'context-sync-mvp.md'
  );

  describe('analyze', () => {
    it('should extract metadata from C4 diagram header', async () => {
      const analysis = await service.analyze(testDiagramPath);
      
      expect(analysis.metadata.system).toBe('Context-Sync');
      expect(analysis.metadata.level).toBe('C2');
      expect(analysis.metadata.feature).toBe('FEAT-001');
      expect(analysis.metadata.specs).toContain('SPEC-001');
    });

    it('should extract nodes from diagram', async () => {
      const analysis = await service.analyze(testDiagramPath);
      
      expect(analysis.nodes.length).toBeGreaterThan(0);
      
      // Check for specific containers
      const renderer = analysis.nodes.find(n => n.id === 'RENDERER');
      expect(renderer).toBeDefined();
      expect(renderer?.kind).toBe('container');
      expect(renderer?.tech).toContain('Vue');
    });

    it('should extract relationships from diagram', async () => {
      const analysis = await service.analyze(testDiagramPath);
      
      expect(analysis.relationships.length).toBeGreaterThan(0);
      
      // Find a specific relationship
      const rendererToUI = analysis.relationships.find(
        r => r.source === 'RENDERER' && r.target === 'UI'
      );
      expect(rendererToUI).toBeDefined();
    });

    it('should infer capabilities', async () => {
      const analysis = await service.analyze(testDiagramPath);
      
      expect(analysis.capabilities.length).toBeGreaterThan(0);
    });
  });

  describe('validateForScaffolding', () => {
    it('should validate diagram is suitable for scaffolding', async () => {
      const analysis = await service.analyze(testDiagramPath);
      const validation = await service.validateForScaffolding(analysis);
      
      expect(validation.valid).toBe(true);
      expect(validation.errors.length).toBe(0);
    });

    it('should detect missing system name', async () => {
      const emptyAnalysis = {
        metadata: {},
        nodes: [{ id: 'test', name: 'Test', kind: 'container' as const }],
        relationships: [],
        capabilities: [],
        apiEndpoints: [],
        events: []
      };
      
      const validation = await service.validateForScaffolding(emptyAnalysis);
      
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('System name required in c4 header comment');
    });

    it('should detect missing containers', async () => {
      const analysisWithoutContainers = {
        metadata: { system: 'TestSystem' },
        nodes: [{ id: 'user', name: 'User', kind: 'person' as const }],
        relationships: [],
        capabilities: [],
        apiEndpoints: [],
        events: []
      };
      
      const validation = await service.validateForScaffolding(analysisWithoutContainers);
      
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('No containers or components found - cannot generate features');
    });
  });
});
