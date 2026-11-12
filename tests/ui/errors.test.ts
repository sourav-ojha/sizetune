import { describe, expect, it } from 'vitest';
import { EngineError } from '../../src/lib/engine/types';
import { errorCodeOf, isSilent, toToolError } from '../../src/components/tool/errors';

const codes = ['unsupported_type', 'corrupt', 'too_large_bytes', 'too_many_pixels', 'timeout', 'cancelled', 'out_of_memory', 'encode_unsupported', 'invalid_options', 'worker_failed', 'encode_failed'] as const;

describe('error mapping', () => {
  it('maps every engine code to friendly, non-empty copy (cancelled is silent)', () => {
    for (const c of codes) {
      const t = toToolError(new EngineError(c, 'internal detail ' + c));
      expect(t.code).toBe(c);
      if (c === 'cancelled') { expect(isSilent(t)).toBe(true); expect(t.message).toBe(''); }
      else {
        expect(t.message.length).toBeGreaterThan(20);
        expect(isSilent(t)).toBe(false);
        if (c !== 'invalid_options') expect(t.message).not.toContain('internal detail');
      }
    }
  });
  it('mentions the supported formats for unsupported_type', () => {
    expect(toToolError(new EngineError('unsupported_type', 'x')).message).toContain('JPEG, PNG or WebP');
  });
  it('offers the JPEG remedy for encode_unsupported', () => {
    const t = toToolError(new EngineError('encode_unsupported', 'x'), { requestedFormat: 'webp' });
    expect(t.action).toBe('use-jpeg');
    expect(t.message).toContain('WebP');
  });
  it('offers Try again for transient engine failures, with friendly copy', () => {
    for (const c of ['encode_failed', 'worker_failed'] as const) {
      const t = toToolError(new EngineError(c, 'raw engine text'));
      expect(t.action).toBe('retry');
      expect(t.message).toMatch(/try again/i);
      expect(t.message).not.toContain('raw engine text');
    }
    expect(toToolError(new EngineError('worker_failed', 'x')).message).toContain('not a problem with your image');
  });
  it('shows the file cap when known', () => {
    expect(toToolError(new EngineError('too_large_bytes', 'x'), { maxFileBytes: 25 * 1024 * 1024 }).message).toContain('limit is 25 MB');
    expect(toToolError(new EngineError('too_large_bytes', 'x')).message).not.toContain('limit is');
  });
  it('recognises engine errors by shape (crossed a worker boundary) and aborts', () => {
    expect(errorCodeOf({ name: 'EngineError', code: 'timeout' })).toBe('timeout');
    expect(errorCodeOf({ name: 'EngineError', code: 'made_up' })).toBe('unknown');
    expect(errorCodeOf(new DOMException('x', 'AbortError'))).toBe('cancelled');
    expect(errorCodeOf(new Error('boom'))).toBe('unknown');
    expect(errorCodeOf(null)).toBe('unknown');
  });
  it('never leaks raw error text for unknown errors', () => {
    const t = toToolError(new Error('secret-file-name.png failed'));
    expect(t.code).toBe('unknown');
    expect(t.message).not.toContain('secret');
  });
});
