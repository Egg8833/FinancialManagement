import { describe, it, expect, vi } from 'vitest';
import { applyOptimistic } from './useSyncedCollection';
import { ConflictError } from '../repositories/types';

type Item = { id: string; name: string };

describe('applyOptimistic', () => {
  it('persist 成功:維持 next 狀態', async () => {
    let state: Item[] = [{ id: 'a', name: '舊' }];
    const setState = (v: Item[]) => { state = v; };
    await applyOptimistic({
      prev: state, next: [{ id: 'a', name: '新' }], setState,
      persist: async () => {},
      onError: vi.fn(),
    });
    expect(state).toEqual([{ id: 'a', name: '新' }]);
  });

  it('persist 失敗:回滾至 prev 並呼叫 onError', async () => {
    let state: Item[] = [{ id: 'a', name: '舊' }];
    const onError = vi.fn();
    await applyOptimistic({
      prev: state, next: [{ id: 'a', name: '新' }],
      setState: (v: Item[]) => { state = v; },
      persist: async () => { throw new Error('網路錯誤'); },
      onError,
    });
    expect(state).toEqual([{ id: 'a', name: '舊' }]);
    expect(onError).toHaveBeenCalledOnce();
  });

  it('ConflictError 也走 onError(由呼叫端決定 reload)', async () => {
    const onError = vi.fn();
    await applyOptimistic({
      prev: [], next: [{ id: 'a', name: 'x' }],
      setState: () => {},
      persist: async () => { throw new ConflictError(); },
      onError,
    });
    expect(onError.mock.calls[0][0]).toBeInstanceOf(ConflictError);
  });
});
