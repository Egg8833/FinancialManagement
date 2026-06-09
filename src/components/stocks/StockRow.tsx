"use client";
import { useState } from 'react';
import { Pencil, Trash2, Check, X, ChevronDown, ChevronUp, ShieldCheck, FileText } from 'lucide-react';
import { type StockItem, type StockQuote } from '../../context/AppContext';
import { useNameLookup } from '../../hooks/useNameLookup';
import { StockAvatar } from './StockAvatar';
import { MarketSelector } from './MarketSelector';
import { type Market, MARKET_BADGE, getMarket, toSymbol, sharesToUnit, unitToShares } from '../../lib/stockUtils';

const SYMBOL_PLACEHOLDER: Record<Market, string> = {
  '台股': '如: 0050, 2330',
  '美股': '如: AAPL, TSLA',
  '其他': '如: BTC-USD',
};

export function StockRow({
  item,
  quote,
  usdToTwd,
  totalPortfolioTWD,
  enablePledgeTracking,
  onUpdate,
  onDelete,
}: {
  item: StockItem;
  quote?: StockQuote;
  usdToTwd: number;
  totalPortfolioTWD: number;
  enablePledgeTracking: boolean;
  onUpdate: (data: Partial<StockItem>) => void;
  onDelete: () => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const [editMarket, setEditMarket] = useState<Market>(getMarket(item.symbol));
  const [editSymbolRaw, setEditSymbolRaw] = useState(
    item.symbol.endsWith('.TW') ? item.symbol.slice(0, -3) : item.symbol
  );
  const [editPlatform, setEditPlatform] = useState(item.platform || '');
  const [editShares, setEditShares] = useState(item.shares.toString());
  const [editAvgCost, setEditAvgCost] = useState(item.avgCost.toString());
  const [editCollateralShares, setEditCollateralShares] = useState((item.collateralShares ?? 0).toString());
  const [editNotes, setEditNotes] = useState(item.notes || '');
  const [editPurchaseDate, setEditPurchaseDate] = useState(item.purchaseDate || '');

  const editSymbolFull = toSymbol(editSymbolRaw, editMarket);
  const editNamePreview = useNameLookup(editSymbolRaw ? editSymbolFull : '');

  const handleSave = () => {
    const totalShares = Number(editShares) || 0;
    const collateral = Math.min(unitToShares(Number(editCollateralShares) || 0, editMarket), totalShares);
    onUpdate({
      symbol: editSymbolFull,
      platform: editPlatform.trim(),
      shares: totalShares,
      avgCost: Number(editAvgCost) || 0,
      collateralShares: collateral,
      notes: editNotes.trim(),
      purchaseDate: editPurchaseDate || undefined,
    });
    setIsEditing(false);
  };

  const currentPrice = quote?.price || 0;
  const isUSD = quote?.currency === 'USD';
  const currencySymbol = isUSD ? '$' : 'NT$';

  const totalCost = item.avgCost;
  const totalValue = item.shares * currentPrice;
  const profit = totalValue - totalCost;
  const profitPercent = totalCost > 0 ? (profit / totalCost) * 100 : 0;

  const valueTWD = isUSD ? totalValue * usdToTwd : totalValue;
  const portfolioWeight = totalPortfolioTWD > 0 ? (valueTWD / totalPortfolioTWD) * 100 : 0;
  const changePercent = quote?.changePercent || 0;
  const market = getMarket(item.symbol);
  const displayName = quote?.shortName || item.symbol;
  const avgPricePerShare = item.shares > 0 ? item.avgCost / item.shares : 0;

  if (isEditing) {
    return (
      <div className="p-6 bg-gray-50">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-sm font-bold text-gray-700">編輯標的</h4>
          <button onClick={onDelete} className="p-1.5 text-rose-600 hover:bg-rose-100 rounded transition-colors" title="刪除">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
        <div className="mb-4">
          <label className="block text-xs text-gray-500 mb-1.5">市場</label>
          <MarketSelector value={editMarket} onChange={setEditMarket} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">代號</label>
            <input
              type="text"
              placeholder={SYMBOL_PLACEHOLDER[editMarket]}
              value={editSymbolRaw}
              onChange={e => setEditSymbolRaw(e.target.value)}
              className="w-full border rounded p-2 text-sm"
            />
            {editSymbolRaw && (
              <p className="text-[10px] mt-1 text-indigo-500 font-medium">
                {editSymbolFull}{editNamePreview ? ` · ${editNamePreview}` : ''}
              </p>
            )}
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">平台</label>
            <input type="text" placeholder="如: 永豐, TD Ameritrade" value={editPlatform} onChange={e => setEditPlatform(e.target.value)} className="w-full border rounded p-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">股數</label>
            <input type="number" value={editShares} onChange={e => setEditShares(e.target.value)} className="w-full border rounded p-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">成本</label>
            <input type="number" value={editAvgCost} onChange={e => setEditAvgCost(e.target.value)} className="w-full border rounded p-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">購買日期</label>
            <input type="date" value={editPurchaseDate} onChange={e => setEditPurchaseDate(e.target.value)} className="w-full border rounded p-2 text-sm" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">備註</label>
            <input type="text" placeholder="如: 長期持有, 定期定額" value={editNotes} onChange={e => setEditNotes(e.target.value)} className="w-full border rounded p-2 text-sm" />
          </div>
          {enablePledgeTracking && (
            <div>
              <label className="block text-xs text-gray-500 mb-1">
                擔保品（{editMarket === '台股' ? '張，0 表示無' : '股，0 表示無'}）
              </label>
              <input
                type="number"
                min="0"
                step="1"
                max={sharesToUnit(Number(editShares) || 0, editMarket).value}
                placeholder="0"
                value={editCollateralShares}
                onChange={e => {
                  const max = sharesToUnit(Number(editShares) || 0, editMarket).value;
                  const val = Math.min(Math.floor(Number(e.target.value) || 0), Math.floor(max));
                  setEditCollateralShares(val.toString());
                }}
                className="w-full border rounded p-2 text-sm"
              />
            </div>
          )}
        </div>
        <div className="mt-4 flex gap-2">
          <button onClick={handleSave} className="px-4 py-2 bg-indigo-600 text-white rounded text-sm hover:bg-indigo-700 flex items-center gap-1"><Check className="w-4 h-4" /> 儲存</button>
          <button onClick={() => setIsEditing(false)} className="px-4 py-2 bg-gray-200 text-gray-700 rounded text-sm hover:bg-gray-300 flex items-center gap-1"><X className="w-4 h-4" /> 取消</button>
        </div>
      </div>
    );
  }

  return (
    <div className="border-b border-gray-100 last:border-0">
      <div className="px-6 py-4 flex flex-col xl:flex-row xl:items-center justify-between hover:bg-slate-50 transition-colors group">
        <div className="flex items-start gap-4 mb-4 xl:mb-0">
          <StockAvatar symbol={item.symbol} market={market} displayName={displayName} />
          <div>
            <div className="flex items-center gap-2">
              <h4 className="font-bold text-gray-900 text-lg leading-tight">
                {item.symbol.endsWith('.TW') ? item.symbol.slice(0, -3) : item.symbol}
              </h4>
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${MARKET_BADGE[market]}`}>
                {market}
              </span>
              {enablePledgeTracking && !!item.collateralShares && (
                <span className="flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded font-semibold bg-amber-100 text-amber-700">
                  <ShieldCheck className="w-2.5 h-2.5" />
                  擔保品 {sharesToUnit(item.collateralShares, market).value.toLocaleString()} {sharesToUnit(item.collateralShares, market).unit}
                </span>
              )}
            </div>
            {displayName && (
              <p className="text-xs text-gray-400 mt-0.5">{displayName}</p>
            )}
            <div className="flex items-center gap-2 mt-1">
              {item.platform && (
                <>
                  <span className="text-xs text-gray-500">{item.platform}</span>
                  <span className="text-xs text-gray-300">|</span>
                </>
              )}
              <span className="text-xs text-gray-500">股數: {item.shares.toLocaleString()}</span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-6 md:gap-10 items-start">
          <div className="w-32">
            <p className="text-xs text-gray-400 mb-1">現價</p>
            {quote ? (
              <>
                <p className="text-base font-semibold text-gray-900 tabular-nums">{currencySymbol}{currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                <p className={`text-sm font-medium mt-0.5 tabular-nums ${changePercent >= 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                  {changePercent >= 0 ? '+' : ''}{changePercent.toFixed(2)}%
                </p>
              </>
            ) : (
              <>
                <p className="text-base text-gray-400">載入中...</p>
                <p className="text-sm text-transparent mt-0.5">-</p>
              </>
            )}
          </div>

          <div className="w-36">
            <p className="text-xs text-gray-400 mb-1">總市值 (TWD)</p>
            <p className="text-base font-semibold text-gray-900 tabular-nums">{Math.round(valueTWD).toLocaleString()}</p>
            <p className="text-sm text-gray-400 mt-0.5 tabular-nums">{portfolioWeight.toFixed(1)}%</p>
          </div>

          <div className="w-36">
            <p className="text-xs text-gray-400 mb-1">未實現損益</p>
            {quote ? (
              <>
                <p className={`text-base font-bold tabular-nums ${profit >= 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                  {profit >= 0 ? '+' : ''}{Math.round(isUSD ? profit * usdToTwd : profit).toLocaleString()}
                </p>
                <p className={`text-sm font-medium mt-0.5 tabular-nums ${profitPercent >= 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                  {profitPercent >= 0 ? '+' : ''}{profitPercent.toFixed(2)}%
                </p>
              </>
            ) : (
              <>
                <p className="text-base text-gray-400">-</p>
                <p className="text-sm text-transparent mt-0.5">-</p>
              </>
            )}
          </div>

          <div className="flex gap-2 flex-grow xl:flex-grow-0 justify-end">
            <button
              onClick={() => setIsExpanded(v => !v)}
              className="p-2 border border-gray-200 text-gray-500 rounded-lg hover:bg-gray-50 transition-colors"
              title={isExpanded ? '收起詳情' : '展開詳情'}
            >
              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            <button
              onClick={() => setIsEditing(true)}
              className="px-4 py-2 border border-indigo-200 text-indigo-600 rounded-lg text-sm font-medium hover:bg-indigo-50 transition-colors flex items-center gap-1"
            >
              <Pencil className="w-3.5 h-3.5" /> 編輯
            </button>
          </div>
        </div>
      </div>

      {isExpanded && (
        <div className="px-6 pb-5 bg-gray-50/60 border-t border-gray-100">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 pt-4">
            <div>
              <p className="text-xs text-gray-400 mb-1">均價 (每股成本)</p>
              <p className="text-sm font-semibold text-gray-800">
                {currencySymbol}{avgPricePerShare.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">總成本</p>
              <p className="text-sm font-semibold text-gray-800">{currencySymbol}{item.avgCost.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">持股張/股數</p>
              <p className="text-sm font-semibold text-gray-800">{item.shares.toLocaleString()} 股</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">市場 / 平台</p>
              <p className="text-sm font-semibold text-gray-800">
                {market}{item.platform ? ` · ${item.platform}` : ''}
              </p>
            </div>
            {enablePledgeTracking && (
              <div>
                <p className="text-xs text-gray-400 mb-1 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" />擔保品
                </p>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    step="1"
                    max={sharesToUnit(item.shares, market).value}
                    value={sharesToUnit(item.collateralShares ?? 0, market).value}
                    onChange={e => {
                      const maxRaw = item.shares;
                      const raw = Math.min(unitToShares(Math.floor(Number(e.target.value) || 0), market), maxRaw);
                      onUpdate({ collateralShares: raw });
                    }}
                    className="w-20 border rounded px-2 py-1 text-sm font-semibold text-amber-700 bg-amber-50 border-amber-200"
                  />
                  <span className="text-xs text-gray-500">{sharesToUnit(0, market).unit}</span>
                  <span className="text-xs text-gray-400">
                    / {sharesToUnit(item.shares, market).value.toLocaleString()} {sharesToUnit(item.shares, market).unit}
                  </span>
                </div>
                {!!item.collateralShares && item.collateralShares < item.shares && (
                  <p className="text-[10px] text-amber-600 mt-1">
                    非擔保品: {sharesToUnit(item.shares - item.collateralShares, market).value.toLocaleString()} {sharesToUnit(0, market).unit}
                  </p>
                )}
              </div>
            )}
            {quote && (
              <div>
                <p className="text-xs text-gray-400 mb-1">今日漲跌幅</p>
                <p className={`text-sm font-semibold ${changePercent >= 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                  {changePercent >= 0 ? '+' : ''}{changePercent.toFixed(2)}%
                </p>
              </div>
            )}
            {item.purchaseDate && (
              <div>
                <p className="text-xs text-gray-400 mb-1">購買日期</p>
                <p className="text-sm font-semibold text-gray-800">{item.purchaseDate}</p>
              </div>
            )}
            {item.notes && (
              <div className="col-span-2">
                <p className="text-xs text-gray-400 mb-1 flex items-center gap-1"><FileText className="w-3 h-3" />備註</p>
                <p className="text-sm text-gray-700">{item.notes}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
