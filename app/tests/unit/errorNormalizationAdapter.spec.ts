import { describe, it, expect } from 'vitest';
import { errorNormalizationAdapter, extractErrorCode, isRetryable } from '@/utils/errorNormalizationAdapter';
import { DEFAULT_ERROR_MAP } from '@shared/errorNormalization';

// US4 - T057: Expanded tests for pattern mapping, fallback, retryable classification, and extractErrorCode helper
describe('errorNormalizationAdapter', () => {
  it('normalizes generic Error to UNKNOWN_ERROR', () => {
    const err = new Error('Generic failure');
    const normalized = errorNormalizationAdapter(err);
    expect(normalized.code).toBe('UNKNOWN_ERROR');
    expect(normalized.userMessage).toBe(DEFAULT_ERROR_MAP.UNKNOWN_ERROR.defaultUserMessage);
  });

  it('detects TIMEOUT from message', () => {
    const err = new Error('Request timed out while waiting');
    const normalized = errorNormalizationAdapter(err);
    expect(normalized.code).toBe('TIMEOUT');
  });

  it('detects FILE_NOT_FOUND from ENOENT code', () => {
    const enoent = Object.assign(new Error('No such file or directory'), { code: 'ENOENT' });
    const normalized = errorNormalizationAdapter(enoent);
    expect(normalized.code).toBe('FILE_NOT_FOUND');
  });

  it('maps string errors', () => {
    const normalized = errorNormalizationAdapter('Validation failed for field foo');
    expect(normalized.code).toBe('VALIDATION_ERROR');
  });

  it('handles number errors', () => {
    const normalized = errorNormalizationAdapter(404);
    expect(normalized.code).toBe('UNKNOWN_ERROR');
    expect(normalized.details?.errorCode).toBe(404);
  });

  it('handles unknown input types', () => {
    const normalized = errorNormalizationAdapter({ foo: 'bar' });
    expect(normalized.code).toBe('UNKNOWN_ERROR');
  });

  it('detects CONFIG_ERROR', () => {
    const err = new Error('Configuration missing for provider');
    const normalized = errorNormalizationAdapter(err);
    expect(normalized.code).toBe('CONFIG_ERROR');
  });

  it('detects NETWORK_ERROR', () => {
    const err = Object.assign(new Error('Connection failed'), { code: 'ECONNREFUSED' });
    const normalized = errorNormalizationAdapter(err);
    expect(normalized.code).toBe('NETWORK_ERROR');
  });

  it('detects TOOL_NOT_FOUND', () => {
    const err = new Error('Tool not found: pipeline.run');
    const normalized = errorNormalizationAdapter(err);
    expect(normalized.code).toBe('TOOL_NOT_FOUND');
  });

  it('retryable flag matches map', () => {
    const timeout = new Error('Operation timed out');
    const normalized = errorNormalizationAdapter(timeout);
    expect(normalized.retryable).toBe(true);
    expect(isRetryable(normalized)).toBe(true);
    const validation = new Error('Validation error: missing field');
    const norm2 = errorNormalizationAdapter(validation);
    expect(norm2.retryable).toBe(false);
  });

  it('extractErrorCode returns normalized code', () => {
    const normalized = errorNormalizationAdapter(new Error('Parsing error in document')); // maps to PARSE_ERROR
    expect(extractErrorCode(normalized)).toBe(normalized.code);
  });
});
