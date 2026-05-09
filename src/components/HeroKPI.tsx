"use client";

import { useState } from 'react';
import { Wallet, ArrowUpRight, Target, Pencil, Check, X, Trophy } from 'lucide-react';

interface HeroKPIProps {
  netWorth: number;
  totalAssets: number;
  totalLiabilities: number;
  formatCurrency: (amount: number) => string;
  netWorthGoal: number;
  setNetWorthGoal: (goal: number) => void;
}

export function HeroKPI({ netWorth, totalAssets, totalLiabilities, formatCurrency, netWorthGoal, setNetWorthGoal }: HeroKPIProps) {
  const [editingGoal, setEditingGoal] = useState(false);
  const [goalInput, setGoalInput] = useState('');

  const hasGoal    = netWorthGoal > 0;
  const achieved   = hasGoal && netWorth >= netWorthGoal;
  const rawPct     = hasGoal ? (netWorth / netWorthGoal) * 100 : 0;
  const barPct     = Math.min(rawPct, 100);
  const overPct    = rawPct - 100; // 超標百分比

  // 輸入單位為「萬」，儲存時 × 10000
  const handleSaveGoal = () => {
    const wan = Number(goalInput.replace(/[^0-9.]/g, ''));
    if (wan > 0) setNetWorthGoal(Math.round(wan * 10000));
    setEditingGoal(false);
  };

  const openEdit = () => {
    setGoalInput(netWorthGoal > 0 ? String(Math.round(netWorthGoal / 10000)) : '');
    setEditingGoal(true);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
      <div className="bg-white rounded-2xl p-6 shadow-[0_2px_20px_rgba(0,0,0,0.04)] border border-gray-100 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
          <Wallet className="w-24 h-24 text-indigo-600" />
        </div>
        <p className="text-sm font-medium text-gray-500 mb-2">我的淨資產 (TWD)</p>
        <h2 className="text-4xl font-bold text-gray-900 mb-3">{formatCurrency(netWorth)}</h2>

        {/* 目標進度 */}
        {hasGoal && !editingGoal && (
          <div className="mb-3">
            <div className="flex justify-between text-xs mb-1">
              <span className="flex items-center gap-1 text-gray-400">
                <Target className="w-3 h-3" />
                目標 {Math.round(netWorthGoal / 10000).toLocaleString()} 萬
              </span>
              {achieved ? (
                <span className="flex items-center gap-1 font-bold text-amber-500">
                  <Trophy className="w-3 h-3" />
                  已超標 +{overPct.toFixed(1)}%
                </span>
              ) : (
                <span className="font-semibold text-indigo-600">{rawPct.toFixed(1)}%</span>
              )}
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
              <div
                className={`h-2 rounded-full transition-all duration-500 ${achieved
                  ? 'bg-gradient-to-r from-amber-400 to-yellow-300'
                  : 'bg-gradient-to-r from-indigo-400 to-violet-500'}`}
                style={{ width: `${barPct}%` }}
              />
            </div>
            <p className="text-[10px] mt-1">
              {achieved ? (
                <span className="text-amber-500 font-medium">
                  已超越目標 {formatCurrency(netWorth - netWorthGoal)}，恭喜達標！🎉
                </span>
              ) : (
                <span className="text-gray-400">
                  距目標還差 {formatCurrency(netWorthGoal - netWorth)}
                </span>
              )}
            </p>
          </div>
        )}

        {editingGoal ? (
          <div className="flex items-center gap-2 mt-1">
            <div className="flex-1 flex items-center border border-indigo-300 rounded-lg overflow-hidden focus-within:border-indigo-500">
              <input
                type="text"
                inputMode="decimal"
                autoFocus
                placeholder="如：1000"
                value={goalInput}
                onChange={e => setGoalInput(e.target.value.replace(/[^0-9.]/g, ''))}
                onKeyDown={e => { if (e.key === 'Enter') handleSaveGoal(); if (e.key === 'Escape') setEditingGoal(false); }}
                className="flex-1 px-2 py-1 text-sm outline-none bg-transparent"
              />
              <span className="pr-2 text-xs text-gray-400 font-medium">萬</span>
            </div>
            <button onClick={handleSaveGoal} className="p-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"><Check className="w-3.5 h-3.5" /></button>
            <button onClick={() => setEditingGoal(false)} className="p-1.5 bg-gray-100 text-gray-500 rounded-lg hover:bg-gray-200"><X className="w-3.5 h-3.5" /></button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="flex items-center bg-emerald-50 px-2 py-1 rounded-md text-sm text-emerald-600 font-medium">
              <ArrowUpRight className="w-4 h-4 mr-1" />
              即時計算
            </span>
            <button
              onClick={openEdit}
              className="flex items-center gap-1 px-2 py-1 text-xs text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors"
            >
              {hasGoal ? <Pencil className="w-3 h-3" /> : <Target className="w-3 h-3" />}
              {hasGoal ? '修改目標' : '設定目標'}
            </button>
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl p-6 shadow-[0_2px_20px_rgba(0,0,0,0.04)] border border-gray-100 relative overflow-hidden">
        <p className="text-sm font-medium text-gray-500 mb-2">總資產</p>
        <h2 className="text-3xl font-bold text-gray-900 mb-4">{formatCurrency(totalAssets)}</h2>
        <div className="w-full bg-gray-100 rounded-full h-1.5 mb-2 overflow-hidden">
          <div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: '100%' }}></div>
        </div>
      </div>

      <div className="bg-white rounded-2xl p-6 shadow-[0_2px_20px_rgba(0,0,0,0.04)] border border-gray-100 relative overflow-hidden">
        <p className="text-sm font-medium text-gray-500 mb-2">總負債</p>
        <h2 className="text-3xl font-bold text-gray-900 mb-4">{formatCurrency(totalLiabilities)}</h2>
        <div className="w-full bg-gray-100 rounded-full h-1.5 mb-2 overflow-hidden">
          <div className="bg-rose-400 h-1.5 rounded-full" style={{ width: totalAssets > 0 ? `${Math.min((totalLiabilities / totalAssets) * 100, 100)}%` : '0%' }}></div>
        </div>
        <div className="flex gap-3 text-xs text-gray-400">
          <span>負債比: {totalAssets > 0 ? ((totalLiabilities / totalAssets) * 100).toFixed(1) : '—'}%</span>
          <span className="text-gray-200">|</span>
          <span>D/E 比: {netWorth > 0 ? (totalLiabilities / netWorth).toFixed(2) : netWorth < 0 ? '資不抵債' : '—'}</span>
        </div>
      </div>
    </div>
  );
}
