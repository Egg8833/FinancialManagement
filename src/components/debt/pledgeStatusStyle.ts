import { AlertTriangle, AlertOctagon, ShieldCheck } from 'lucide-react';
import type { PledgeStatus } from '../../lib/pledgeCalc';

/** 質押維持率狀態的共用樣式與文字(卡片、多帳戶模擬共用,避免各自定義不一致)。 */
export function pledgeStatusStyle(s: PledgeStatus) {
  return {
    text:   s === 'danger' ? 'text-rose-600'   : s === 'warn' ? 'text-amber-600'   : 'text-emerald-600',
    badge:  s === 'danger' ? 'bg-rose-100'     : s === 'warn' ? 'bg-amber-100'     : 'bg-emerald-100',
    border: s === 'danger' ? 'border-rose-200' : s === 'warn' ? 'border-amber-200' : 'border-emerald-100',
    bg:     s === 'danger' ? 'bg-rose-50'      : s === 'warn' ? 'bg-amber-50'      : 'bg-emerald-50',
    row:    s === 'danger' ? 'bg-rose-50/70'   : s === 'warn' ? 'bg-amber-50/70'   : 'bg-emerald-50/50',
    dot:    s === 'danger' ? 'bg-rose-500'     : s === 'warn' ? 'bg-amber-400'     : 'bg-emerald-500',
    ring:   s === 'danger' ? 'border-rose-500' : s === 'warn' ? 'border-amber-400' : 'border-emerald-500',
    Icon:   s === 'danger' ? AlertOctagon      : s === 'warn' ? AlertTriangle      : ShieldCheck,
    label:  s === 'danger' ? '追繳'            : s === 'warn' ? '警戒'             : '安全',
  };
}
