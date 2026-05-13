'use client';

import { useState } from 'react';
import { Plus, Trash2, Check, X, Pencil, Target, Home, Car, Plane, Shield, BookOpen, TrendingUp, type LucideProps } from 'lucide-react';
import { useAppContext, type FinancialGoal } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import type { AssetCategory } from '../types';
import { resolveCurrentAmount, getLinkedItemIds } from '../lib/goalUtils';

const GOAL_ICONS: Record<FinancialGoal['icon'], React.FC<LucideProps>> = {
  home: Home,
  car: Car,
  travel: Plane,
  emergency: Shield,
  retirement: TrendingUp,
  education: BookOpen,
  other: Target,
};

const GOAL_ICON_LABELS: Record<FinancialGoal['icon'], string> = {
  home: '🏠 購屋',
  car: '🚗 購車',
  travel: '✈️ 旅遊',
  emergency: '🛡️ 緊急備用',
  retirement: '📈 退休',
  education: '📚 教育',
  other: '🎯 其他',
};

const COLOR_OPTIONS = [
  { label: '靛藍', value: '#6366f1' },
  { label: '翡翠', value: '#10b981' },
  { label: '天藍', value: '#3b82f6' },
  { label: '玫瑰', value: '#f43f5e' },
  { label: '橙黃', value: '#f59e0b' },
  { label: '紫色', value: '#8b5cf6' },
];

function daysUntil(deadline: string): number {
  return Math.ceil((new Date(deadline).getTime() - Date.now()) / 86_400_000);
}

