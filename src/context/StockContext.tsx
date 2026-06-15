"use client";

import { createContext, useContext, ReactNode, useState, useRef, useEffect } from 'react';
import { useStickyState } from '../hooks/useStickyState';
import type { StockItem, StockQuote, DividendRecord, SoldStockItem } from '../types';

interface StockContextType {
  stockItems: StockItem[];
  setStockItems: (items: StockItem[] | ((prev: StockItem[]) => StockItem[])) => void;
  soldStocks: SoldStockItem[];
  setSoldStocks: (items: SoldStockItem[] | ((prev: SoldStockItem[]) => SoldStockItem[])) => void;
  dividendRecords: DividendRecord[];
  setDividendRecords: (records: DividendRecord[] | ((prev: DividendRecord[]) => DividendRecord[])) => void;
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
  const [soldStocks, setSoldStocks] = useStickyState<SoldStockItem[]>([], 'app-sold-stocks-v1');
  const [dividendRecords, setDividendRecords] = useStickyState<DividendRecord[]>([], 'app-dividends-v1');
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
    if (stockItems.length === 0) return;

    let intervalId: ReturnType<typeof setInterval> | null = null;

    const startPolling = () => {
      if (intervalId) return;
      intervalId = setInterval(() => refreshRef.current?.(), 60_000);
    };

    const stopPolling = () => {
      if (intervalId) { clearInterval(intervalId); intervalId = null; }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refreshRef.current?.();
        startPolling();
      } else {
        stopPolling();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    if (document.visibilityState === 'visible') startPolling();

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      stopPolling();
    };
  }, [stockItems.length]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => refreshRef.current?.(), 150);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [stockItems]);

  const clearStockData = () => {
    setStockItems([]);
    setSoldStocks([]);
    setDividendRecords([]);
    setStockQuotes({});
    setLastUpdated('');
    setQuoteError(false);
  };

  return (
    <StockContext.Provider value={{
      stockItems, setStockItems,
      soldStocks, setSoldStocks,
      dividendRecords, setDividendRecords,
      stockQuotes, lastUpdated, quoteError,
      refreshQuotes, clearStockData,
    }}>
      {children}
    </StockContext.Provider>
  );
}
