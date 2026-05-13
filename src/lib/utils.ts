export function formatCurrency(amount: number, showValues: boolean, currency: string = 'TWD'): string {
  if (!showValues) return '****';
  
  const formatted = Math.round(amount).toLocaleString('en-US');
  
  if (currency === 'USD') return `$${formatted}`;
  if (currency === 'TWD') return `NT$ ${formatted}`;
  return formatted;
}

export function nowTs(): string {
  return new Date().toLocaleString('zh-TW', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