function GoalCard({
  goal,
  showValues,
  assets,
  goals,
  onUpdate,
  onDelete,
}: {
  goal: FinancialGoal;
  showValues: boolean;
  assets: AssetCategory[];
  goals: FinancialGoal[];
  onUpdate: (g: FinancialGoal) => void;
  onDelete: () => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(goal.name);
  const [target, setTarget] = useState(String(goal.targetAmount));
  const [current, setCurrent] = useState(String(goal.currentAmount));
  const [deadline, setDeadline] = useState(goal.deadline ?? '');
  const [color, setColor] = useState(goal.color);
  const [icon, setIcon] = useState<FinancialGoal['icon']>(goal.icon);
  const [linkedIds, setLinkedIds] = useState<string[]>(goal.linkedAssetItemIds ?? []);

  const effectiveCurrent = resolveCurrentAmount(goal, assets);
  const progress = goal.targetAmount > 0 ? Math.min(100, (effectiveCurrent / goal.targetAmount) * 100) : 0;
  const remaining = goal.targetAmount - effectiveCurrent;
  const days = goal.deadline ? daysUntil(goal.deadline) : null;
  const monthsLeft = days !== null ? Math.ceil(days / 30) : null;
  const monthlyNeeded = monthsLeft && monthsLeft > 0 && remaining > 0 ? Math.ceil(remaining / monthsLeft) : null;

  const progressColor =
    progress >= 100 ? '#10b981' :
    progress >= 60  ? '#6366f1' :
    progress >= 30  ? '#f59e0b' : '#f43f5e';

  const IconComp = GOAL_ICONS[goal.icon];
  const takenIds = getLinkedItemIds(goals, goal.id);

  const handleSave = () => {
    onUpdate({
      ...goal,
      name,
      targetAmount: Number(target) || 0,
      currentAmount: linkedIds.length ? goal.currentAmount : Number(current) || 0,
      deadline: deadline || undefined,
      color,
      icon,
      linkedAssetItemIds: linkedIds.length ? linkedIds : undefined,
    });
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div className="bg-white border border-gray-200 rounded-2xl p-4 space-y-3 shadow-sm">
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="目標名稱"
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400"
        />
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-gray-400 mb-1 block">目標金額</label>
            <input type="number" value={target} onChange={e => setTarget(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400" />
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">目前已存</label>
            {linkedIds.length > 0 ? (
              <p className="px-3 py-2 text-sm bg-gray-50 rounded-lg text-indigo-600 font-bold">
                {showValues
                  ? `$${resolveCurrentAmount({ ...goal, linkedAssetItemIds: linkedIds }, assets).toLocaleString()}（連結自動計算）`
                  : '****'}
              </p>
            ) : (
              <input type="number" value={current} onChange={e => setCurrent(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400" />
            )}
          </div>
        </div>
        <div>
          <label className="text-xs text-gray-400 mb-1 block">目標日期（選填）</label>
          <input type="date" value={deadline} onChange={e => setDeadline(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400" />
        </div>
        <div>
          <label className="text-xs text-gray-400 mb-1 block">連結資產（選填）</label>
          <div className="border border-gray-200 rounded-lg overflow-hidden max-h-48 overflow-y-auto">
            {assets.map(cat => (
              <div key={cat.id}>
                <p className="text-xs font-bold text-gray-500 px-3 py-1.5 bg-gray-50 border-b border-gray-100">{cat.title}</p>
                {cat.items.map(item => {
                  const isTaken = takenIds.has(item.id);
                  const takenByGoal = isTaken
                    ? goals.find(g => g.id !== goal.id && g.linkedAssetItemIds?.includes(item.id))?.name
                    : null;
                  return (
                    <label
                      key={item.id}
                      className={`flex items-center gap-2 px-3 py-1.5 text-sm border-b border-gray-50 last:border-0 ${isTaken ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer hover:bg-gray-50'}`}
                    >
                      <input
                        type="checkbox"
                        checked={linkedIds.includes(item.id)}
                        disabled={isTaken}
                        onChange={e => {
                          if (e.target.checked) setLinkedIds(prev => [...prev, item.id]);
                          else setLinkedIds(prev => prev.filter(id => id !== item.id));
                        }}
                        className="rounded"
                      />
                      <span className="flex-1 truncate">{item.name}</span>
                      {takenByGoal ? (
                        <span className="text-xs text-gray-400 shrink-0">已連結：{takenByGoal}</span>
                      ) : (
                        <span className="text-xs text-gray-400 shrink-0">{showValues ? `$${item.amount.toLocaleString()}` : '****'}</span>
                      )}
                    </label>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
        <div>
          <label className="text-xs text-gray-400 mb-2 block">圖示</label>
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(GOAL_ICON_LABELS) as FinancialGoal['icon'][]).map(k => (
              <button
                key={k}
                onClick={() => setIcon(k)}
                className={`px-2 py-1 rounded-lg text-xs border transition-colors ${icon === k ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300'}`}
              >
                {GOAL_ICON_LABELS[k]}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-xs text-gray-400 mb-2 block">顏色</label>
          <div className="flex gap-2">
            {COLOR_OPTIONS.map(c => (
              <button
                key={c.value}
                onClick={() => setColor(c.value)}
                style={{ backgroundColor: c.value }}
                className={`w-6 h-6 rounded-full transition-transform ${color === c.value ? 'scale-125 ring-2 ring-offset-1 ring-gray-400' : ''}`}
              />
            ))}
          </div>
        </div>
        <div className="flex gap-2 justify-end">
          <button onClick={handleSave} className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700">
            <Check className="w-3.5 h-3.5" /> 儲存
          </button>
          <button onClick={() => { setLinkedIds(goal.linkedAssetItemIds ?? []); setIsEditing(false); }} className="flex items-center gap-1 px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-sm hover:bg-gray-200">
            <X className="w-3.5 h-3.5" /> 取消
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm group hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl" style={{ backgroundColor: `${goal.color}18` }}>
            <IconComp className="w-4 h-4" style={{ color: goal.color }} />
          </div>
          <div>
            <p className="font-bold text-sm text-gray-900">{goal.name}</p>
            {days !== null && (
              <p className={`text-xs ${days < 0 ? 'text-rose-500' : days < 90 ? 'text-amber-500' : 'text-gray-400'}`}>
                {days < 0 ? `已逾期 ${Math.abs(days)} 天` : `距截止 ${days} 天`}
              </p>
            )}
          </div>
        </div>
        <div className="opacity-0 group-hover:opacity-100 flex gap-1">
          <button onClick={() => setIsEditing(true)} className="p-1 text-gray-400 hover:text-indigo-600"><Pencil className="w-3.5 h-3.5" /></button>
          <button onClick={onDelete} className="p-1 text-gray-400 hover:text-rose-600"><Trash2 className="w-3.5 h-3.5" /></button>
        </div>
      </div>

      {/* 進度條 */}
      <div className="mb-2">
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>{showValues ? `${effectiveCurrent.toLocaleString()} / ${goal.targetAmount.toLocaleString()}` : '****'}</span>
          <span className="font-bold" style={{ color: progressColor }}>{progress.toFixed(0)}%</span>
        </div>
        <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${progress}%`, backgroundColor: goal.color }}
          />
        </div>
      </div>

      {/* 連結資產 chips */}
      {(goal.linkedAssetItemIds?.length ?? 0) > 0 && (() => {
        const allItems = assets.flatMap(cat => cat.items);
        const linked = (goal.linkedAssetItemIds ?? [])
          .map(id => allItems.find(i => i.id === id))
          .filter((i): i is NonNullable<typeof i> => i != null);
        const shown = linked.slice(0, 3);
        const extra = linked.length - shown.length;
        return (
          <div className="flex flex-wrap gap-1 mt-2 mb-1">
            {shown.map(item => (
              <span key={item.id} className="inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-full text-xs">
                {item.name}{showValues ? ` $${item.amount.toLocaleString()}` : ''}
              </span>
            ))}
            {extra > 0 && <span className="text-xs text-gray-400 self-center">+{extra} 個</span>}
          </div>
        );
      })()}
      {/* 底部資訊 */}
      <div className="flex items-center justify-between mt-3 text-xs text-gray-400">
        {progress >= 100 ? (
          <span className="text-emerald-600 font-bold">🎉 目標達成！</span>
        ) : (
          <span>還差 {showValues ? remaining.toLocaleString() : '****'}</span>
        )}
        {monthlyNeeded && monthlyNeeded > 0 && (
          <span className="text-indigo-500">每月需存 {showValues ? monthlyNeeded.toLocaleString() : '****'}</span>
        )}
      </div>
    </div>
  );
}

export function FinancialGoals() {
  const { goals, setGoals, showValues, assets } = useAppContext();
  const { toast } = useToast();
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newTarget, setNewTarget] = useState('');
  const [newCurrent, setNewCurrent] = useState('');
  const [newDeadline, setNewDeadline] = useState('');
  const [newIcon, setNewIcon] = useState<FinancialGoal['icon']>('other');
  const [newColor, setNewColor] = useState('#6366f1');
  const [newLinkedIds, setNewLinkedIds] = useState<string[]>([]);
  const newGoalTakenIds = getLinkedItemIds(goals);

  const handleAdd = () => {
    if (!newName.trim() || !newTarget) return;
    const goal: FinancialGoal = {
      id: `goal-${Date.now()}`,
      name: newName.trim(),
      targetAmount: Number(newTarget) || 0,
      currentAmount: newLinkedIds.length ? 0 : Number(newCurrent) || 0,
      deadline: newDeadline || undefined,
      color: newColor,
      icon: newIcon,
      linkedAssetItemIds: newLinkedIds.length ? newLinkedIds : undefined,
    };
    setGoals(prev => [...prev, goal]);
    toast('已新增財務目標');
    setNewName(''); setNewTarget(''); setNewCurrent(''); setNewDeadline('');
    setNewIcon('other'); setNewColor('#6366f1'); setNewLinkedIds([]);
    setIsAdding(false);
  };

  const handleUpdate = (id: string, updated: FinancialGoal) => {
    setGoals(prev => prev.map(g => g.id === id ? updated : g));
    toast('已更新目標');
  };

  const handleDelete = (id: string) => {
    setGoals(prev => prev.filter(g => g.id !== id));
    toast('已刪除目標', 'info');
  };

  const totalGoalAmount = goals.reduce((s, g) => s + g.targetAmount, 0);
  const totalCurrentAmount = goals.reduce((s, g) => s + resolveCurrentAmount(g, assets), 0);
  const overallProgress = totalGoalAmount > 0 ? (totalCurrentAmount / totalGoalAmount) * 100 : 0;

  return (
    <div className="mt-8">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-bold text-gray-900">財務目標</h3>
          {goals.length > 0 && (
            <p className="text-xs text-gray-400 mt-0.5">
              整體進度 {overallProgress.toFixed(0)}%・{goals.filter(g => resolveCurrentAmount(g, assets) >= g.targetAmount).length}/{goals.length} 項達成
            </p>
          )}
        </div>
        <button
          onClick={() => setIsAdding(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
        >
          <Plus className="w-4 h-4" /> 新增目標
        </button>
      </div>

      {isAdding && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-4 mb-4 space-y-3">
          <p className="text-sm font-bold text-indigo-700">新增財務目標</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input
              type="text"
              placeholder="目標名稱 *"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              className="border border-indigo-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500 bg-white"
              autoFocus
            />
            <input
              type="number"
              placeholder="目標金額 *"
              value={newTarget}
              onChange={e => setNewTarget(e.target.value)}
              className="border border-indigo-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500 bg-white"
            />
            {newLinkedIds.length > 0 ? (
              <div className="border border-indigo-200 rounded-lg px-3 py-2 text-sm bg-indigo-50 text-indigo-700 font-medium">
                {showValues
                  ? `$${resolveCurrentAmount({ currentAmount: 0, linkedAssetItemIds: newLinkedIds } as FinancialGoal, assets).toLocaleString()}（連結自動計算）`
                  : '****'}
              </div>
            ) : (
              <input
                type="number"
                placeholder="目前已存（選填）"
                value={newCurrent}
                onChange={e => setNewCurrent(e.target.value)}
                className="border border-indigo-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500 bg-white"
              />
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">目標日期（選填）</label>
              <input
                type="date"
                value={newDeadline}
                onChange={e => setNewDeadline(e.target.value)}
                className="w-full border border-indigo-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500 bg-white"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1.5 block">顏色</label>
              <div className="flex gap-2">
                {COLOR_OPTIONS.map(c => (
                  <button
                    key={c.value}
                    onClick={() => setNewColor(c.value)}
                    style={{ backgroundColor: c.value }}
                    className={`w-6 h-6 rounded-full transition-transform ${newColor === c.value ? 'scale-125 ring-2 ring-offset-1 ring-gray-400' : ''}`}
                  />
                ))}
              </div>
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">連結資產（選填）</label>
            <div className="border border-indigo-200 rounded-lg overflow-hidden max-h-40 overflow-y-auto bg-white">
              {assets.map(cat => (
                <div key={cat.id}>
                  <p className="text-xs font-bold text-gray-500 px-3 py-1.5 bg-gray-50 border-b border-gray-100">{cat.title}</p>
                  {cat.items.map(item => {
                    const isTaken = newGoalTakenIds.has(item.id);
                    const takenByGoal = isTaken
                      ? goals.find(g => g.linkedAssetItemIds?.includes(item.id))?.name
                      : null;
                    return (
                      <label
                        key={item.id}
                        className={`flex items-center gap-2 px-3 py-1.5 text-sm border-b border-gray-50 last:border-0 ${isTaken ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer hover:bg-gray-50'}`}
                      >
                        <input
                          type="checkbox"
                          checked={newLinkedIds.includes(item.id)}
                          disabled={isTaken}
                          onChange={e => {
                            if (e.target.checked) setNewLinkedIds(prev => [...prev, item.id]);
                            else setNewLinkedIds(prev => prev.filter(id => id !== item.id));
                          }}
                          className="rounded"
                        />
                        <span className="flex-1 truncate">{item.name}</span>
                        {takenByGoal ? (
                          <span className="text-xs text-gray-400 shrink-0">已連結：{takenByGoal}</span>
                        ) : (
                          <span className="text-xs text-gray-400 shrink-0">{showValues ? `$${item.amount.toLocaleString()}` : '****'}</span>
                        )}
                      </label>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1.5 block">類型</label>
            <div className="flex flex-wrap gap-1.5">
              {(Object.keys(GOAL_ICON_LABELS) as FinancialGoal['icon'][]).map(k => (
                <button
                  key={k}
                  onClick={() => setNewIcon(k)}
                  className={`px-2 py-1 rounded-lg text-xs border transition-colors ${newIcon === k ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300'}`}
                >
                  {GOAL_ICON_LABELS[k]}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={handleAdd} className="flex items-center gap-1 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">
              <Check className="w-4 h-4" /> 新增
            </button>
            <button onClick={() => setIsAdding(false)} className="flex items-center gap-1 px-3 py-2 bg-white text-gray-500 border border-gray-200 rounded-lg text-sm hover:bg-gray-50">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {goals.length === 0 && !isAdding && (
        <div className="bg-white border border-dashed border-gray-200 rounded-2xl p-8 text-center">
          <Target className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-400 mb-1">尚無財務目標</p>
          <p className="text-xs text-gray-300">設定購屋、退休、緊急備用金等目標，追蹤存款進度</p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {goals.map(goal => (
          <GoalCard
            key={goal.id}
            goal={goal}
            showValues={showValues}
            assets={assets}
            goals={goals}
            onUpdate={updated => handleUpdate(goal.id, updated)}
            onDelete={() => handleDelete(goal.id)}
          />
        ))}
      </div>
    </div>
  );
}
