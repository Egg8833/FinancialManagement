"use client";

import { createContext, useContext, ReactNode, useState, useRef, useEffect } from 'react';
import { useStickyState } from '../hooks/useStickyState';
import type { StockItem, StockQuote, DividendRecord } from './AppContext';

interface StockContextType {
  stockItems: StockItem[];
  setStockItems: (items: StockItem[] | ((prev: StockItem[]) => StockItem[])) => void;
  dividendRecords: DividendRecord[];
  setDividendRecords: (records: DividendRecord[] | ((prev: DividendRecord[]) => DividendRecord[])) => void;
  borrowingLimits: Record<string, number>;
  setBorrowingLimits: (limits: Record<string, number> | ((prev: Record<string, number>) => Record<string, number>)) => void;
  stockQuotes: Record<string, StockQuote>;
  lastUpdated: string;
  quoteError: boolean;
  refreshQuotes: () => Promise<void>;
  clearStockData: () => void;
}

const StockContext = createContext<StockContextType | undefined>(undefined);

export function useStockContext() {
  const context = useContext(StockContext);
  if (!context) throw new Error('useStockContext must be used within a StockProvider');
  return context;
}

const initialStockData: StockItem[] = [
  { id: 'st1', symbol: '2330.TW', shares: 2000, avgCost: 600 },
  { id: 'st2', symbol: 'AAPL', shares: 100, avgCost: 150 },
];

export function StockProvider({ children }: { children: ReactNode }) {
  const [stockItems, setStockItems] = useStickyState<StockItem[]>(initialStockData, 'app-stocks-v1');
  const [dividendRecords, setDividendRecords] = useStickyState<DividendRecord[]>([], 'app-dividends-v1');
  const [borrowingLimits, setBorrowingLimits] = useStickyState<Record<string, number>>({}, 'app-borrowing-limits-v1');
  const [stockQuotes, setStockQuotes] = useState<Record<string, StockQuote>>({});
  const [lastUpdated, setLastUpdated] = useState('');
  const [quoteError, setQuoteError] = useState(false);

  const refreshRef = useRef<() => Promise<void>>(undefined);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refreshQuotes = async () => {
    const symbols = Array.from(new Set(stockItems.map(i => i.symbol)));
    if (!symbols.length) return;
    try {
      const res = await fetch(`/api/quote?symbols=${symbols.join(',')}`);
      if (res.ok) {
        const data = await res.json();
        const { _stale, ...quotes } = data;
        setStockQuotes(quotes);
        setLastUpdated(new Date().toLocaleTimeString());
        setQuoteError(!!_stale);
      } else {
        setQuoteError(true);
      }
    } catch {
      setQuoteError(true);
    }
  };

  refreshRef.current = refreshQuotes;

  useEffect(() => {
    const interval = setInterval(() => refreshRef.current?.(), 60_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => refreshRef.current?.(), 150);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [stockItems]);

  const clearStockData = () => {
    setStockItems([]);
    setDividendRecords([]);
    setBorrowingLimits({});
    setStockQuotes({});
    setLastUpdated('');
    setQuoteError(false);
  };

  return (
    <StockContext.Provider value={{
      stockItems, setStockItems,
      dividendRecords, setDividendRecords,
      borrowingLimits, setBorrowingLimits,
      stockQuotes, lastUpdated, quoteError,
      refreshQuotes, clearStockData,
    }}>
      {children}
    </StockContext.Provider>
  );
}
