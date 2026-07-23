import { describe, it, expect } from 'vitest';
import { generateSchedule, calcEndDate, isPaymentDue } from './loanUtils';
import type { LoanItem } from '../types';

function makeLoan(overrides: Partial<LoanItem>): LoanItem {
  return {
    id: 'l1', name: '測試貸款', bank: '測試銀行',
    principal: 12000, initialPrincipal: 12000,
    interestRate: 0, monthlyPayment: 1000, paymentDay: 1,
    remainingPeriods: 12, loanType: 'installment', originalPeriods: 12,
    ...overrides,
  };
}

describe('generateSchedule', () => {
  it('零利率、全新貸款：本金平均攤還，最後一期餘額歸零', () => {
    const rows = generateSchedule(makeLoan({}));
    expect(rows).toHaveLength(12);
    expect(rows[0]).toMatchObject({ period: 1, principal: 1000, interest: 0, beginningBalance: 12000, endingBalance: 11000, isPaid: false });
    const last = rows[rows.length - 1];
    expect(last.endingBalance).toBe(0);
    expect(last.principal).toBe(1000); // 最後一期強制把本金全部繳清
  });

  it('已付期數的重建餘額於銜接點被實際 principal 覆寫（避免重建誤差累積）', () => {
    // originalPeriods=4, remainingPeriods=2 → paidCount=2；刻意讓實際 principal(21000)
    // 與「純重建」算出的餘額(20000)不同，驗證 i===paidCount-1 時會被覆寫成實際值
    const loan = makeLoan({
      principal: 21000, initialPrincipal: 40000,
      monthlyPayment: 10000, originalPeriods: 4, remainingPeriods: 2,
    });
    const rows = generateSchedule(loan);
    expect(rows).toHaveLength(4);
    // 銜接點（第 2 期，i===paidCount-1）的 endingBalance 應等於覆寫後的實際 principal
    expect(rows[1].endingBalance).toBe(21000);
    expect(rows[1].isPaid).toBe(true);
    // 未繳期數的起始餘額從覆寫後的值接續計算
    expect(rows[2].beginningBalance).toBe(21000);
    expect(rows[2].isPaid).toBe(false);
    // 最後一期仍正確歸零
    expect(rows[3].endingBalance).toBe(0);
  });

  it('已全數繳清（remainingPeriods=0）：所有期數皆標記為已繳', () => {
    const loan = makeLoan({ remainingPeriods: 0, originalPeriods: 3, monthlyPayment: 4000, principal: 0, initialPrincipal: 12000 });
    const rows = generateSchedule(loan);
    expect(rows.every(r => r.isPaid)).toBe(true);
  });

  it('有利息時，月付款含本金與利息兩部分，總和等於 monthlyPayment', () => {
    const loan = makeLoan({ interestRate: 12, monthlyPayment: 1054, originalPeriods: 12, remainingPeriods: 12, principal: 12000, initialPrincipal: 12000 });
    const rows = generateSchedule(loan);
    // 非最後一期：本金+利息應等於月付款（最後一期本金會被強制設為剩餘餘額，不受此限）
    for (const row of rows.slice(0, -1)) {
      expect(row.principal + row.interest).toBe(row.payment);
    }
  });
});

describe('calcEndDate', () => {
  it('remainingPeriods <= 0 時回傳「已到期」', () => {
    expect(calcEndDate('2026-01-01', 0)).toBe('已到期');
    expect(calcEndDate(undefined, -1)).toBe('已到期');
  });

  it('依 remainingPeriods 從 nextPaymentDate 往後推算到期日', () => {
    // remainingPeriods=1 代表下一期就是最後一期，到期日即 nextPaymentDate 本身
    expect(calcEndDate('2026-06-15', 1)).toBe('2026/6/15');
    expect(calcEndDate('2026-06-15', 3)).toBe('2026/8/15');
  });
});

describe('isPaymentDue', () => {
  it('未設定 nextPaymentDate 時回傳 false', () => {
    expect(isPaymentDue(undefined)).toBe(false);
  });

  it('到期日已過或為今天時回傳 true', () => {
    expect(isPaymentDue('2000-01-01')).toBe(true);
  });

  it('到期日在未來時回傳 false', () => {
    expect(isPaymentDue('2999-01-01')).toBe(false);
  });
});
