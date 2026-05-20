'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Wallet, Flame, TrendingUp, Heart } from 'lucide-react'

const tabs = [
  { href: '/', icon: LayoutDashboard, label: '總覽' },
  { href: '/cashflow', icon: Wallet, label: '現金流' },
  { href: '/fire', icon: Flame, label: 'FIRE' },
  { href: '/stocks', icon: TrendingUp, label: '股票' },
  { href: '/health', icon: Heart, label: '健康' },
]

export default function BottomTabBar() {
  const pathname = usePathname()
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 flex md:hidden safe-area-inset-bottom">
      {tabs.map(({ href, icon: Icon, label }) => {
        const isActive = pathname === href || (href !== '/' && pathname.startsWith(href))
        return (
          <Link
            key={href}
            href={href}
            className={`flex-1 flex flex-col items-center justify-center py-2 gap-0.5 transition-colors ${
              isActive ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            <Icon className="w-5 h-5" strokeWidth={isActive ? 2.5 : 2} />
            <span className="text-xs">{label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
