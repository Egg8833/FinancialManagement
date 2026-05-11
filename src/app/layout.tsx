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
        <Script id="sw-register" strategy="afterInteractive">{`
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function() {
      navigator.serviceWorker.register('/sw.js');
    });
  }
`}</Script>
      </body>
    </html>
  );
}
