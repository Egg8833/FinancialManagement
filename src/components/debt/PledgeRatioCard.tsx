"use client";
import { useState } from 'react';
import { AlertTriangle, AlertOctagon, ShieldCheck as ShieldOk, Wallet, PackagePlus, RotateCcw, Settings2 } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import {
  simulatePledge,
  repaymentForTargetRatio,
  collateralForTargetRatio,
  PLEDGE_CALL_RATIO,
  PLEDGE_WARN_RATIO,
} from '../../lib/pledgeCalc';
import { pledgeStatusStyle as statusStyle } from './pledgeStatusStyle';

const TARGET_PRESETS = [PLEDGE_CALL_RATIO, PLEDGE_WARN_RATIO, 200];

const TARGET_MIN = 100, TARGET_MAX = 500;

export function PledgeRatioCard({ platformName, totalBorrowValue, totalCollateralValueTWD }: { platformName: string; totalBorrowValue: number; totalCollateralValueTWD: number }) {
  const { showValues } = useAppContext();
  const [dropPct, setDropPct] = useState(0);
  const [repayInput, setRepayInput] = useState('');
  const [addInput, setAddInput] = useState('');
  const [targetRatio, setTargetRatio] = useState(PLEDGE_WARN_RATIO);

  if (totalBorrowValue <= 0) return null;

  // 有借款但尚未設定擔保品:維持率無意義,不顯示「追繳 0%」與模擬,只提示如何設定
  if (totalCollateralValueTWD <= 0) {
    return (
      <div className="mt-4 bg-white rounded-2xl border border-gray-200 p-5">
        <div className="flex items-center justify-between gap-4 mb-3">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full bg-gray-100 text-gray-500">
              <Settings2 className="w-3.5 h-3.5" /> 未設定擔保品
            </span>
            <span className="text-sm font-semibold text-gray-700">質押維持率</span>
            {platformName && <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{platformName}</span>}
          </div>
          <p className="text-3xl font-bold tabular-nums text-gray-300">—</p>
        </div>
        <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
          尚未設定此平台的擔保品股票（或股價尚未載入）。請至「股票」頁面，在對應股票的「平台」欄位填入「{platformName}」並設定擔保股數，即可計算維持率與情境模擬。
        </p>
      </div>
    );
  }

  const repayAmount = Math.max(0, Number(repayInput) || 0);
  const addCollateral = Math.max(0, Number(addInput) || 0);

  const now = simulatePledge(totalCollateralValueTWD, totalBorrowValue);
  const sim = simulatePledge(totalCollateralValueTWD, totalBorrowValue, { dropPct, repayAmount, addCollateral });
  const isSimulating = dropPct > 0 || repayAmount > 0 || addCollateral > 0;

  const nowStyle = statusStyle(now.status);
  const simStyle = statusStyle(sim.status);
  const fmt = (n: number) => Math.round(n).toLocaleString('en-US');
  const hidden = (n: number) => (showValues ? fmt(n) : '****');

  // 目標維持率回推：以「跌幅後、未還款未補繳」的狀態為基準;輸入值夾在合理範圍內再計算
  const effectiveTarget = Math.min(Math.max(targetRatio, TARGET_MIN), TARGET_MAX);
  const droppedCollateral = totalCollateralValueTWD * (1 - dropPct / 100);
  const needRepay = repaymentForTargetRatio(droppedCollateral, totalBorrowValue, effectiveTarget);
  const needCollateral = collateralForTargetRatio(droppedCollateral, totalBorrowValue, effectiveTarget);

  const BAR_MIN = 100, BAR_MAX = 250;
  const toBarPct = (v: number) => Math.min(Math.max((v - BAR_MIN) / (BAR_MAX - BAR_MIN) * 100, 0), 100);
  const barPct    = toBarPct(now.ratio);
  const simBarPct = toBarPct(sim.ratio);
  const dangerPct = toBarPct(PLEDGE_CALL_RATIO);
  const warnPct   = toBarPct(PLEDGE_WARN_RATIO);

  const reset = () => { setDropPct(0); setRepayInput(''); setAddInput(''); };

  return (
    <div className={`mt-4 bg-white rounded-2xl border ${isSimulating ? 'border-violet-200' : nowStyle.border} p-5 transition-colors`}>

      <div className="flex items-center justify-between gap-4 mb-5">
        <div className="flex items-center gap-2.5 flex-wrap">
          <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full ${nowStyle.badge} ${nowStyle.text}`}>
            <nowStyle.Icon className="w-3.5 h-3.5" />
            {nowStyle.label}
          </span>
          <span className="text-sm font-semibold text-gray-700">質押維持率</span>
          {platformName && <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{platformName}</span>}
        </div>
        <p className={`text-3xl font-bold tabular-nums ${nowStyle.text}`}>{now.ratio.toFixed(1)}%</p>
      </div>


      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="bg-gray-50 rounded-xl p-3">
          <p className="text-[10px] text-gray-400 mb-1">擔保品市值</p>
          <p className="text-sm font-bold text-gray-800 tabular-nums">{hidden(totalCollateralValueTWD)}</p>
          <p className="text-[10px] text-gray-400">TWD</p>
        </div>
        <div className="bg-gray-50 rounded-xl p-3">
          <p className="text-[10px] text-gray-400 mb-1">融資借款</p>
          <p className="text-sm font-bold text-gray-800 tabular-nums">{hidden(totalBorrowValue)}</p>
          <p className="text-[10px] text-gray-400">TWD</p>
        </div>
        <div className={`rounded-xl p-3 ${now.status === 'danger' ? 'bg-rose-50' : 'bg-emerald-50'}`}>
          <div className="flex items-center gap-1 mb-1 group relative">
            <p className="text-[10px] text-gray-400">{now.status === 'danger' ? '追繳缺口' : '安全緩衝'}</p>
            <span className="text-[10px] text-gray-300 cursor-default select-none">ⓘ</span>
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-52 bg-gray-800 text-white text-[11px] leading-relaxed rounded-lg px-3 py-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-lg">
              {now.status === 'danger'
                ? `擔保品市值低於追繳門檻的差額。需補充此金額的擔保品，才能回到安全線 (維持率 ${PLEDGE_CALL_RATIO}%)。`
                : `擔保品市值跌超過此金額後，維持率將低於 ${PLEDGE_CALL_RATIO}% 並觸發追繳。數字越大代表越安全。`}
              <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-800" />
            </div>
          </div>
          <p className={`text-sm font-bold tabular-nums ${now.status === 'danger' ? 'text-rose-600' : 'text-emerald-600'}`}>
            {showValues ? `${now.status === 'danger' ? '-' : '+'}${fmt(now.status === 'danger' ? now.shortage : now.buffer)}` : '****'}
          </p>
          <p className="text-[10px] text-gray-400">TWD</p>
        </div>
      </div>

      <div className="mb-5">
        <div className="relative h-4 rounded-full overflow-visible bg-gray-100">
          <div className="absolute inset-0 rounded-full overflow-hidden flex">
            <div className="h-full bg-rose-200"  style={{ width: `${dangerPct}%` }} />
            <div className="h-full bg-amber-100" style={{ width: `${warnPct - dangerPct}%` }} />
            <div className="h-full bg-emerald-100 flex-1" />
          </div>
          {isSimulating && !sim.isCleared && (
            <>
              <div className="absolute top-0 bottom-0 w-0.5 bg-violet-400 opacity-60" style={{ left: `${simBarPct}%` }} />
              <div
                className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-4 rounded-full border-2 bg-white transition-all ${simStyle.ring}`}
                style={{ left: `${simBarPct}%` }}
              />
            </>
          )}
          <div
            className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-4 rounded-full border-2 border-white shadow-md transition-all ${nowStyle.dot}`}
            style={{ left: `${barPct}%` }}
          />
          <div className="absolute top-0 bottom-0 w-0.5 bg-rose-400" style={{ left: `${dangerPct}%` }} />
          <div className="absolute top-0 bottom-0 w-0.5 bg-amber-400" style={{ left: `${warnPct}%` }} />
        </div>
        <div className="relative h-5 mt-1">
          <span className="absolute -translate-x-1/2 text-[10px] text-rose-500 font-medium" style={{ left: `${dangerPct}%` }}>
            ▲ {PLEDGE_CALL_RATIO}%<br />追繳線
          </span>
          <span className="absolute -translate-x-1/2 text-[10px] text-amber-500 font-medium" style={{ left: `${warnPct}%` }}>
            ▲ {PLEDGE_WARN_RATIO}%<br />警戒線
          </span>
        </div>
      </div>

      <div className="border-t border-gray-100 pt-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold text-gray-500 flex items-center gap-1.5">
            <span className="text-base">🧪</span> 情境模擬
          </span>
          {isSimulating && (
            <button onClick={reset} className="inline-flex items-center gap-1 text-[10px] text-violet-500 hover:text-violet-700 font-medium transition-colors">
              <RotateCcw className="w-3 h-3" /> 全部重置
            </button>
          )}
        </div>

        {/* 跌幅 */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-medium text-gray-500 flex items-center gap-1">📉 擔保品跌幅</span>
            <span className={`text-sm font-bold tabular-nums ${dropPct > 0 ? 'text-violet-600' : 'text-gray-400'}`}>
              {dropPct === 0 ? '無' : `-${dropPct}%`}
            </span>
          </div>
          <div className="flex flex-wrap gap-2 mb-2">
            {[10, 20, 30, 40, 50].map(p => (
              <button key={p} onClick={() => setDropPct(p)} className={`px-2 py-1 text-[10px] font-bold rounded-md transition-colors ${dropPct === p ? 'bg-violet-500 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                -{p}%
              </button>
            ))}
            <button onClick={() => setDropPct(0)} className={`px-2 py-1 text-[10px] font-bold rounded-md transition-colors ${dropPct === 0 ? 'bg-gray-500 text-white' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}>重置</button>
          </div>
          <input type="range" min={0} max={60} step={1} value={dropPct} onChange={e => setDropPct(Number(e.target.value))} className="w-full h-1.5 rounded-full appearance-none cursor-pointer accent-violet-500 bg-gray-200" />
          <div className="flex justify-between text-[10px] text-gray-400 mt-1 px-0.5">
            <span>0%</span><span>-15%</span><span>-30%</span><span>-45%</span><span>-60%</span>
          </div>
        </div>

        {/* 手動還款 + 補繳擔保品 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          <div className={`rounded-xl border p-3 transition-colors ${repayAmount > 0 ? 'border-sky-200 bg-sky-50/60' : 'border-gray-100 bg-gray-50'}`}>
            <label className="text-[11px] font-medium text-gray-500 mb-1.5 flex items-center gap-1">
              <Wallet className="w-3.5 h-3.5 text-sky-500" /> 手動還款 (TWD)
            </label>
            <input
              type="number" min={0} inputMode="numeric" value={repayInput}
              onChange={e => setRepayInput(e.target.value)}
              placeholder="0"
              className="w-full border rounded-lg p-2 text-sm tabular-nums bg-white"
            />
            <div className="flex flex-wrap gap-1.5 mt-2">
              {[100000, 300000, 500000].map(v => (
                <button key={v} onClick={() => setRepayInput(String(repayAmount + v))} className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-sky-100 text-sky-600 hover:bg-sky-200 transition-colors">
                  +{v / 10000}萬
                </button>
              ))}
              <button onClick={() => setRepayInput(String(Math.round(totalBorrowValue)))} className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-sky-100 text-sky-600 hover:bg-sky-200 transition-colors">全部還清</button>
              {repayInput !== '' && (
                <button onClick={() => setRepayInput('')} className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-gray-100 text-gray-400 hover:bg-gray-200 transition-colors">清空</button>
              )}
            </div>
            {repayAmount > totalBorrowValue && (
              <p className="mt-2 text-[10px] text-sky-600">已超過借款餘額，以還清 {hidden(totalBorrowValue)} 計算。</p>
            )}
          </div>

          <div className={`rounded-xl border p-3 transition-colors ${addCollateral > 0 ? 'border-emerald-200 bg-emerald-50/60' : 'border-gray-100 bg-gray-50'}`}>
            <label className="text-[11px] font-medium text-gray-500 mb-1.5 flex items-center gap-1">
              <PackagePlus className="w-3.5 h-3.5 text-emerald-500" /> 補繳擔保品市值 (TWD)
            </label>
            <input
              type="number" min={0} inputMode="numeric" value={addInput}
              onChange={e => setAddInput(e.target.value)}
              placeholder="0"
              className="w-full border rounded-lg p-2 text-sm tabular-nums bg-white"
            />
            <div className="flex flex-wrap gap-1.5 mt-2">
              {[100000, 300000, 500000].map(v => (
                <button key={v} onClick={() => setAddInput(String(addCollateral + v))} className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-emerald-100 text-emerald-600 hover:bg-emerald-200 transition-colors">
                  +{v / 10000}萬
                </button>
              ))}
              {addInput !== '' && (
                <button onClick={() => setAddInput('')} className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-gray-100 text-gray-400 hover:bg-gray-200 transition-colors">清空</button>
              )}
            </div>
            <p className="mt-2 text-[10px] text-gray-400">補繳的擔保品視為跌幅發生後才匯入，不隨跌幅縮水。</p>
          </div>
        </div>

        {/* 目標維持率回推 */}
        <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-3 mb-4">
          <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
            <span className="text-[11px] font-medium text-gray-500">🎯 想把維持率拉到</span>
            <div className="flex items-center gap-1.5">
              {TARGET_PRESETS.map(t => (
                <button key={t} onClick={() => setTargetRatio(t)} className={`px-2 py-0.5 text-[10px] font-bold rounded transition-colors ${targetRatio === t ? 'bg-indigo-500 text-white' : 'bg-white text-indigo-500 border border-indigo-100 hover:bg-indigo-100'}`}>
                  {t}%
                </button>
              ))}
              <input
                type="number" min={TARGET_MIN} max={TARGET_MAX} value={targetRatio}
                onChange={e => setTargetRatio(Math.max(0, Number(e.target.value) || 0))}
                onBlur={() => setTargetRatio(effectiveTarget)}
                className="w-16 border border-indigo-100 rounded px-1.5 py-0.5 text-[11px] tabular-nums bg-white"
              />
              <span className="text-[11px] text-gray-400">%</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-white/80 rounded-lg p-2.5">
              <p className="text-[10px] text-gray-400 mb-0.5">需手動還款</p>
              <p className="text-sm font-bold text-sky-600 tabular-nums">{needRepay === 0 ? '已達標' : hidden(needRepay)}</p>
              {needRepay > 0 && needRepay >= totalBorrowValue && <p className="text-[10px] text-gray-400">需全部還清仍不足</p>}
            </div>
            <div className="bg-white/80 rounded-lg p-2.5">
              <p className="text-[10px] text-gray-400 mb-0.5">或需補繳擔保品市值</p>
              <p className="text-sm font-bold text-emerald-600 tabular-nums">{needCollateral === 0 ? '已達標' : hidden(needCollateral)}</p>
            </div>
          </div>
          <p className="mt-2 text-[10px] text-gray-400">
            以{dropPct > 0 ? `下跌 ${dropPct}% 後` : '目前'}的擔保品市值計算目標 {effectiveTarget}%，兩個方案二選一即可。
          </p>
        </div>

        {isSimulating && (
          <div className={`rounded-xl border p-4 ${simStyle.bg} ${simStyle.border}`}>
            <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full ${simStyle.badge} ${simStyle.text}`}>
                  <simStyle.Icon className="w-3 h-3" />
                  {simStyle.label}
                </span>
                <span className="text-xs text-gray-500 flex flex-wrap gap-x-2">
                  {dropPct > 0 && <span>持股下跌 <span className="font-bold text-violet-600">{dropPct}%</span></span>}
                  {repayAmount > 0 && <span>還款 <span className="font-bold text-sky-600">{hidden(Math.min(repayAmount, totalBorrowValue))}</span></span>}
                  {addCollateral > 0 && <span>補繳 <span className="font-bold text-emerald-600">{hidden(addCollateral)}</span></span>}
                </span>
              </div>
              <div className="text-right">
                <span className={`text-2xl font-bold tabular-nums ${simStyle.text}`}>
                  {sim.isCleared ? '已還清' : `${sim.ratio.toFixed(1)}%`}
                </span>
                {!sim.isCleared && (
                  <p className={`text-[10px] font-medium tabular-nums ${sim.ratio >= now.ratio ? 'text-emerald-600' : 'text-rose-500'}`}>
                    {sim.ratio >= now.ratio ? '▲ +' : '▼ '}{(sim.ratio - now.ratio).toFixed(1)} pt（原 {now.ratio.toFixed(1)}%）
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="bg-white/70 rounded-lg p-2.5">
                <p className="text-[10px] text-gray-400 mb-0.5">模擬擔保品市值</p>
                <p className={`text-xs font-bold tabular-nums ${simStyle.text}`}>{hidden(sim.collateralValue)}</p>
                <p className="text-[10px] text-gray-400">
                  TWD{' '}
                  {sim.collateralValue !== totalCollateralValueTWD && (
                    <span className={sim.collateralValue < totalCollateralValueTWD ? 'text-rose-500' : 'text-emerald-600'}>
                      {sim.collateralValue < totalCollateralValueTWD ? '▼ ' : '▲ '}
                      {hidden(Math.abs(totalCollateralValueTWD - sim.collateralValue))}
                    </span>
                  )}
                </p>
              </div>
              <div className="bg-white/70 rounded-lg p-2.5">
                <p className="text-[10px] text-gray-400 mb-0.5">模擬借款餘額</p>
                <p className="text-xs font-bold text-gray-700 tabular-nums">{hidden(sim.borrowValue)}</p>
                <p className="text-[10px] text-gray-400">
                  TWD{' '}
                  {sim.borrowValue !== totalBorrowValue
                    ? <span className="text-emerald-600">▼ {hidden(totalBorrowValue - sim.borrowValue)}</span>
                    : <span>（不變）</span>}
                </p>
              </div>
              <div className="bg-white/70 rounded-lg p-2.5">
                <p className="text-[10px] text-gray-400 mb-0.5">{sim.status === 'danger' ? '追繳缺口' : '安全緩衝'}</p>
                <p className={`text-xs font-bold tabular-nums ${sim.status === 'danger' ? 'text-rose-600' : 'text-emerald-600'}`}>
                  {showValues ? `${sim.status === 'danger' ? '-' : '+'}${fmt(sim.status === 'danger' ? sim.shortage : sim.buffer)}` : '****'}
                </p>
                <p className="text-[10px] text-gray-400">TWD</p>
              </div>
            </div>

            {sim.status === 'danger' && !sim.isCleared && (
              <div className="mt-4 pt-4 border-t border-rose-200/50">
                <p className="text-xs font-bold text-rose-700 mb-2 flex items-center gap-1.5">
                  <AlertOctagon className="w-4 h-4" /> 這個情境下還需要補多少
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="bg-white/80 rounded-lg p-3 border border-rose-100">
                    <p className="text-[10px] text-gray-500 mb-1">方案 A：再手動還款</p>
                    <p className="text-sm font-bold text-rose-600">{hidden(repaymentForTargetRatio(sim.collateralValue, sim.borrowValue, PLEDGE_CALL_RATIO))} TWD</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">還款後維持率回升至 {PLEDGE_CALL_RATIO}%</p>
                  </div>
                  <div className="bg-white/80 rounded-lg p-3 border border-rose-100">
                    <p className="text-[10px] text-gray-500 mb-1">方案 B：再補繳擔保品</p>
                    <p className="text-sm font-bold text-rose-600">{hidden(collateralForTargetRatio(sim.collateralValue, sim.borrowValue, PLEDGE_CALL_RATIO))} TWD</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">匯入後維持率回升至 {PLEDGE_CALL_RATIO}%</p>
                  </div>
                </div>
                <p className="mt-3 text-[10px] text-rose-500/80 leading-relaxed italic">
                  * 建議預留更多緩衝，若要回升至 {PLEDGE_WARN_RATIO}% 警戒線，需補充約 {hidden(collateralForTargetRatio(sim.collateralValue, sim.borrowValue, PLEDGE_WARN_RATIO))} TWD 市值之股票。
                </p>
              </div>
            )}
            {sim.status === 'warn' && (
              <p className="mt-3 text-xs text-amber-600 bg-amber-100 rounded-lg px-3 py-2 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                此情境下維持率落在警戒區間。建議預留更多擔保品或再還款 {hidden(repaymentForTargetRatio(sim.collateralValue, sim.borrowValue, PLEDGE_WARN_RATIO))} TWD。
              </p>
            )}
            {sim.isCleared && (
              <p className="mt-3 text-xs text-emerald-700 bg-emerald-100 rounded-lg px-3 py-2 flex items-center gap-1.5">
                <ShieldOk className="w-3.5 h-3.5 shrink-0" />
                借款已全部還清，此情境下無追繳風險。
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
