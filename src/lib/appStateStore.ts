import { ConflictError, type EntityRepository } from '../repositories/types';

/** 通用鍵值狀態:對應 /api/user/state 的一列(id = 設定鍵名,value = 任意形狀) */
export interface StateEntry {
  id: string;
  value: unknown;
}

export type AppStateStatus = 'loading' | 'ready' | 'error';

export interface AppStateSnapshot {
  status: AppStateStatus;
  map: Record<string, unknown>;
}

export interface AppStateStoreOptions {
  /** 版本衝突(其他裝置改過);store 已自動重新載入 */
  onConflict?: () => void;
  /** 其他寫入失敗;store 已自動還原為伺服器最後確認的值 */
  onError?: (e: unknown) => void;
}

/**
 * 雲端模式的 app_state 鍵值 store(與 React 無關,便於測試)。
 *
 * 不變式:
 * - 只有 status === 'ready'(確實載入成功)時才接受寫入;載入中/載入失敗一律拒絕,
 *   避免把尚未載入時的預設值寫回雲端、覆蓋使用者的真實資料。
 * - 寫入為樂觀更新;map 立即同步更新,所以連續的函式型更新會以最新值為基礎。
 * - 失敗時只在「這是該鍵最新一次寫入」時才還原,避免舊請求的失敗蓋掉較新的值。
 */
export function createAppStateStore(repo: EntityRepository<StateEntry>, opts: AppStateStoreOptions = {}) {
  let snapshot: AppStateSnapshot = { status: 'loading', map: {} };
  let confirmed: Record<string, unknown> = {};
  let existingKeys = new Set<string>();
  const latestSeq = new Map<string, number>();
  let seq = 0;
  let loadGen = 0;
  const listeners = new Set<() => void>();

  const set = (next: AppStateSnapshot) => {
    snapshot = next;
    listeners.forEach(l => l());
  };

  async function load(): Promise<void> {
    const gen = ++loadGen;
    try {
      const entries = await repo.getAll();
      if (gen !== loadGen) return;
      const map: Record<string, unknown> = {};
      for (const e of entries) map[e.id] = e.value;
      confirmed = { ...map };
      existingKeys = new Set(Object.keys(map));
      set({ status: 'ready', map });
    } catch {
      if (gen !== loadGen) return;
      // 已載入過(重新載入失敗)就保留現有資料;首次載入失敗則標記 error 並禁止寫入
      if (snapshot.status !== 'ready') set({ status: 'error', map: {} });
    }
  }

  async function setValue(key: string, value: unknown): Promise<boolean> {
    if (snapshot.status !== 'ready') return false;

    const mySeq = ++seq;
    latestSeq.set(key, mySeq);
    set({ ...snapshot, map: { ...snapshot.map, [key]: value } });

    const entry: StateEntry = { id: key, value };
    const isNew = !existingKeys.has(key);
    existingKeys.add(key); // 之後的寫入改走 update(repo 會依序執行同一 id 的請求)

    try {
      await (isNew ? repo.create(entry) : repo.update(entry));
      confirmed[key] = value;
      return true;
    } catch (e) {
      if (isNew && !(key in confirmed)) existingKeys.delete(key);
      if (e instanceof ConflictError) {
        opts.onConflict?.();
        await load();
        return false;
      }
      if (latestSeq.get(key) === mySeq) {
        const map = { ...snapshot.map };
        if (key in confirmed) map[key] = confirmed[key]; else delete map[key];
        set({ ...snapshot, map });
      }
      opts.onError?.(e);
      return false;
    }
  }

  function updateValue(key: string, updater: (prev: unknown) => unknown, defaultValue: unknown): Promise<boolean> {
    const current = key in snapshot.map ? snapshot.map[key] : defaultValue;
    return setValue(key, updater(current));
  }

  return {
    load,
    setValue,
    updateValue,
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
  };
}

export type AppStateStore = ReturnType<typeof createAppStateStore>;
