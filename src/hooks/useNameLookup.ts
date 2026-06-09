"use client";
import { useState, useEffect } from 'react';

const nameCache = new Map<string, string>();

export function useNameLookup(symbol: string): string {
  const [name, setName] = useState(() => nameCache.get(symbol) ?? '');
  useEffect(() => {
    if (!symbol) { setName(''); return; }
    if (nameCache.has(symbol)) { setName(nameCache.get(symbol)!); return; }
    const isTW = symbol.endsWith('.TW') || symbol.endsWith('.TWO');
    const t = setTimeout(async () => {
      try {
        if (isTW) {
          const code = symbol.replace(/\.(TW|TWO)$/, '');
          const res = await fetch(`/api/twse-name?code=${code}`);
          if (res.ok) {
            const data = await res.json();
            const n = data.name || '';
            nameCache.set(symbol, n);
            setName(n);
            return;
          }
        }
        const res = await fetch(`/api/quote?symbols=${symbol}`);
        if (res.ok) {
          const data = await res.json();
          const n = data[symbol]?.shortName || '';
          nameCache.set(symbol, n);
          setName(n);
        }
      } catch { setName(''); }
    }, 500);
    return () => clearTimeout(t);
  }, [symbol]);
  return name;
}
