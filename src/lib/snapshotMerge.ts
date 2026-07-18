import type { AssetSnapshot } from '../types';

export function mergeSnapshot(prev: AssetSnapshot[], snap: AssetSnapshot): AssetSnapshot[] {
  const withoutSameDate = prev.filter(s => s.date !== snap.date);
  return [...withoutSameDate.slice(-364), snap];
}
