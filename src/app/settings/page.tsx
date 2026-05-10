"use client";

import { useState, useEffect } from 'react';
import { User, Mail, Save, CheckCircle } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { useToast } from '../../context/ToastContext';

export default function SettingsPage() {
  const { userName, setUserName, userEmail, setUserEmail } = useAppContext();
  const { toast } = useToast();

  const [localName, setLocalName] = useState(userName);
  const [localEmail, setLocalEmail] = useState(userEmail);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!saved) return;
    const timer = setTimeout(() => setSaved(false), 2500);
    return () => clearTimeout(timer);
  }, [saved]);

  const handleSave = () => {
    setUserName(localName.trim());
    setUserEmail(localEmail.trim());
    setSaved(true);
    toast('個人資訊已儲存');
  };

  const hasChanges = localName !== userName || localEmail !== userEmail;

  return (
    <>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">個人資訊設定</h1>
        <p className="text-sm text-gray-500 mt-1">管理您的個人資料，資料僅儲存在本地設備中</p>
      </div>

      <div className="max-w-2xl space-y-8">

        {/* Profile Card */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {/* Card Header */}
          <div className="bg-gradient-to-r from-indigo-600 to-violet-600 px-6 py-5">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-white text-xl font-bold border-2 border-white/30">
                {localName ? localName.charAt(0).toUpperCase() : 'U'}
              </div>
              <div className="text-white">
                <h2 className="font-bold text-lg">{localName || '使用者'}</h2>
                <p className="text-sm text-white/70">{localEmail || '尚未設定信箱'}</p>
              </div>
            </div>
          </div>

          {/* Form Body */}
          <div className="p-6 space-y-5">
            {/* Name Field */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                <User className="w-4 h-4 text-gray-400" />
                使用者名稱
              </label>
              <input
                type="text"
                value={localName}
                onChange={e => setLocalName(e.target.value)}
                placeholder="請輸入您的名稱"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all bg-gray-50 focus:bg-white"
              />
              <p className="text-xs text-gray-400 mt-1.5">此名稱將顯示在導覽列與報表中</p>
            </div>

            {/* Email Field */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                <Mail className="w-4 h-4 text-gray-400" />
                個人信箱
              </label>
              <input
                type="email"
                value={localEmail}
                onChange={e => setLocalEmail(e.target.value)}
                placeholder="your@email.com"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all bg-gray-50 focus:bg-white"
              />
              <p className="text-xs text-gray-400 mt-1.5">寄送資產報表時將自動使用此信箱作為收件人</p>
            </div>

            {/* Save Button */}
            <div className="flex items-center justify-between pt-2">
              <div>
                {saved && (
                  <span className="flex items-center gap-1.5 text-sm text-emerald-600 animate-fade-in">
                    <CheckCircle className="w-4 h-4" />
                    已儲存
                  </span>
                )}
              </div>
              <button
                onClick={handleSave}
                disabled={!hasChanges}
                className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-sm shadow-indigo-200"
              >
                <Save className="w-4 h-4" />
                儲存設定
              </button>
            </div>
          </div>
        </div>

        {/* Info Card */}
        <div className="bg-indigo-50 rounded-2xl p-5 border border-indigo-100">
          <h3 className="text-sm font-bold text-indigo-800 mb-2">🔒 隱私說明</h3>
          <ul className="text-sm text-indigo-700 space-y-1.5">
            <li>• 所有個人資料僅儲存於您的瀏覽器（localStorage）中</li>
            <li>• 資料不會上傳至任何雲端伺服器</li>
            <li>• 清除瀏覽器資料將同時移除這些設定</li>
            <li>• 寄送報表時，郵件透過您設定的 SMTP 直接發送</li>
          </ul>
        </div>

      </div>
    </>
  );
}
