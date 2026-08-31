import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockQuote = vi.fn();

vi.mock('yahoo-finance2', () => ({
  default: class YahooFinance {
    get quote() {
      return mockQuote;
    }
  },
}));

vi.mock('./twse-names', () => ({
  getStockNameMap: vi.fn().mockResolvedValue(new Map([['2330', '台積電']])),
}));

import { getQuotes } from './quoteService';

beforeEach(() => {
  mockQuote.mockReset();
  vi.useRealTimers();
});

describe('getQuotes', () => {
  it('回傳 yahoo-finance2 的報價,台股代號用中文簡稱覆蓋 shortName', async () => {
    mockQuote.mockResolvedValue({
      '2330.TW': { regularMarketPrice: 600, regularMarketChangePercent: 1.2, currency: 'TWD', shortName: 'TSMC' },
    });
    const { data, stale } = await getQuotes(['2330.TW']);
    expect(stale).toBe(false);
    expect(data['2330.TW']).toEqual({ price: 600, changePercent: 1.2, currency: 'TWD', shortName: '台積電' });
  });

  it('60 秒內重複查同一組 symbols 會用快取,不再呼叫 yahoo-finance2', async () => {
    mockQuote.mockResolvedValue({
      AAPL: { regularMarketPrice: 200, regularMarketChangePercent: 0.5, currency: 'USD', shortName: 'Apple' },
    });
    await getQuotes(['AAPL']);
    await getQuotes(['AAPL']);
    expect(mockQuote).toHaveBeenCalledTimes(1);
  });

  it('查詢失敗但有舊快取時,回傳舊資料並標記 stale', async () => {
    vi.useFakeTimers();
    mockQuote.mockResolvedValueOnce({
      MSFT: { regularMarketPrice: 300, regularMarketChangePercent: 0, currency: 'USD' },
    });
    await getQuotes(['MSFT']);
    vi.advanceTimersByTime(61_000);
    mockQuote.mockRejectedValueOnce(new Error('network down'));
    const { data, stale } = await getQuotes(['MSFT']);
    expect(stale).toBe(true);
    expect(data.MSFT.price).toBe(300);
    vi.useRealTimers();
  });

  it('查詢失敗且無快取時,把錯誤往外丟', async () => {
    mockQuote.mockRejectedValue(new Error('boom'));
    await expect(getQuotes(['NFLX'])).rejects.toThrow('boom');
  });
});
