/**
 * Unit tests for file-utils.mjs
 * Run with: node file-utils.test.mjs
 */

import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { 
  loadYamlFile, 
  getAllYamlFiles, 
  loadAllYamlFiles, 
  loadEntityById,
  fileExists,
  dirExists,
  getRelativePath 
} from './file-utils.mjs';

// Test utilities
let testsPassed = 0;
let testsFailed = 0;
let testDir = null;

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    testsFailed++;
    throw new Error(message);
  }
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    console.error(`❌ FAIL: ${message}`);
    console.error(`   Expected: ${expected}`);
    console.error(`   Actual:   ${actual}`);
    testsFailed++;
    throw new Error(message);
  }
}

function test(name, fn) {
  try {
    fn();
    console.log(`✅ PASS: ${name}`);
    testsPassed++;
  } catch (error) {
    console.error(`❌ FAIL: ${name} - ${error.message}`);
    testsFailed++;
  }
}

function setupTestDir() {
  testDir = join(tmpdir(), `file-utils-test-${Date.now()}`);
  mkdirSync(testDir, { recursive: true });
  
  // Create test YAML files
  const testYaml = `id: TEST-001
title: Test Entity
status: active`;
  
  writeFileSync(join(testDir, 'test1.yaml'), testYaml, 'utf8');
  writeFileSync(join(testDir, 'test2.yml'), testYaml.replace('001', '002'), 'utf8');
  
  // Create subdirectory
  const subDir = join(testDir, 'subdir');
  mkdirSync(subDir, { recursive: true });
  writeFileSync(join(subDir, 'test3.yaml'), testYaml.replace('001', '003'), 'utf8');
  
  // Create non-YAML file
  writeFileSync(join(testDir, 'test.txt'), 'not yaml', 'utf8');
  
  // Create JSON file for extensions test
  writeFileSync(join(testDir, 'test.json'), '{"id": "JSON-001"}', 'utf8');
}

function cleanupTestDir() {
  if (testDir) {
    try {
      rmSync(testDir, { recursive: true, force: true });
    } catch (error) {
      console.warn(`Warning: Could not clean up test directory: ${error.message}`);
    }
  }
}

// Tests
console.log('Running file-utils.mjs tests...\n');

setupTestDir();

try {
  test('loadYamlFile - loads and parses YAML', () => {
    const data = loadYamlFile(join(testDir, 'test1.yaml'));
    assertEqual(data.id, 'TEST-001', 'Should load correct YAML data');
    assertEqual(data.status, 'active', 'Should parse all fields');
  });

  test('loadYamlFile - throws on non-existent file', () => {
    let errorThrown = false;
    try {
      loadYamlFile(join(testDir, 'nonexistent.yaml'));
    } catch (error) {
      errorThrown = true;
      assert(error.message.includes('Failed to load'), 'Should throw with proper error message');
    }
    assert(errorThrown, 'Should throw error for non-existent file');
  });

  test('getAllYamlFiles - finds YAML files recursively', () => {
    const files = getAllYamlFiles(testDir);
    assertEqual(files.length, 3, 'Should find 3 YAML files');
    assert(files.some(f => f.includes('test1.yaml')), 'Should include test1.yaml');
    assert(files.some(f => f.includes('test2.yml')), 'Should include test2.yml');
    assert(files.some(f => f.includes('test3.yaml')), 'Should include test3.yaml in subdir');
  });

  test('getAllYamlFiles - respects non-recursive option', () => {
    const files = getAllYamlFiles(testDir, { recursive: false });
    assertEqual(files.length, 2, 'Should find only 2 YAML files in root');
    assert(!files.some(f => f.includes('test3.yaml')), 'Should not include subdir files');
  });

  test('getAllYamlFiles - supports custom extensions', () => {
    const files = getAllYamlFiles(testDir, { extensions: ['.json'] });
    assertEqual(files.length, 1, 'Should find 1 JSON file');
    assert(files[0].includes('test.json'), 'Should include JSON file');
  });

  test('getAllYamlFiles - respects filter function', () => {
    const files = getAllYamlFiles(testDir, {
      filter: (path) => path.includes('test1')
    });
    assertEqual(files.length, 1, 'Should filter to 1 file');
    assert(files[0].includes('test1.yaml'), 'Should include only filtered file');
  });

  test('getAllYamlFiles - returns empty array for non-existent dir', () => {
    const files = getAllYamlFiles(join(testDir, 'nonexistent'));
    assertEqual(files.length, 0, 'Should return empty array');
  });

  test('loadAllYamlFiles - loads and parses all files', () => {
    const results = loadAllYamlFiles(testDir);
    assertEqual(results.length, 3, 'Should load 3 files');
    assert(results[0].data.id, 'Should have parsed data');
    assert(results[0].file, 'Should have file path');
  });

  test('loadAllYamlFiles - supports validation', () => {
    const results = loadAllYamlFiles(testDir, {
      validate: (data) => data.id === 'TEST-001'
    });
    assertEqual(results.length, 1, 'Should validate and filter');
  });

  test('loadEntityById - finds entity by ID', () => {
    const result = loadEntityById(testDir, 'TEST-002');
    assert(result !== null, 'Should find entity');
    assertEqual(result.data.id, 'TEST-002', 'Should load correct entity');
  });

  test('loadEntityById - returns null for non-existent ID', () => {
    const result = loadEntityById(testDir, 'NONEXISTENT');
    assertEqual(result, null, 'Should return null for non-existent ID');
  });

  test('fileExists - returns true for existing file', () => {
    const exists = fileExists(join(testDir, 'test1.yaml'));
    assertEqual(exists, true, 'Should return true for existing file');
  });

  test('fileExists - returns false for non-existent file', () => {
    const exists = fileExists(join(testDir, 'nonexistent.yaml'));
    assertEqual(exists, false, 'Should return false for non-existent file');
  });

  test('fileExists - returns false for directory', () => {
    const exists = fileExists(testDir);
    assertEqual(exists, false, 'Should return false for directory');
  });

  test('dirExists - returns true for existing directory', () => {
    const exists = dirExists(testDir);
    assertEqual(exists, true, 'Should return true for existing directory');
  });

  test('dirExists - returns false for non-existent directory', () => {
    const exists = dirExists(join(testDir, 'nonexistent'));
    assertEqual(exists, false, 'Should return false for non-existent directory');
  });

  test('dirExists - returns false for file', () => {
    const exists = dirExists(join(testDir, 'test1.yaml'));
    assertEqual(exists, false, 'Should return false for file');
  });

  test('getRelativePath - returns relative path', () => {
    const fullPath = join(testDir, 'subdir', 'test3.yaml');
    const relative = getRelativePath(fullPath, testDir);
    assert(!relative.startsWith(testDir), 'Should not include repo root');
    assert(relative.includes('test3.yaml'), 'Should include filename');
  });

} finally {
  cleanupTestDir();
}

// Summary
console.log(`\n${'='.repeat(50)}`);
console.log(`Tests Passed: ${testsPassed}`);
console.log(`Tests Failed: ${testsFailed}`);
console.log(`Total Tests:  ${testsPassed + testsFailed}`);
console.log(`${'='.repeat(50)}`);

process.exit(testsFailed > 0 ? 1 : 0);
