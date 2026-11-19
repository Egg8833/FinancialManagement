/** 本地日期字串 YYYY-MM-DD。勿用 toISOString(那是 UTC,台灣 00:00–08:00 會變成前一天)。 */
export function localDateStr(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * 對 YYYY-MM-DD 字串加減月份,月底自動夾到該月最後一天(1/31 + 1 個月 = 2/28),
 * 純字串/整數運算,不受執行環境時區影響。
 */
export function addMonthsToDateStr(dateStr: string, months: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const total = y * 12 + (m - 1) + months;
  const ny = Math.floor(total / 12);
  const nm = total - ny * 12; // 0-11
  const lastDay = new Date(Date.UTC(ny, nm + 1, 0)).getUTCDate();
  const nd = Math.min(d, lastDay);
  return `${ny}-${String(nm + 1).padStart(2, '0')}-${String(nd).padStart(2, '0')}`;
}
