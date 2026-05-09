"use client";

import { useState, useEffect, useRef } from 'react';
import { LayoutDashboard, Eye, EyeOff, BarChart3, Coins, Activity, Wallet, Menu, X, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAppContext } from '../context/AppContext';
import { ConfirmDialog } from './ConfirmDialog';

interface NavbarProps {
  showValues: boolean;
  onToggleValues: () => void;
}

const NAV_LINKS = [
  { href: '/', label: '總覽', Icon: LayoutDashboard },
  { href: '/cashflow', label: '收支管理', Icon: Wallet },
  { href: '/staking', label: '借貸 & 活儲', Icon: Coins },
  { href: '/stocks', label: '投資追蹤', Icon: Activity },
  { href: '/chart', label: '資產狀態圖', Icon: BarChart3 },
];

export function Navbar({ showValues, onToggleValues }: NavbarProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [assetMenuOpen, setAssetMenuOpen] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const assetMenuRef = useRef<HTMLDivElement>(null);
  const { clearAllData } = useAppContext();

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (assetMenuRef.current && !assetMenuRef.current.contains(e.target as Node)) {
        setAssetMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 路由切換時自動關閉選單
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // 鎖定 body scroll
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  const getNavClass = (path: string) => {
    const isActive = pathname === path;
    return `flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${isActive
        ? 'bg-indigo-50 text-indigo-700'
        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
      }`;
  };

  const getMobileNavClass = (path: string) => {
    const isActive = pathname === path;
    return `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${isActive
        ? 'bg-indigo-50 text-indigo-700'
        : 'text-gray-700 hover:bg-gray-100'
      }`;
  };

  return (
    <>
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

              {/* 桌機導覽 */}
              <div className="hidden md:flex items-center gap-2">
                {NAV_LINKS.map(({ href, label, Icon }) => (
                  <Link key={href} href={href} className={getNavClass(href)}>
                    <Icon className="w-4 h-4" />
                    {label}
                  </Link>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-4">
              <button
                onClick={onToggleValues}
                className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 rounded-full text-sm font-medium hover:bg-gray-200 transition-colors text-gray-600"
              >
                {showValues ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                <span className="hidden sm:inline">{showValues ? '隱藏金額' : '顯示金額'}</span>
              </button>

              <div className="hidden md:block relative pl-4 border-l border-gray-200" ref={assetMenuRef}>
                <button
                  onClick={() => setAssetMenuOpen(o => !o)}
                  className="flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-gray-100 transition-colors"
                >
                  <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-sm">
                    U
                  </div>
                  <span className="text-sm font-medium">我的資產庫</span>
                </button>
                {assetMenuOpen && (
                  <div className="absolute right-0 mt-1 w-40 bg-white border border-gray-200 rounded-xl shadow-lg py-1 z-50">
                    <button
                      onClick={() => { setAssetMenuOpen(false); setShowClearConfirm(true); }}
                      className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-rose-600 hover:bg-rose-50 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                      一鍵清除資料
                    </button>
                  </div>
                )}
              </div>

              {/* 漢堡按鈕 — 僅手機顯示 */}
              <button
                onClick={() => setMobileOpen(o => !o)}
                className="md:hidden p-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
                aria-label="開啟導覽選單"
              >
                {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>

          </div>
        </div>
      </nav>

      {/* 手機側欄遮罩 */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* 手機側欄 */}
      <div
        className={`fixed top-0 right-0 h-full w-72 bg-white z-50 shadow-2xl transform transition-transform duration-300 ease-in-out md:hidden flex flex-col ${mobileOpen ? 'translate-x-0' : 'translate-x-full'
          }`}
      >
        {/* 側欄 header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="bg-indigo-600 p-1.5 rounded-lg text-white">
              <LayoutDashboard className="w-4 h-4" />
            </div>
            <span className="font-bold text-gray-900">AssetDash</span>
          </div>
          <button
            onClick={() => setMobileOpen(false)}
            className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100"
            aria-label="關閉選單"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 導覽連結 */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {NAV_LINKS.map(({ href, label, Icon }) => (
            <Link key={href} href={href} className={getMobileNavClass(href)}>
              <Icon className="w-5 h-5 flex-shrink-0" />
              {label}
            </Link>
          ))}
        </nav>

        {/* 底部 */}
        <div className="px-5 py-4 border-t border-gray-100 space-y-1">
          <button
            onClick={() => { onToggleValues(); setMobileOpen(false); }}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
          >
            {showValues ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            {showValues ? '隱藏所有金額' : '顯示所有金額'}
          </button>
          <button
            onClick={() => { setMobileOpen(false); setShowClearConfirm(true); }}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-rose-600 hover:bg-rose-50 transition-colors"
          >
            <Trash2 className="w-5 h-5" />
            一鍵清除資料
          </button>
        </div>
      </div>

      {showClearConfirm && (
        <ConfirmDialog
          message="確定要清除所有資料嗎？此操作無法還原。"
          onConfirm={() => { clearAllData(); setShowClearConfirm(false); }}
          onCancel={() => setShowClearConfirm(false)}
        />
      )}
    </>
  );
}
