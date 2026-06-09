"use client";
import { useState } from 'react';
import { type Market, MARKET_GRADIENT } from '../../lib/stockUtils';

export function StockAvatar({ symbol, market, displayName }: { symbol: string; market: Market; displayName: string }) {
  const [imgError, setImgError] = useState(false);
  const code = symbol.replace(/\.(TW|TWO)$/, '');
  const logoUrl = `https://assets.parqet.com/logos/symbol/${code}?variant=light`;

  const fallbackChar = displayName
    ? Array.from(displayName)[0]
    : code.slice(0, 2);

  if (!imgError) {
    return (
      <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 bg-gray-100 border border-gray-100">
        <img
          src={logoUrl}
          alt={code}
          className="w-full h-full object-contain p-1"
          onError={() => setImgError(true)}
        />
      </div>
    );
  }

  return (
    <div className={`w-12 h-12 rounded-xl flex-shrink-0 bg-gradient-to-br ${MARKET_GRADIENT[market]} flex items-center justify-center`}>
      <span className="text-white font-bold text-sm leading-none">{fallbackChar}</span>
    </div>
  );
}
