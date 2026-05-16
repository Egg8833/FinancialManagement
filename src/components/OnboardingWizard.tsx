"use client";

import { useState } from 'react';
import { LayoutDashboard, Wallet, BarChart3, Check, ChevronRight, X } from 'lucide-react';
import { useAppContext } from '../context/AppContext';

const STEPS = [
  {
    Icon: LayoutDashboard,
    title: '歡迎使用 AssetDash！',
    desc: '這是您的個人財務儀表板，所有資料都安全地存在您的設備上，不會上傳到任何伺服器。',
    action: '開始設定',
  },
  {
    Icon: Wallet,
    title: '第一步：登錄您的資產',
    desc: '前往「總覽」頁面，在資產分佈區域新增您的現金、投資、房產等資產項目。點擊各類別卡片的「新增項目」即可開始。',
    action: '了解了',
  },
  {
    Icon: BarChart3,
    title: '第二步：記錄每月收支',
    desc: '在「收支管理」頁面登錄固定的月收入與支出，系統會自動計算您的儲蓄率與現金流狀況。',
    action: '完成設定',
  },
];

export function OnboardingWizard() {
  const { onboardingDone, setOnboardingDone, assets } = useAppContext();
  const [step, setStep] = useState(0);

  const isDemoData = assets.some(cat => cat.items.some(item => item.id === 'l1'));
  if (onboardingDone || isDemoData) return null;

  const current = STEPS[step];
  const { Icon } = current;
  const isLast = step === STEPS.length - 1;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8 relative">
        <button
          onClick={() => setOnboardingDone(true)}
          className="absolute top-4 right-4 p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
          aria-label="跳過引導"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-1.5 mb-6">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full flex-1 transition-colors ${i <= step ? 'bg-indigo-600' : 'bg-gray-200'}`}
            />
          ))}
        </div>

        <div className="bg-indigo-50 w-14 h-14 rounded-2xl flex items-center justify-center mb-5">
          <Icon className="w-7 h-7 text-indigo-600" />
        </div>

        <h2 className="text-xl font-bold text-gray-900 mb-3">{current.title}</h2>
        <p className="text-sm text-gray-600 leading-relaxed mb-8">{current.desc}</p>

        <div className="flex justify-between items-center">
          <span className="text-xs text-gray-400">{step + 1} / {STEPS.length}</span>
          <button
            onClick={() => {
              if (isLast) setOnboardingDone(true);
              else setStep(s => s + 1);
            }}
            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors"
          >
            {isLast
              ? <><Check className="w-4 h-4" /> {current.action}</>
              : <>{current.action} <ChevronRight className="w-4 h-4" /></>
            }
          </button>
        </div>
      </div>
    </div>
  );
}
