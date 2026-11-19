import { describe, it, expect } from 'vitest';
import { isAuthorizedCron } from './cronAuth';

describe('isAuthorizedCron', () => {
  it('正確的 Bearer secret 通過', () => {
    expect(isAuthorizedCron('Bearer s3cret', 's3cret')).toBe(true);
  });
  it('錯誤、長度不同、缺少 header 都拒絕', () => {
    expect(isAuthorizedCron('Bearer wrong!', 's3cret')).toBe(false);
    expect(isAuthorizedCron('Bearer s3cre', 's3cret')).toBe(false);
    expect(isAuthorizedCron(null, 's3cret')).toBe(false);
    expect(isAuthorizedCron('s3cret', 's3cret')).toBe(false);
  });
  it('未設定 secret 一律拒絕', () => {
    expect(isAuthorizedCron('Bearer ', '')).toBe(false);
    expect(isAuthorizedCron('Bearer undefined', undefined)).toBe(false);
  });
});
