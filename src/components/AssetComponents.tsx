"use client";

import { useState } from 'react';
import { Pencil, Trash2, Check, X, Plus, ChevronDown, ChevronUp, GripVertical } from 'lucide-react';
import {
  DndContext, closestCenter, PointerSensor, TouchSensor, KeyboardSensor,
  useSensor, useSensors, type DragEndEvent, type DraggableAttributes, type DraggableSyntheticListeners,
} from '@dnd-kit/core';
import {
  SortableContext, verticalListSortingStrategy, useSortable,
  arrayMove, sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { AssetItem, AssetCategory } from '../types';
import { ConfirmDialog } from './ConfirmDialog';
import { useToast } from '../context/ToastContext';

interface EditableAssetRowProps {
  item: AssetItem;
  showValues: boolean;
  onUpdate: (name: string, amount: number) => void;
  onDelete: () => void;
  dragHandle?: { attributes: DraggableAttributes; listeners: DraggableSyntheticListeners };
}

export function EditableAssetRow({ item, showValues, onUpdate, onDelete, dragHandle }: EditableAssetRowProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editName, setEditName] = useState(item.name);
  const [editAmount, setEditAmount] = useState(item.amount.toString());
  const { toast } = useToast();

  const handleSave = () => {
    onUpdate(editName, Number(editAmount) || 0);
    setIsEditing(false);
    toast('已更新資產項目');
  };

  const handleDelete = () => {
    onDelete();
    toast(`已刪除「${item.name}」`, 'info');
  };

  if (isEditing) {
    return (
      <div className="flex items-center gap-2 py-2">
        <div className="w-1/2">
          <label className="block text-xs text-gray-500 mb-1">名稱</label>
          <input 
            type="text" 
            value={editName} 
            onChange={e => setEditName(e.target.value)} 
            className="w-full text-sm border border-gray-300 rounded px-2 py-1 outline-none focus:border-indigo-500" 
            placeholder="項目名稱"
          />
        </div>
        <div className="w-1/3">
          <label className="block text-xs text-gray-500 mb-1">金額</label>
          <input 
            type="number" 
            value={editAmount} 
            onChange={e => setEditAmount(e.target.value)} 
            className="w-full text-sm border border-gray-300 rounded px-2 py-1 outline-none focus:border-indigo-500 text-right" 
            placeholder="金額"
          />
        </div>
        <div className="flex gap-1 mt-4">
          <button onClick={handleSave} className="p-1 text-green-600 hover:bg-green-50 rounded"><Check className="w-4 h-4" /></button>
          <button onClick={() => setIsEditing(false)} className="p-1 text-gray-400 hover:bg-gray-100 rounded"><X className="w-4 h-4" /></button>
        </div>
      </div>
    );
  }

  return (
    <div className="group flex justify-between items-center text-sm py-2 px-2 hover:bg-gray-50 rounded-lg -mx-2 transition-colors">
      {dragHandle && (
        <button
          {...dragHandle.attributes}
          {...dragHandle.listeners}
          className="mr-1 p-1 -ml-1 text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing touch-none shrink-0"
          aria-label={`拖曳排序「${item.name}」`}
        >
          <GripVertical className="w-3.5 h-3.5" />
        </button>
      )}
      <div className="flex items-center gap-2 flex-1">
        <span className="text-gray-600">{item.name}</span>
        {item.id.startsWith('auto-') && (
          <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded uppercase tracking-wider animate-pulse">Live</span>
        )}
      </div>
      <span className="font-medium text-gray-900 mx-4">{showValues ? item.amount.toLocaleString('en-US') : '****'}</span>
      <div className={`flex gap-1 transition-opacity ${item.id.startsWith('auto-') ? 'invisible' : 'opacity-60 sm:opacity-0 sm:group-hover:opacity-100'}`}>
        <button onClick={() => setIsEditing(true)} className="p-1 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded"><Pencil className="w-3.5 h-3.5" /></button>
        <button onClick={() => setConfirmDelete(true)} className="p-1 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded"><Trash2 className="w-3.5 h-3.5" /></button>
      </div>
      {confirmDelete && (
        <ConfirmDialog
          message={`確定要刪除「${item.name}」嗎？`}
          onConfirm={handleDelete}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </div>
  );
}

type SortableAssetRowProps = Omit<EditableAssetRowProps, 'dragHandle'>;

function SortableAssetRow({ item, ...rest }: SortableAssetRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
  };
  return (
    <div ref={setNodeRef} style={style} className="relative bg-white">
      <EditableAssetRow item={item} {...rest} dragHandle={{ attributes, listeners }} />
    </div>
  );
}

interface AddAssetRowProps {
  onAdd: (name: string, amount: number) => void;
}

export function AddAssetRow({ onAdd }: AddAssetRowProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');

  const handleAdd = () => {
    if (!name.trim() || !amount) return;
    onAdd(name, Number(amount));
    setName('');
    setAmount('');
    setIsAdding(false);
  };

  if (!isAdding) {
    return (
      <button 
        onClick={() => setIsAdding(true)}
        className="w-full mt-2 py-2 flex items-center justify-center gap-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors border border-dashed border-indigo-200"
      >
        <Plus className="w-3 h-3" /> 新增項目
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2 py-2 mt-2 bg-indigo-50/50 p-2 rounded-lg -mx-2">
      <div className="w-1/2">
        <label className="block text-xs text-gray-500 mb-1">名稱</label>
        <input 
          type="text" 
          value={name} 
          onChange={e => setName(e.target.value)} 
          className="w-full text-sm border border-gray-300 rounded px-2 py-1 outline-none focus:border-indigo-500" 
          placeholder="項目名稱"
          autoFocus
        />
      </div>
      <div className="w-1/3">
        <label className="block text-xs text-gray-500 mb-1">金額</label>
        <input 
          type="number" 
          value={amount} 
          onChange={e => setAmount(e.target.value)} 
          className="w-full text-sm border border-gray-300 rounded px-2 py-1 outline-none focus:border-indigo-500 text-right" 
          placeholder="金額"
        />
      </div>
      <div className="flex gap-1 mt-4">
        <button onClick={handleAdd} className="p-1 text-indigo-600 hover:bg-indigo-100 rounded"><Plus className="w-4 h-4" /></button>
        <button onClick={() => setIsAdding(false)} className="p-1 text-gray-400 hover:bg-gray-100 rounded"><X className="w-4 h-4" /></button>
      </div>
    </div>
  );
}

const CARD_COLOR_OPTIONS = [
  { colorClass: 'bg-emerald-400', bgClass: 'bg-emerald-50' },
  { colorClass: 'bg-violet-400',  bgClass: 'bg-violet-50'  },
  { colorClass: 'bg-orange-400',  bgClass: 'bg-orange-50'  },
  { colorClass: 'bg-teal-400',    bgClass: 'bg-teal-50'    },
  { colorClass: 'bg-pink-400',    bgClass: 'bg-pink-50'    },
  { colorClass: 'bg-yellow-400',  bgClass: 'bg-yellow-50'  },
  { colorClass: 'bg-blue-400',    bgClass: 'bg-blue-50'    },
  { colorClass: 'bg-rose-400',    bgClass: 'bg-rose-50'    },
];

interface AssetCategoryCardProps {
  category: AssetCategory;
  showValues: boolean;
  formatCurrency: (amount: number) => string;
  onUpdateAsset: (categoryId: string, itemId: string, name: string, amount: number) => void;
  onDeleteAsset: (categoryId: string, itemId: string) => void;
  onAddAsset: (categoryId: string, name: string, amount: number) => void;
  onReorderAssetItems?: (categoryId: string, orderedIds: string[]) => void;
  onUpdateCategory?: (id: string, title: string, description: string, colorClass: string, bgClass: string) => void;
  onDeleteCategory?: (id: string) => void;
}

export function AssetCategoryCard({ category, showValues, formatCurrency, onUpdateAsset, onDeleteAsset, onAddAsset, onReorderAssetItems, onUpdateCategory, onDeleteCategory }: AssetCategoryCardProps) {
  const [isEditingCard, setIsEditingCard] = useState(false);
  const [confirmDeleteCard, setConfirmDeleteCard] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [editTitle, setEditTitle] = useState(category.title);
  const [editDesc, setEditDesc] = useState(category.description);
  const [editColor, setEditColor] = useState({ colorClass: category.colorClass, bgClass: category.bgClass });
  const { toast } = useToast();

  const categoryTotal = category.items.reduce((sum, item) => sum + item.amount, 0);

  // 自動同步項目（如股票市值、Earn 收益）只在總覽計算時併入，不是真正存在於此分類的
  // 項目，不能被排序或編輯，故排除在拖曳排序清單之外，維持固定顯示在最後。
  const realItems = category.items.filter(item => !item.id.startsWith('auto-'));
  const autoItems = category.items.filter(item => item.id.startsWith('auto-'));

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = realItems.findIndex(i => i.id === active.id);
    const newIndex = realItems.findIndex(i => i.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = arrayMove(realItems, oldIndex, newIndex);
    onReorderAssetItems?.(category.id, reordered.map(i => i.id));
  };

  const handleSaveCard = () => {
    if (!editTitle.trim()) return;
    onUpdateCategory?.(category.id, editTitle.trim(), editDesc.trim() || '自訂資產類別', editColor.colorClass, editColor.bgClass);
    setIsEditingCard(false);
    toast('已更新資產類別');
  };

  const handleCancelEdit = () => {
    setEditTitle(category.title);
    setEditDesc(category.description);
    setEditColor({ colorClass: category.colorClass, bgClass: category.bgClass });
    setIsEditingCard(false);
  };

  const handleDeleteCard = () => {
    onDeleteCategory?.(category.id);
    toast(`已刪除「${category.title}」`, 'info');
  };

  return (
    <div className="group relative bg-white rounded-2xl p-6 shadow-[0_2px_15px_rgba(0,0,0,0.03)] border border-gray-100 hover:shadow-[0_8px_30px_rgba(0,0,0,0.08)] transition-all duration-300 overflow-hidden flex flex-col">
      <div className={`absolute top-0 left-0 right-0 h-1.5 ${isEditingCard ? editColor.colorClass : category.colorClass}`}></div>

      {isEditingCard ? (
        <div className="mb-4 space-y-2">
          <div>
            <label className="block text-xs text-gray-500 mb-1">類別名稱</label>
            <input
              type="text"
              value={editTitle}
              onChange={e => setEditTitle(e.target.value)}
              className="w-full text-sm border border-gray-300 rounded-lg px-3 py-1.5 outline-none focus:border-indigo-500"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">說明</label>
            <input
              type="text"
              value={editDesc}
              onChange={e => setEditDesc(e.target.value)}
              className="w-full text-sm border border-gray-300 rounded-lg px-3 py-1.5 outline-none focus:border-indigo-500"
              placeholder="簡短描述此類別"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">顏色</label>
            <div className="flex gap-2 flex-wrap">
              {CARD_COLOR_OPTIONS.map(opt => (
                <button
                  key={opt.colorClass}
                  onClick={() => setEditColor(opt)}
                  className={`w-6 h-6 rounded-full ${opt.colorClass} transition-transform ${editColor.colorClass === opt.colorClass ? 'ring-2 ring-offset-1 ring-gray-400 scale-110' : 'hover:scale-110'}`}
                />
              ))}
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <button onClick={handleSaveCard} className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-medium hover:bg-indigo-700">
              <Check className="w-3.5 h-3.5" /> 儲存
            </button>
            <button onClick={handleCancelEdit} className="flex items-center gap-1 px-3 py-1.5 bg-white text-gray-500 border border-gray-200 rounded-lg text-xs hover:bg-gray-50">
              <X className="w-3.5 h-3.5" /> 取消
            </button>
          </div>
        </div>
      ) : (
        <div className="flex justify-between items-start mb-4">
          <div>
            <div className={`inline-block px-3 py-1 rounded-full ${category.bgClass} text-xs font-medium text-gray-700 mb-2 border border-white/50`}>
              {category.title}
            </div>
            <h4 className="font-bold text-2xl text-gray-900">{formatCurrency(categoryTotal)}</h4>
          </div>
          <div className="flex items-center gap-1 mt-1">
            {(onUpdateCategory || onDeleteCategory) && (
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {onUpdateCategory && (
                  <button onClick={() => setIsEditingCard(true)} className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                )}
                {onDeleteCategory && (
                  <button onClick={() => setConfirmDeleteCard(true)} className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}
            <button
              onClick={() => setCollapsed(c => !c)}
              className="p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors ml-1"
              title={collapsed ? '展開' : '折疊'}
              aria-label={collapsed ? '展開類別' : '折疊類別'}
            >
              {collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
            </button>
          </div>
        </div>
      )}

      {!isEditingCard && <p className="text-sm text-gray-500 mb-4">{category.description}</p>}

      {!collapsed && (
        <div className="space-y-1 pt-4 border-t border-gray-50 flex-grow">
          {onReorderAssetItems ? (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={realItems.map(i => i.id)} strategy={verticalListSortingStrategy}>
                {realItems.map(item => (
                  <SortableAssetRow
                    key={item.id}
                    item={item}
                    showValues={showValues}
                    onUpdate={(name, amount) => onUpdateAsset(category.id, item.id, name, amount)}
                    onDelete={() => onDeleteAsset(category.id, item.id)}
                  />
                ))}
              </SortableContext>
            </DndContext>
          ) : (
            realItems.map(item => (
              <EditableAssetRow
                key={item.id}
                item={item}
                showValues={showValues}
                onUpdate={(name, amount) => onUpdateAsset(category.id, item.id, name, amount)}
                onDelete={() => onDeleteAsset(category.id, item.id)}
              />
            ))
          )}

          {autoItems.map(item => (
            <EditableAssetRow
              key={item.id}
              item={item}
              showValues={showValues}
              onUpdate={() => {}}
              onDelete={() => {}}
            />
          ))}

          <AddAssetRow onAdd={(name, amount) => onAddAsset(category.id, name, amount)} />
        </div>
      )}

      {confirmDeleteCard && (
        <ConfirmDialog
          message={`確定要刪除「${category.title}」整個類別及其所有項目嗎？`}
          onConfirm={handleDeleteCard}
          onCancel={() => setConfirmDeleteCard(false)}
        />
      )}
    </div>
  );
}
