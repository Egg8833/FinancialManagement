import type { AssetCategory, LiabilityItem, AssetSnapshot } from '../types';

const KEYS = {
  assets: 'app-assets-v1',
  liabilities: 'app-liabilities-v1',
  snapshots: 'app-snapshots-v1',
} as const;

export function getAssets(): AssetCategory[] {
  const stored = localStorage.getItem(KEYS.assets);
  return stored ? JSON.parse(stored) : [];
}
export function saveAssets(data: AssetCategory[]): void {
  localStorage.setItem(KEYS.assets, JSON.stringify(data));
}

export function getLiabilities(): LiabilityItem[] {
  const stored = localStorage.getItem(KEYS.liabilities);
  return stored ? JSON.parse(stored) : [];
}
export function saveLiabilities(data: LiabilityItem[]): void {
  localStorage.setItem(KEYS.liabilities, JSON.stringify(data));
}

export function getSnapshots(): AssetSnapshot[] {
  const stored = localStorage.getItem(KEYS.snapshots);
  return stored ? JSON.parse(stored) : [];
}
export function saveSnapshots(data: AssetSnapshot[]): void {
  localStorage.setItem(KEYS.snapshots, JSON.stringify(data));
}
