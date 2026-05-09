export function formatCurrency(amount: number, showValues: boolean): string {
  if (!showValues) return '****';
  return amount.toLocaleString('en-US');
}

export function nowTs(): string {
  return new Date().toLocaleString('zh-TW', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
