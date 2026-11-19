import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="max-w-md mx-auto mt-16 bg-white border border-gray-100 rounded-2xl p-8 shadow-sm text-center">
      <h1 className="text-lg font-bold text-gray-900">找不到這個頁面</h1>
      <p className="text-sm text-gray-500 mt-2">網址可能有誤，或頁面已移除。</p>
      <Link
        href="/"
        className="inline-block mt-6 px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg"
      >
        回到總覽
      </Link>
    </div>
  );
}
