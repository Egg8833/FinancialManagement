"use client";

import { LayoutDashboard, Eye, EyeOff, BarChart3, Coins, Activity, Wallet } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface NavbarProps {
  showValues: boolean;
  onToggleValues: () => void;
}

export function Navbar({ showValues, onToggleValues }: NavbarProps) {
  const pathname = usePathname();

  const getNavClass = (path: string) => {
    const isActive = pathname === path;
    return `flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
      isActive
        ? 'bg-indigo-50 text-indigo-700'
        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
    }`;
  };

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          
          <div className="flex items-center gap-8">
            {/* Logo */}
            <div className="flex items-center gap-3 mr-4">
              <div className="bg-indigo-600 p-2 rounded-lg text-white">
                <LayoutDashboard className="w-5 h-5" />
              </div>
              <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-violet-600">
                AssetDash
              </span>
            </div>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center gap-2">
              <Link href="/" className={getNavClass('/')}>
                <LayoutDashboard className="w-4 h-4" />
                總覽
              </Link>
              <Link href="/chart" className={getNavClass('/chart')}>
                <BarChart3 className="w-4 h-4" />
                資產狀態圖
              </Link>
              <Link href="/staking" className={getNavClass('/staking')}>
                <Coins className="w-4 h-4" />
                借貸管理
              </Link>
              <Link href="/stocks" className={getNavClass('/stocks')}>
                <Activity className="w-4 h-4" />
                投資追蹤
              </Link>
              <Link href="/cashflow" className={getNavClass('/cashflow')}>
                <Wallet className="w-4 h-4" />
                收支管理
              </Link>
            </div>
          </div>
          
          <div className="flex items-center gap-6">
            <button 
              onClick={onToggleValues}
              className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 rounded-full text-sm font-medium hover:bg-gray-200 transition-colors text-gray-600"
            >
              {showValues ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              {showValues ? '隱藏金額' : '顯示金額'}
            </button>
            <div className="flex items-center gap-3 pl-4 border-l border-gray-200 hidden md:flex">
              <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-sm">
                U
              </div>
              <span className="text-sm font-medium">我的資產庫</span>
            </div>
          </div>

        </div>
      </div>
    </nav>
  );
}
