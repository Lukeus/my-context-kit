/**
 * Unit tests for error-utils.mjs
 * Run with: node error-utils.test.mjs
 */

import {
  PipelineError,
  ErrorCodes,
  exitWithError,
  withErrorHandling,
  assert,
  validateRequiredFields,
  getSafeErrorMessage,
  summarizeErrors
} from './error-utils.mjs';

// Test utilities
let testsPassed = 0;
let testsFailed = 0;

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

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${expected}, got ${actual}`);
  }
}

function assertIncludes(text, substring, message) {
  if (!text.includes(substring)) {
    throw new Error(`${message}: expected "${text}" to include "${substring}"`);
  }
}

// Tests
console.log('Running error-utils.mjs tests...\n');

test('PipelineError - creates error with code and details', () => {
  const error = new PipelineError('Test error', ErrorCodes.FILE_READ_ERROR, { file: 'test.yaml' });
  assertEqual(error.message, 'Test error', 'Should set message');
  assertEqual(error.code, ErrorCodes.FILE_READ_ERROR, 'Should set code');
  assertEqual(error.details.file, 'test.yaml', 'Should set details');
});

test('PipelineError - defaults to unknown error code', () => {
  const error = new PipelineError('Test error');
  assertEqual(error.code, ErrorCodes.UNKNOWN_ERROR, 'Should default to UNKNOWN_ERROR');
});

test('ErrorCodes - has all expected codes', () => {
  assertEqual(typeof ErrorCodes.FILE_NOT_FOUND, 'number', 'Should have FILE_NOT_FOUND');
  assertEqual(typeof ErrorCodes.FILE_READ_ERROR, 'number', 'Should have FILE_READ_ERROR');
  assertEqual(typeof ErrorCodes.YAML_PARSE_ERROR, 'number', 'Should have YAML_PARSE_ERROR');
  assertEqual(typeof ErrorCodes.VALIDATION_ERROR, 'number', 'Should have VALIDATION_ERROR');
});

test('assert - passes on true condition', () => {
  // Should not throw
  assert(true, 'Test message', ErrorCodes.VALIDATION_ERROR);
});

test('assert - throws PipelineError on false condition', () => {
  let errorThrown = false;
  try {
    assert(false, 'Test failed', ErrorCodes.VALIDATION_ERROR);
  } catch (error) {
    errorThrown = true;
    assertEqual(error instanceof PipelineError, true, 'Should throw PipelineError');
    assertEqual(error.message, 'Test failed', 'Should have correct message');
    assertEqual(error.code, ErrorCodes.VALIDATION_ERROR, 'Should have correct code');
  }
  assertEqual(errorThrown, true, 'Should throw error');
});

test('validateRequiredFields - passes with all fields', () => {
  const obj = { id: '123', title: 'Test', status: 'active' };
  // Should not throw
  validateRequiredFields(obj, ['id', 'title']);
});

test('validateRequiredFields - throws on missing field', () => {
  const obj = { id: '123' };
  let errorThrown = false;
  try {
    validateRequiredFields(obj, ['id', 'title']);
  } catch (error) {
    errorThrown = true;
    assertIncludes(error.message, 'title', 'Should mention missing field');
  }
  assertEqual(errorThrown, true, 'Should throw error');
});

test('getSafeErrorMessage - sanitizes API keys', () => {
  const error = new Error('Error with API_KEY=sk_test_12345 in message');
  const safe = getSafeErrorMessage(error);
  assertIncludes(safe, '[REDACTED]', 'Should redact API key');
  assertEqual(safe.includes('sk_test_12345'), false, 'Should not include actual key');
});

test('getSafeErrorMessage - sanitizes passwords', () => {
  const error = new Error('Error with password=secret123 in message');
  const safe = getSafeErrorMessage(error);
  assertIncludes(safe, '[REDACTED]', 'Should redact password');
  assertEqual(safe.includes('secret123'), false, 'Should not include actual password');
});

test('getSafeErrorMessage - handles non-Error objects', () => {
  const safe = getSafeErrorMessage('Just a string error');
  assertEqual(safe, 'Just a string error', 'Should handle string');
});

test('summarizeErrors - creates summary of multiple errors', () => {
  const errors = [
    new PipelineError('Error 1', ErrorCodes.FILE_READ_ERROR),
    new Error('Error 2'),
    { message: 'String error' }
  ];
  const summary = summarizeErrors(errors);
  assertEqual(summary.total, 3, 'Should count all errors');
  assertEqual(summary.messages.length, 3, 'Should include all error messages');
  assertIncludes(summary.messages[0], 'Error 1', 'Should include error messages');
});

test('summarizeErrors - handles empty array', () => {
  const summary = summarizeErrors([]);
  assertEqual(summary.total, 0, 'Should have zero errors');
  assertEqual(summary.messages.length, 0, 'Should have empty messages array');
});

test('withErrorHandling - wraps async function', async () => {
  const fn = async () => 'success';
  const wrapped = withErrorHandling(fn);
  const result = await wrapped();
  assertEqual(result, 'success', 'Should return function result');
});

test('withErrorHandling - catches and formats errors', async () => {
  const fn = async () => {
    throw new PipelineError('Test error', ErrorCodes.VALIDATION_ERROR);
  };
  const wrapped = withErrorHandling(fn);
  
  let errorCaught = false;
  try {
    await wrapped();
  } catch (error) {
    errorCaught = true;
  }
  assertEqual(errorCaught, true, 'Should propagate error');
});

test('withErrorHandling - handles non-PipelineError', async () => {
  const fn = async () => {
    throw new Error('Generic error');
  };
  const wrapped = withErrorHandling(fn);
  
  let errorCaught = false;
  try {
    await wrapped();
  } catch (error) {
    errorCaught = true;
  }
  assertEqual(errorCaught, true, 'Should handle generic errors');
});

// Summary
console.log(`\n${'='.repeat(50)}`);
console.log(`Tests Passed: ${testsPassed}`);
console.log(`Tests Failed: ${testsFailed}`);
console.log(`Total Tests:  ${testsPassed + testsFailed}`);
console.log(`${'='.repeat(50)}`);

process.exit(testsFailed > 0 ? 1 : 0);
