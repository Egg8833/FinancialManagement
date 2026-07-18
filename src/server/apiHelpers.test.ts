import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import { ApiError, handleApi } from './apiHelpers';

// Mock the auth function so tests can run
vi.mock('../auth', () => ({
  auth: vi.fn(),
}));

describe('handleApi', () => {
  it('ApiError 轉為對應狀態碼與統一格式', async () => {
    const res = await handleApi(async () => { throw new ApiError(409, 'version_conflict', '版本衝突'); });
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error.code).toBe('version_conflict');
  });

  it('ZodError 轉為 422', async () => {
    const res = await handleApi(async () => {
      z.object({ id: z.string() }).parse({});
      return Response.json({});
    });
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error.code).toBe('validation_failed');
  });

  it('SyntaxError (格式錯誤的 JSON body) 轉為 422', async () => {
    const res = await handleApi(async () => { JSON.parse('{invalid'); return Response.json({}); });
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error.code).toBe('validation_failed');
  });

  it('未知錯誤轉為 500', async () => {
    const res = await handleApi(async () => { throw new Error('boom'); });
    expect(res.status).toBe(500);
  });

  it('正常回應原樣通過', async () => {
    const res = await handleApi(async () => Response.json({ ok: true }));
    expect(res.status).toBe(200);
  });
});
