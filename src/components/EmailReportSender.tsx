"use client";

import { useState, useEffect } from 'react';
import { Mail, Send, CheckCircle, AlertCircle, Loader2, X } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import type { ReportPayload } from '../lib/mail';
import { computePledgeRatios, buildReportPledgeRatios } from '../lib/pledgeCalc';

export function EmailReportSender() {
  const ctx = useAppContext();
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    if (isOpen) {
      setEmail(ctx.userEmail);
    } else {
      setResult(null);
    }
  }, [isOpen, ctx.userEmail]);

  const buildReportData = (): ReportPayload => {
    const usdToTwd = ctx.usdToTwd;

    return {
      totalAssets: ctx.totalAssets,
      totalLiabilities: ctx.totalLiabilities,
      netWorth: ctx.netWorth,
      totalMonthlyIncome: ctx.totalMonthlyIncome,
      totalMonthlyExpense: ctx.totalMonthlyExpense,
      monthlyNetCashFlow: ctx.monthlyNetCashFlow,
      usdToTwd,
      combinedAssets: ctx.combinedAssets.map(cat => ({
        title: cat.title,
        items: cat.items.map(i => ({ name: i.name, amount: i.amount })),
      })),
      combinedLiabilities: ctx.combinedLiabilities.map(item => ({
        name: item.name,
        description: item.description,
        amount: item.amount,
      })),
      loans: ctx.loans.map(loan => ({
        name: loan.name,
        bank: loan.bank,
        principal: loan.principal,
        interestRate: loan.interestRate,
        monthlyPayment: loan.monthlyPayment,
        remainingPeriods: loan.remainingPeriods,
      })),
      // 質押資料
      stakingItems: ctx.stakingItems.map(item => ({
        name: item.name,
        protocol: item.protocol,
        value: item.value,
        apy: item.apy,
        stakingType: item.stakingType,
        monthlyInterest: item.value * item.apy / 100 / 12,
        borrowDate: item.borrowDate,
        repayDate: item.repayDate,
      })),
      // 持股資料（avgCost = 總成本，非每股均價）
      stockItems: ctx.stockItems.map(stock => {
        const quote = ctx.stockQuotes[stock.symbol];
        const currentPrice = quote?.price || 0;
        const currency = quote?.currency || 'TWD';
        const changePercent = quote?.changePercent || 0;
        const marketValueRaw = currentPrice * stock.shares;
        const marketValueTWD = currency === 'USD' ? marketValueRaw * usdToTwd : marketValueRaw;
        // avgCost 為總成本，需換算為 TWD
        const costBasis = currency === 'USD' ? stock.avgCost * usdToTwd : stock.avgCost;
        const unrealizedPnL = marketValueTWD - costBasis;
        const unrealizedPnLPct = costBasis > 0 ? (unrealizedPnL / costBasis) * 100 : 0;
        return {
          symbol: stock.symbol,
          shortName: quote?.shortName,
          platform: stock.platform,
          shares: stock.shares,
          avgCost: stock.avgCost,
          currentPrice,
          currency,
          changePercent,
          marketValueTWD: Math.round(marketValueTWD),
          costBasis: Math.round(costBasis),
          unrealizedPnL: Math.round(unrealizedPnL),
          unrealizedPnLPct,
        };
      }),
      // 質押維持率（按平台分組）
      pledgeRatioData: buildReportPledgeRatios(computePledgeRatios(ctx.stakingItems, ctx.stockItems, ctx.stockQuotes, usdToTwd)),
      generatedAt: new Date().toISOString(),
    };
  };


  const handleSend = async () => {
    if (!email || !email.includes('@')) {
      setResult({ success: false, message: '請輸入有效的 Email 地址' });
      return;
    }
    if (ctx.assetsLoading) {
      setResult({ success: false, message: '雲端資料載入中，請稍候再試' });
      return;
    }

    setSending(true);
    setResult(null);

    try {
      const res = await fetch('/api/cron/send-asset-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipientEmail: email,
          reportData: buildReportData(),
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setResult({ success: true, message: data.message || '報表寄送成功！' });
        toast('📧 資產報表已寄出');
        ctx.setLastReportSent(new Date().toLocaleDateString('en-CA'));
      } else {
        setResult({ success: false, message: data.error || '寄送失敗' });
        toast(data.error || '寄送失敗', 'error');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : '網路連線失敗';
      setResult({ success: false, message: msg });
      toast(msg, 'error');
    } finally {
      setSending(false);
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        title="寄送資產報表"
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors"
      >
        <Mail className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">寄送報表</span>
      </button>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setIsOpen(false)}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-violet-600 px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3 text-white">
            <Mail className="w-5 h-5" />
            <h3 className="font-bold text-lg">寄送資產報表</h3>
          </div>
          <button onClick={() => setIsOpen(false)} className="text-white/70 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          <p className="text-sm text-gray-500">
            將目前的資產狀況報表以電子郵件寄送。報表內容包含資產、負債、現金流及貸款明細。
          </p>

          {/* Email Input */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">收件人 Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="your@email.com"
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all"
              disabled={sending}
            />
          </div>

          {/* Preview Info */}
          <div className="bg-gray-50 rounded-xl p-4 space-y-2">
            <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">報表預覽摘要</div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">淨資產</span>
              <span className="font-bold text-indigo-600">NT$ {ctx.netWorth.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">總資產</span>
              <span className="font-semibold text-emerald-600">NT$ {ctx.totalAssets.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">總負債</span>
              <span className="font-semibold text-rose-600">NT$ {ctx.totalLiabilities.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm border-t border-gray-200 pt-2 mt-2">
              <span className="text-gray-600">月淨現金流</span>
              <span className={`font-semibold ${ctx.monthlyNetCashFlow >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                NT$ {ctx.monthlyNetCashFlow.toLocaleString()}
              </span>
            </div>
          </div>

          {/* Result Message */}
          {result && (
            <div className={`flex items-start gap-2 p-3 rounded-lg text-sm ${
              result.success ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
            }`}>
              {result.success
                ? <CheckCircle className="w-4 h-4 mt-0.5 shrink-0" />
                : <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              }
              <span>{result.message}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
          <button
            onClick={() => setIsOpen(false)}
            className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleSend}
            disabled={sending || !email || ctx.assetsLoading}
            title={ctx.assetsLoading ? '雲端資料載入中，請稍候' : undefined}
            className="flex items-center gap-2 px-5 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
          >
            {sending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                寄送中...
              </>
            ) : ctx.assetsLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                資料載入中...
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                立即寄送
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
