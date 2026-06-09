"use client";
import { useState } from 'react';
import { AlertTriangle, AlertOctagon, ShieldCheck as ShieldOk } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';

export function PledgeRatioCard({ platformName, totalBorrowValue, totalCollateralValueTWD }: { platformName: string; totalBorrowValue: number; totalCollateralValueTWD: number }) {
  const { showValues } = useAppContext();
  const [dropPct, setDropPct] = useState(0);

  if (totalBorrowValue <= 0) return null;

  const ratio    = (totalCollateralValueTWD / totalBorrowValue) * 100;
  const isRed    = ratio < 130;
  const isYellow = ratio >= 130 && ratio < 166;

  const borderClass = isRed ? 'border-rose-200' : isYellow ? 'border-amber-200' : 'border-emerald-100';
  const textClass   = isRed ? 'text-rose-600'   : isYellow ? 'text-amber-600'   : 'text-emerald-600';
  const badgeBg     = isRed ? 'bg-rose-100'     : isYellow ? 'bg-amber-100'     : 'bg-emerald-100';
  const Icon        = isRed ? AlertOctagon       : isYellow ? AlertTriangle      : ShieldOk;
  const statusText  = isRed ? '危險' : isYellow ? '警戒' : '安全';
  const buffer   = Math.round(totalCollateralValueTWD - totalBorrowValue * 1.30);
  const shortage = Math.round(totalBorrowValue * 1.30 - totalCollateralValueTWD);

  const simCollateral = totalCollateralValueTWD * (1 - dropPct / 100);
  const simRatio      = totalBorrowValue > 0 ? (simCollateral / totalBorrowValue) * 100 : 0;
  const simIsRed      = simRatio < 130;
  const simIsYellow   = simRatio >= 130 && simRatio < 166;
  const simBuffer     = Math.round(simCollateral - totalBorrowValue * 1.30);
  const simShortage   = Math.round(totalBorrowValue * 1.30 - simCollateral);
  const simTextClass  = simIsRed ? 'text-rose-600' : simIsYellow ? 'text-amber-600' : 'text-emerald-600';
  const simBadgeBg    = simIsRed ? 'bg-rose-100'   : simIsYellow ? 'bg-amber-100'   : 'bg-emerald-100';
  const SimIcon       = simIsRed ? AlertOctagon     : simIsYellow ? AlertTriangle    : ShieldOk;
  const simStatusText = simIsRed ? '危險' : simIsYellow ? '警戒' : '安全';
  const isSimulating  = dropPct > 0;

  const BAR_MIN = 100, BAR_MAX = 200;
  const toBarPct  = (v: number) => Math.min(Math.max((v - BAR_MIN) / (BAR_MAX - BAR_MIN) * 100, 0), 100);
  const barPct    = toBarPct(ratio);
  const simBarPct = toBarPct(simRatio);
  const dangerPct = toBarPct(130);
  const warnPct   = toBarPct(166);

  return (
    <div className={`mt-4 bg-white rounded-2xl border ${isSimulating ? 'border-violet-200' : borderClass} p-5 transition-colors`}>

      <div className="flex items-center justify-between gap-4 mb-5">
        <div className="flex items-center gap-2.5 flex-wrap">
          <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full ${badgeBg} ${textClass}`}>
            <Icon className="w-3.5 h-3.5" />
            {statusText}
          </span>
          <span className="text-sm font-semibold text-gray-700">質押維持率</span>
          {platformName && <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{platformName}</span>}
        </div>
        <p className={`text-3xl font-bold tabular-nums ${totalCollateralValueTWD <= 0 ? 'text-gray-300' : textClass}`}>
          {totalCollateralValueTWD <= 0 ? '—' : `${ratio.toFixed(1)}%`}
        </p>
      </div>

      {totalCollateralValueTWD <= 0 && (
        <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2 mb-4">
          尚未設定此平台的擔保品股票。請至「股票」頁面，在對應股票的「平台」欄位填入「{platformName}」並設定擔保股數。
        </p>
      )}

      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="bg-gray-50 rounded-xl p-3">
          <p className="text-[10px] text-gray-400 mb-1">擔保品市值</p>
          <p className="text-sm font-bold text-gray-800 tabular-nums">{showValues ? Math.round(totalCollateralValueTWD).toLocaleString('en-US') : '****'}</p>
          <p className="text-[10px] text-gray-400">TWD</p>
        </div>
        <div className="bg-gray-50 rounded-xl p-3">
          <p className="text-[10px] text-gray-400 mb-1">融資借款</p>
          <p className="text-sm font-bold text-gray-800 tabular-nums">{showValues ? totalBorrowValue.toLocaleString('en-US') : '****'}</p>
          <p className="text-[10px] text-gray-400">TWD</p>
        </div>
        <div className={`rounded-xl p-3 ${isRed ? 'bg-rose-50' : 'bg-emerald-50'}`}>
          <div className="flex items-center gap-1 mb-1 group relative">
            <p className="text-[10px] text-gray-400">{isRed ? '追繳缺口' : '安全緩衝'}</p>
            <span className="text-[10px] text-gray-300 cursor-default select-none">ⓘ</span>
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-52 bg-gray-800 text-white text-[11px] leading-relaxed rounded-lg px-3 py-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-lg">
              {isRed
                ? '擔保品市值低於追繳門檻的差額。需補充此金額的擔保品，才能回到安全線 (維持率 130%)。'
                : '擔保品市值跌超過此金額後，維持率將低於 130% 並觸發追繳。數字越大代表越安全。'}
              <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-800" />
            </div>
          </div>
          <p className={`text-sm font-bold tabular-nums ${isRed ? 'text-rose-600' : 'text-emerald-600'}`}>
            {showValues ? `${isRed ? '-' : '+'}${(isRed ? shortage : buffer).toLocaleString('en-US')}` : '****'}
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
          {isSimulating && (
            <>
              <div className="absolute top-0 bottom-0 w-0.5 bg-violet-400 opacity-60" style={{ left: `${simBarPct}%` }} />
              <div
                className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-4 rounded-full border-2 bg-white transition-all ${simIsRed ? 'border-rose-500' : simIsYellow ? 'border-amber-400' : 'border-emerald-500'}`}
                style={{ left: `${simBarPct}%` }}
              />
            </>
          )}
          <div
            className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-4 rounded-full border-2 border-white shadow-md transition-all ${isRed ? 'bg-rose-500' : isYellow ? 'bg-amber-400' : 'bg-emerald-500'}`}
            style={{ left: `${barPct}%` }}
          />
          <div className="absolute top-0 bottom-0 w-0.5 bg-rose-400" style={{ left: `${dangerPct}%` }} />
          <div className="absolute top-0 bottom-0 w-0.5 bg-amber-400" style={{ left: `${warnPct}%` }} />
        </div>
        <div className="relative h-5 mt-1">
          <span className="absolute -translate-x-1/2 text-[10px] text-rose-500 font-medium" style={{ left: `${dangerPct}%` }}>
            ▲ 130%<br />追繳線
          </span>
          <span className="absolute -translate-x-1/2 text-[10px] text-amber-500 font-medium" style={{ left: `${warnPct}%` }}>
            ▲ 166%<br />警戒線
          </span>
        </div>
      </div>

      <div className="border-t border-gray-100 pt-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold text-gray-500 flex items-center gap-1.5">
            <span className="text-base">📉</span> 跌幅模擬
          </span>
          <div className="flex items-center gap-2">
            {isSimulating && (
              <button onClick={() => setDropPct(0)} className="text-[10px] text-violet-500 hover:text-violet-700 font-medium transition-colors">重置</button>
            )}
            <span className={`text-sm font-bold tabular-nums min-w-[3rem] text-right ${isSimulating ? 'text-violet-600' : 'text-gray-400'}`}>
              {dropPct === 0 ? '無模擬' : `-${dropPct}%`}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mb-3">
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

        {isSimulating && (
          <div className={`mt-4 rounded-xl border p-4 ${simIsRed ? 'bg-rose-50 border-rose-200' : simIsYellow ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 border-emerald-100'}`}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full ${simBadgeBg} ${simTextClass}`}>
                  <SimIcon className="w-3 h-3" />
                  {simStatusText}
                </span>
                <span className="text-xs text-gray-500">
                  若持股整體下跌 <span className="font-bold text-violet-600">{dropPct}%</span>
                </span>
              </div>
              <span className={`text-2xl font-bold tabular-nums ${simTextClass}`}>{simRatio.toFixed(1)}%</span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="bg-white/70 rounded-lg p-2.5">
                <p className="text-[10px] text-gray-400 mb-0.5">模擬擔保品市值</p>
                <p className={`text-xs font-bold tabular-nums ${simTextClass}`}>{Math.round(simCollateral).toLocaleString()}</p>
                <p className="text-[10px] text-gray-400">TWD <span className="text-rose-500">▼ {Math.round(totalCollateralValueTWD - simCollateral).toLocaleString()}</span></p>
              </div>
              <div className="bg-white/70 rounded-lg p-2.5">
                <p className="text-[10px] text-gray-400 mb-0.5">融資借款</p>
                <p className="text-xs font-bold text-gray-700 tabular-nums">{totalBorrowValue.toLocaleString()}</p>
                <p className="text-[10px] text-gray-400">TWD（不變）</p>
              </div>
              <div className="bg-white/70 rounded-lg p-2.5">
                <p className="text-[10px] text-gray-400 mb-0.5">{simIsRed ? '追繳缺口' : '安全緩衝'}</p>
                <p className={`text-xs font-bold tabular-nums ${simIsRed ? 'text-rose-600' : 'text-emerald-600'}`}>
                  {simIsRed ? '-' : '+'}{(simIsRed ? simShortage : simBuffer).toLocaleString()}
                </p>
                <p className="text-[10px] text-gray-400">TWD</p>
              </div>
            </div>

            {simIsRed && (
              <div className="mt-4 pt-4 border-t border-rose-200/50">
                <p className="text-xs font-bold text-rose-700 mb-2 flex items-center gap-1.5">
                  <AlertOctagon className="w-4 h-4" /> 補救方案試算
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="bg-white/80 rounded-lg p-3 border border-rose-100">
                    <p className="text-[10px] text-gray-500 mb-1">方案 A：補充現金 (償還借款)</p>
                    <p className="text-sm font-bold text-rose-600">需償還 {Math.ceil(totalBorrowValue - simCollateral / 1.3).toLocaleString()} TWD</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">償還後維持率可回升至 130%</p>
                  </div>
                  <div className="bg-white/80 rounded-lg p-3 border border-rose-100">
                    <p className="text-[10px] text-gray-500 mb-1">方案 B：補充擔保品 (匯入股票)</p>
                    <p className="text-sm font-bold text-rose-600">需匯入市值 {Math.ceil(totalBorrowValue * 1.3 - simCollateral).toLocaleString()} TWD</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">匯入後維持率可回升至 130%</p>
                  </div>
                </div>
                <p className="mt-3 text-[10px] text-rose-500/80 leading-relaxed italic">
                  * 建議預留更多緩衝，若要回升至 166% 警戒線，需補充約 {Math.ceil(totalBorrowValue * 1.66 - simCollateral).toLocaleString()} TWD 市值之股票。
                </p>
              </div>
            )}
            {simIsYellow && !simIsRed && (
              <p className="mt-3 text-xs text-amber-600 bg-amber-100 rounded-lg px-3 py-2 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                持股下跌 {dropPct}% 後將進入警戒區間。建議預留更多擔保品或部分還款。
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
