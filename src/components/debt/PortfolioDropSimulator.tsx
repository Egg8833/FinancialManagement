"use client";
import { useMemo, useState } from 'react';
import { AlertOctagon, ShieldCheck as ShieldOk, Layers, RotateCcw, Settings2 } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import {
  simulatePortfolio,
  collateralForTargetRatio,
  repaymentForTargetRatio,
  PLEDGE_CALL_RATIO,
  PLEDGE_WARN_RATIO,
  type PledgeAccount,
  type PledgeAdjustment,
} from '../../lib/pledgeCalc';
import { pledgeStatusStyle as tone } from './pledgeStatusStyle';


/** 多帳戶一起下跌同一個百分比時，各平台與合併維持率的變化。 */
export function PortfolioDropSimulator({ accounts }: { accounts: PledgeAccount[] }) {
  const { showValues } = useAppContext();
  const [dropPct, setDropPct] = useState(20);
  const [adjustments, setAdjustments] = useState<Record<string, PledgeAdjustment>>({});

  const result = useMemo(() => simulatePortfolio(accounts, dropPct, adjustments), [accounts, dropPct, adjustments]);

  // 至少兩個「已設定擔保品」的借款帳戶才有多帳戶比較的意義
  if (result.accounts.length < 2) return null;

  const fmt = (n: number) => Math.round(n).toLocaleString('en-US');
  const hidden = (n: number) => (showValues ? fmt(n) : '****');
  const setAdjustment = (platform: string, key: 'repayAmount' | 'addCollateral', v: string) =>
    setAdjustments(prev => ({ ...prev, [platform]: { ...prev[platform], [key]: Math.max(0, Number(v) || 0) } }));
  const setRepay = (platform: string, v: string) => setAdjustment(platform, 'repayAmount', v);
  const hasAdjustments = Object.values(adjustments).some(a => (a.repayAmount ?? 0) > 0 || (a.addCollateral ?? 0) > 0);

  const totalTone = tone(result.total.after.status);
  /** 全部帳戶中最早被追繳的那一個，決定整體還能跌多少。 */
  const firstToBreak = result.accounts.reduce(
    (min, a) => (!min || a.dropPctToCall < min.dropPctToCall ? a : min),
    null as (typeof result.accounts)[number] | null,
  );

  return (
    <div className="mb-8 bg-white rounded-2xl border border-indigo-100 p-5">
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full bg-indigo-100 text-indigo-600">
            <Layers className="w-3.5 h-3.5" /> 多帳戶
          </span>
          <span className="text-sm font-semibold text-gray-700">同步下跌情境模擬</span>
          <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{result.accounts.length} 個平台</span>
        </div>
        {hasAdjustments && (
          <button onClick={() => setAdjustments({})} className="inline-flex items-center gap-1 text-[10px] text-indigo-500 hover:text-indigo-700 font-medium transition-colors">
            <RotateCcw className="w-3 h-3" /> 清除所有試算
          </button>
        )}
      </div>

      {/* 共同跌幅 */}
      <div className="mb-5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-medium text-gray-500">📉 所有帳戶的擔保品一起下跌</span>
          <span className="text-lg font-bold tabular-nums text-violet-600">-{dropPct}%</span>
        </div>
        <div className="flex flex-wrap gap-2 mb-2">
          {[0, 10, 20, 30, 40, 50].map(p => (
            <button key={p} onClick={() => setDropPct(p)} className={`px-2 py-1 text-[10px] font-bold rounded-md transition-colors ${dropPct === p ? 'bg-violet-500 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
              {p === 0 ? '不跌' : `-${p}%`}
            </button>
          ))}
          {firstToBreak && firstToBreak.dropPctToCall > 0 && (
            <button
              onClick={() => setDropPct(Math.ceil(firstToBreak.dropPctToCall))}
              className="px-2 py-1 text-[10px] font-bold rounded-md bg-rose-100 text-rose-600 hover:bg-rose-200 transition-colors"
            >
              跌到第一個追繳（-{Math.ceil(firstToBreak.dropPctToCall)}%）
            </button>
          )}
        </div>
        <input type="range" min={0} max={70} step={1} value={dropPct} onChange={e => setDropPct(Number(e.target.value))} className="w-full h-1.5 rounded-full appearance-none cursor-pointer accent-violet-500 bg-gray-200" />
        <div className="flex justify-between text-[10px] text-gray-400 mt-1 px-0.5">
          <span>0%</span><span>-20%</span><span>-40%</span><span>-60%</span>
        </div>
      </div>

      {/* 總結 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <div className={`rounded-xl p-3 ${totalTone.row}`}>
          <p className="text-[10px] text-gray-400 mb-0.5">合併維持率</p>
          <p className={`text-base font-bold tabular-nums ${totalTone.text}`}>
            {result.total.after.isCleared ? '已還清' : `${result.total.after.ratio.toFixed(1)}%`}
          </p>
          <p className="text-[10px] text-gray-400">原 {result.total.before.ratio.toFixed(1)}%</p>
        </div>
        <div className="rounded-xl p-3 bg-gray-50">
          <p className="text-[10px] text-gray-400 mb-0.5">落入追繳的帳戶</p>
          <p className={`text-base font-bold tabular-nums ${result.breached.length > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
            {result.breached.length} / {result.accounts.length}
          </p>
          <p className="text-[10px] text-gray-400 truncate">{result.breached.length > 0 ? result.breached.join('、') : '全部安全'}</p>
        </div>
        <div className="rounded-xl p-3 bg-gray-50">
          <p className="text-[10px] text-gray-400 mb-0.5">合計追繳缺口</p>
          <p className={`text-base font-bold tabular-nums ${result.totalShortage > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
            {result.totalShortage > 0 ? hidden(result.totalShortage) : '0'}
          </p>
          <p className="text-[10px] text-gray-400">TWD</p>
        </div>
        <div className="rounded-xl p-3 bg-gray-50">
          <p className="text-[10px] text-gray-400 mb-0.5">最先被追繳</p>
          <p className="text-base font-bold text-gray-800 truncate">{firstToBreak?.platform ?? '—'}</p>
          <p className="text-[10px] text-gray-400">
            {firstToBreak ? (firstToBreak.dropPctToCall > 0 ? `再跌 ${firstToBreak.dropPctToCall.toFixed(1)}%` : '已低於追繳線') : ''}
          </p>
        </div>
      </div>

      {result.unconfigured.length > 0 && (
        <p className="text-[11px] text-gray-500 bg-gray-50 rounded-lg px-3 py-2 mb-4 flex items-center gap-1.5">
          <Settings2 className="w-3.5 h-3.5 shrink-0 text-gray-400" />
          {result.unconfigured.join('、')} 尚未設定擔保品，未納入模擬。
        </p>
      )}

      {result.total.before.ratio > 0 && (
        <p className="text-[10px] text-gray-400 mb-4 leading-relaxed">
          * 合併維持率只是把所有帳戶的擔保品與借款加總的參考值。實際上各平台不能互相抵充，追繳是逐個帳戶判斷的，請以下方每個帳戶的數字為準。
        </p>
      )}

      {/* 各帳戶明細 */}
      <div className="overflow-x-auto -mx-1 px-1">
        <table className="w-full text-xs min-w-[760px]">
          <thead>
            <tr className="text-[10px] text-gray-400 text-left">
              <th className="font-medium pb-2 pl-2">平台</th>
              <th className="font-medium pb-2 text-right">目前維持率</th>
              <th className="font-medium pb-2 text-right">跌 {dropPct}% 後</th>
              <th className="font-medium pb-2 text-right" title="已計入該帳戶的還款 / 補繳試算">距追繳</th>
              <th className="font-medium pb-2 text-right">缺口 / 緩衝</th>
              <th className="font-medium pb-2 text-right pr-2">還款 / 補繳試算</th>
            </tr>
          </thead>
          <tbody>
            {result.accounts.map(a => {
              const t = tone(a.after.status);
              const repay = adjustments[a.platform]?.repayAmount ?? 0;
              const add = adjustments[a.platform]?.addCollateral ?? 0;
              return (
                <tr key={a.platform} className={`${t.row} border-t border-white`}>
                  <td className="py-2.5 pl-2 rounded-l-lg">
                    <div className="flex items-center gap-1.5">
                      <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${t.badge} ${t.text}`}>
                        <t.Icon className="w-3 h-3" />
                        {t.label}
                      </span>
                      <span className="font-semibold text-gray-700">{a.platform}</span>
                    </div>
                  </td>
                  <td className="py-2.5 text-right tabular-nums text-gray-500">{a.before.ratio.toFixed(1)}%</td>
                  <td className={`py-2.5 text-right tabular-nums font-bold ${t.text}`}>
                    {a.after.isCleared ? '已還清' : `${a.after.ratio.toFixed(1)}%`}
                  </td>
                  <td className="py-2.5 text-right tabular-nums text-gray-500">
                    {a.dropPctToCall > 0 ? `還能跌 ${a.dropPctToCall.toFixed(1)}%` : '已觸及'}
                  </td>
                  <td className={`py-2.5 text-right tabular-nums font-medium ${a.after.status === 'danger' ? 'text-rose-600' : 'text-emerald-600'}`}>
                    {a.after.isCleared ? '—' : `${a.after.status === 'danger' ? '-' : '+'}${hidden(a.after.status === 'danger' ? a.after.shortage : a.after.buffer)}`}
                  </td>
                  <td className="py-2.5 pr-2 rounded-r-lg">
                    <div className="flex items-center justify-end gap-1.5">
                      <input
                        type="number" min={0} inputMode="numeric"
                        value={repay === 0 ? '' : repay}
                        onChange={e => setRepay(a.platform, e.target.value)}
                        placeholder="還款"
                        aria-label={`${a.platform} 手動還款試算`}
                        className="w-24 border border-sky-200 rounded-lg px-2 py-1 text-xs tabular-nums text-right bg-white placeholder:text-sky-300"
                      />
                      <input
                        type="number" min={0} inputMode="numeric"
                        value={add === 0 ? '' : add}
                        onChange={e => setAdjustment(a.platform, 'addCollateral', e.target.value)}
                        placeholder="補繳"
                        aria-label={`${a.platform} 補繳擔保品試算`}
                        title="補繳的擔保品視為跌幅發生後才匯入，不隨跌幅縮水"
                        className="w-24 border border-emerald-200 rounded-lg px-2 py-1 text-xs tabular-nums text-right bg-white placeholder:text-emerald-300"
                      />
                      {a.after.status === 'danger' && !a.after.isCleared && (
                        <button
                          onClick={() => setRepay(a.platform, String(repay + repaymentForTargetRatio(a.after.collateralValue, a.after.borrowValue, PLEDGE_CALL_RATIO)))}
                          className="px-1.5 py-1 text-[10px] font-bold rounded bg-sky-100 text-sky-600 hover:bg-sky-200 transition-colors whitespace-nowrap"
                          title={`自動填入回到 ${PLEDGE_CALL_RATIO}% 所需的還款金額`}
                        >
                          還款補到 {PLEDGE_CALL_RATIO}%
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {result.breached.length > 0 ? (
        <div className="mt-4 rounded-xl bg-rose-50 border border-rose-200 p-4">
          <p className="text-xs font-bold text-rose-700 mb-2 flex items-center gap-1.5">
            <AlertOctagon className="w-4 h-4" /> 一起下跌 {dropPct}% 時，{result.breached.length} 個帳戶會被追繳
          </p>
          <div className="space-y-1.5">
            {result.accounts.filter(a => a.after.status === 'danger' && !a.after.isCleared).map(a => (
              <p key={a.platform} className="text-[11px] text-gray-600">
                <span className="font-semibold text-rose-700">{a.platform}</span>：維持率 {a.after.ratio.toFixed(1)}%，
                需還款 {hidden(repaymentForTargetRatio(a.after.collateralValue, a.after.borrowValue, PLEDGE_CALL_RATIO))}
                {' '}或補繳擔保品 {hidden(collateralForTargetRatio(a.after.collateralValue, a.after.borrowValue, PLEDGE_CALL_RATIO))} TWD 才能回到 {PLEDGE_CALL_RATIO}%
              </p>
            ))}
          </div>
          <p className="mt-2.5 text-[11px] text-rose-600 font-medium">
            全部帳戶一次補到 {PLEDGE_CALL_RATIO}% 共需準備現金 {hidden(result.accounts.reduce((s, a) => s + repaymentForTargetRatio(a.after.collateralValue, a.after.borrowValue, PLEDGE_CALL_RATIO), 0))} TWD。
          </p>
        </div>
      ) : (
        <p className="mt-4 text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2.5 flex items-center gap-1.5">
          <ShieldOk className="w-3.5 h-3.5 shrink-0" />
          一起下跌 {dropPct}% 時，所有帳戶都還在追繳線 {PLEDGE_CALL_RATIO}% 之上
          {result.worst && `，最低的是 ${result.worst.platform} ${result.worst.after.ratio.toFixed(1)}%`}
          {result.worst && result.worst.after.ratio < PLEDGE_WARN_RATIO && '（已進入警戒區間）'}。
        </p>
      )}
    </div>
  );
}
