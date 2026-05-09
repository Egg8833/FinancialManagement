import type { Metadata } from 'next';
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
      <body>
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  );
}
