import type { Metadata } from 'next';
import Script from 'next/script';
import '../index.css';
import { ClientLayout } from '../components/ClientLayout';

export const metadata: Metadata = {
  title: 'AssetDash - 個人資產狀態',
  description: '追蹤與管理您的財務狀況',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-TW">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#4f46e5" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="AssetDash" />
      </head>
      <body>
        <ClientLayout>{children}</ClientLayout>
        {/* Service Worker 只在正式環境註冊:開發模式的 chunk 檔名不含 hash,
            被 SW 快取後會一直拿到舊程式碼;開發時順手移除先前註冊的 SW 與快取。 */}
        <Script id="sw-register" strategy="afterInteractive">{process.env.NODE_ENV === 'production' ? `
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function() {
      navigator.serviceWorker.register('/sw.js');
    });
  }
` : `
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(function(regs) {
      regs.forEach(function(r) { r.unregister(); });
    });
    if (window.caches) caches.keys().then(function(keys) { keys.forEach(function(k) { caches.delete(k); }); });
  }
`}</Script>
      </body>
    </html>
  );
}
