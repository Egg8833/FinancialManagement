import type { AssetSnapshot } from '../types';
import type { EntityRepository } from '../repositories/types';

export function mergeSnapshot(prev: AssetSnapshot[], snap: AssetSnapshot): AssetSnapshot[] {
  const withoutSameDate = prev.filter(s => s.date !== snap.date);
  return [...withoutSameDate.slice(-364), snap];
}

/**
 * 計算儲存一筆快照所需的「增量」變更:新的完整清單(供前端樂觀更新)
 * 與需要刪除的舊快照 id(同日去重 + 365 筆裁切)。
 */
export function planSnapshotSave(prev: AssetSnapshot[], snap: AssetSnapshot) {
  const next = mergeSnapshot(prev, snap);
  const keep = new Set(next.map(s => s.id));
  const removeIds = prev.filter(s => !keep.has(s.id)).map(s => s.id);
  return { next, removeIds, snap };
}

/**
 * 以增量方式寫入快照:只新增這一筆、只刪除指定的舊快照。
 * 刻意不使用 replaceAll —— 前端狀態若過期(例如登入切換資料來源的瞬間),
 * 整批覆蓋會把雲端不在清單內的歷史快照全部刪除。
 * 刪除屬於清理動作,失敗(例如已被其他裝置刪除)不影響新快照已成功寫入。
 */
export async function persistSnapshotSave(
  repo: EntityRepository<AssetSnapshot>,
  snap: AssetSnapshot,
  removeIds: string[],
): Promise<void> {
  await repo.create(snap);
  await Promise.allSettled(removeIds.map(id => repo.remove(id)));
}
