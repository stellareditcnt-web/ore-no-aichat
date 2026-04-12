import React from 'react';
import { Sparkles, ChevronRight, X, RotateCcw, Trash2, BookOpen, MessageSquare, FileText } from "lucide-react";
import type { ActiveTab, ProtagonistSettings, SaveSlot } from "../types";

interface SidebarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  isSidebarOpen: boolean;
  setIsSidebarOpen: (open: boolean) => void;
  selectedModel: string;
  setSelectedModel: (model: string) => void;
  availableModels: string[];
  currentProtagonist: ProtagonistSettings;
  saveSlots: SaveSlot[];
  currentSlotId: string;
  switchWorld: (id: string) => void;
  createNewWorld: () => void;
  deleteWorld: (id: string, e: React.MouseEvent) => void;
  resetAdventure: () => void;
  clearHistory: () => void;
}

export default function Sidebar({
  activeTab, setActiveTab, isSidebarOpen, setIsSidebarOpen,
  selectedModel, setSelectedModel, availableModels,
  currentProtagonist, saveSlots, currentSlotId,
  switchWorld, createNewWorld, deleteWorld,
  resetAdventure, clearHistory,
}: SidebarProps) {
  const navItems: { tab: ActiveTab; icon: React.ReactNode; label: string }[] = [
    { tab: 'protagonist', icon: <BookOpen size={18} />, label: '主人公設定' },
    { tab: 'world',       icon: <Sparkles size={18} />,  label: '世界設定' },
    { tab: 'story',       icon: <MessageSquare size={18} />, label: '物語' },
    { tab: 'prompt',      icon: <FileText size={18} />,  label: 'プロンプト設定' },
  ];

  return (
    <>
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-72 bg-[#121212] border-r border-stone-800 flex flex-col transition-transform duration-300 ease-in-out
        lg:relative lg:translate-x-0
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="p-6 flex flex-col h-full">
          {/* Logo */}
          <div className="flex justify-between items-center mb-8">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-amber-600 rounded-lg flex items-center justify-center text-black">
                <Sparkles size={16} />
              </div>
              <h1 className="text-lg font-bold tracking-tight text-stone-100">俺のAIChat</h1>
            </div>
            <button onClick={() => setIsSidebarOpen(false)} className="p-2 hover:bg-stone-800 rounded-full text-stone-400 lg:hidden">
              <X size={20} />
            </button>
          </div>

          {/* AI Model Selector */}
          <div className="mb-6 space-y-2">
            <label className="text-[10px] uppercase tracking-widest text-stone-500 font-black px-1">AI Model</label>
            <div className="relative group">
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="w-full bg-[#1A1A1A] border border-stone-800 text-stone-200 text-xs rounded-xl p-3 outline-none appearance-none cursor-pointer focus:border-amber-500/50 transition-colors shadow-xl"
              >
                {availableModels.length > 0 ? (
                  availableModels.map(name => (
                    <option key={name} value={name}>{name}</option>
                  ))
                ) : (
                  <option value={selectedModel || 'llama3'}>{selectedModel || 'Loading...'}</option>
                )}
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-stone-500">
                <ChevronRight size={14} className="rotate-90" />
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="space-y-2 mb-8">
            {navItems.map(({ tab, icon, label }) => (
              <button
                key={tab}
                onClick={() => { setActiveTab(tab); setIsSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 p-3 rounded-xl transition-colors ${activeTab === tab ? 'bg-stone-800 text-amber-400' : 'hover:bg-stone-900 text-stone-500'}`}
              >
                {icon}
                <span>{label}</span>
              </button>
            ))}
          </nav>

          {/* Protagonist Status */}
          <div className="mb-8 p-5 bg-[#1A1A1A]/60 backdrop-blur-md rounded-2xl border border-stone-800/50 shadow-2xl">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 bg-gradient-to-br from-amber-500 to-amber-700 rounded-2xl flex items-center justify-center text-black font-black text-xl shadow-lg shadow-amber-900/20">
                {currentProtagonist.name.charAt(0)}
              </div>
              <div>
                <div className="text-base font-bold text-stone-100 tracking-tight">{currentProtagonist.name}</div>
                <div className="text-[10px] text-amber-500/70 uppercase tracking-widest font-black">{currentProtagonist.occupation}</div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[10px]">
              <div className="bg-stone-900/80 p-2.5 rounded-xl border border-stone-800/50">
                <div className="text-stone-500 mb-0.5 font-bold uppercase tracking-tighter">Age</div>
                <div className="text-stone-300 font-medium">{currentProtagonist.age}</div>
              </div>
              <div className="bg-stone-900/80 p-2.5 rounded-xl border border-stone-800/50">
                <div className="text-stone-500 mb-0.5 font-bold uppercase tracking-tighter">Gender</div>
                <div className="text-stone-300 font-medium">{currentProtagonist.gender}</div>
              </div>
            </div>
          </div>

          {/* Worlds List */}
          <div className="flex-1 overflow-y-auto custom-scrollbar space-y-4">
            <div className="flex items-center justify-between px-2">
              <span className="text-[10px] font-bold text-stone-500 uppercase tracking-widest">Saved Worlds</span>
              <button
                onClick={createNewWorld}
                className="p-1 text-amber-500 hover:bg-amber-950/30 rounded-md transition-colors"
                title="新しい世界を作成"
              >
                <Sparkles size={14} />
              </button>
            </div>
            <div className="space-y-2">
              {saveSlots.map(slot => (
                <div
                  key={slot.id}
                  className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all ${currentSlotId === slot.id
                    ? 'bg-stone-800 border-amber-900/50 text-stone-100'
                    : 'bg-transparent border-stone-900 text-stone-500 hover:bg-stone-900 hover:border-stone-800'
                    }`}
                >
                  <div
                    className="flex-1 cursor-pointer overflow-hidden pr-2"
                    onClick={() => switchWorld(slot.id)}
                  >
                    <div className="text-xs font-bold truncate mb-1">
                      {slot.confirmedWorldSetting ? (slot.confirmedWorldSetting.substring(0, 20) + '...') : slot.name}
                    </div>
                    <div className="text-[9px] text-stone-600">
                      {new Date(slot.lastUpdated).toLocaleDateString()}
                    </div>
                  </div>
                  <button
                    onClick={(e) => deleteWorld(slot.id, e)}
                    className="p-2 text-stone-700 hover:text-red-500 hover:bg-red-900/20 rounded-lg transition-colors shrink-0"
                    title="この世界を削除"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
              {saveSlots.length === 0 && (
                <div className="text-center py-4 text-[10px] text-stone-600">
                  保存された世界はありません
                </div>
              )}
            </div>
          </div>

          {/* Footer Actions */}
          <div className="mt-8 pt-6 border-t border-stone-800 space-y-2">
            {activeTab === 'story' && (
              <button
                onClick={() => { resetAdventure(); setIsSidebarOpen(false); }}
                className="w-full flex items-center gap-3 p-3 rounded-xl text-rose-500 hover:bg-rose-950/30 transition-colors text-sm"
              >
                <RotateCcw size={16} />
                <span>物語をリセット</span>
              </button>
            )}
            <button
              onClick={clearHistory}
              className="w-full flex items-center gap-3 p-3 text-red-800 hover:bg-red-950/30 rounded-xl transition-colors text-sm"
            >
              <Trash2 size={16} />
              <span>全データを消去</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}
    </>
  );
}
