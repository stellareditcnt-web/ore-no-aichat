import React from 'react';
import { Sparkles, X, ChevronRight } from "lucide-react";
import type { ActiveTab, ProtagonistSettings } from "../types";

interface ProtagonistTabProps {
  protagonists: ProtagonistSettings[];
  currentProtagonistId: string;
  setCurrentProtagonistId: (id: string) => void;
  currentProtagonist: ProtagonistSettings;
  createNewProtagonist: () => void;
  deleteProtagonist: (id: string, e: React.MouseEvent) => void;
  updateCurrentProtagonist: (updates: Partial<ProtagonistSettings>) => void;
  saveSettings: () => void;
  setActiveTab: (tab: ActiveTab) => void;
}

export default function ProtagonistTab({
  protagonists, currentProtagonistId, setCurrentProtagonistId,
  currentProtagonist, createNewProtagonist, deleteProtagonist,
  updateCurrentProtagonist, saveSettings, setActiveTab,
}: ProtagonistTabProps) {
  return (
    <div className="max-w-2xl mx-auto space-y-8 pb-32">
      <div className="text-center space-y-2">
        <h2 className="text-2xl text-amber-500">主人公（プレイヤー）設定</h2>
        <p className="text-stone-500 text-sm">物語の主人公となる、あなた自身の詳細を設定してください。</p>
      </div>

      {/* 主人公セレクター */}
      <div className="flex flex-wrap gap-3 justify-center mb-4">
        {protagonists.map(p => (
          <div key={p.id} className="relative group">
            <button
              onClick={() => setCurrentProtagonistId(p.id)}
              className={`px-4 py-2 rounded-xl border transition-all text-sm font-medium ${currentProtagonistId === p.id
                ? 'bg-amber-600 border-amber-500 text-black shadow-lg shadow-amber-900/20'
                : 'bg-stone-900 border-stone-800 text-stone-500 hover:border-stone-700'
                }`}
            >
              {p.name}
            </button>
            <button
              onClick={(e) => deleteProtagonist(p.id, e)}
              className="absolute -top-2 -right-2 w-5 h-5 bg-red-600 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
            >
              <X size={10} />
            </button>
          </div>
        ))}
        <button
          onClick={createNewProtagonist}
          className="px-4 py-2 rounded-xl border border-dashed border-stone-700 text-stone-600 hover:border-amber-500 hover:text-amber-500 transition-all text-sm font-medium flex items-center gap-2"
        >
          <Sparkles size={14} />
          <span>新規作成</span>
        </button>
      </div>

      {/* 設定フォーム */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-[#1A1A1A]/40 backdrop-blur-xl p-8 rounded-[40px] shadow-2xl border border-stone-800/50">
        {[
          { label: '名前',   key: 'name' as const,   multiline: false },
          { label: '呼び名（デフォルト）', key: 'nickname' as const, multiline: false, placeholder: '例: あなた, 先生, お兄ちゃん...' },
          { label: '年齢',   key: 'age' as const,    multiline: false },
          { label: '性別',   key: 'gender' as const, multiline: false },
          { label: '職業',   key: 'occupation' as const, multiline: false },
        ].map(({ label, key, multiline, placeholder }) => (
          <div key={key} className="space-y-2">
            <label className="text-[10px] uppercase tracking-widest text-amber-500/70 font-black">{label}</label>
            <input
              type="text"
              value={currentProtagonist[key]}
              onChange={(e) => updateCurrentProtagonist({ [key]: e.target.value })}
              placeholder={placeholder}
              className="w-full bg-stone-950/50 text-stone-200 border border-stone-800/50 rounded-2xl px-5 py-4 outline-none focus:ring-2 focus:ring-amber-500/20 transition-all placeholder:text-stone-800"
            />
          </div>
        ))}

        {[
          { label: '性格',               key: 'personality' as const, placeholder: undefined },
          { label: '好きな性癖・フェチ',   key: 'fetishes' as const,   placeholder: '例: 巨乳, 誘惑, 逆レイプ, 羞恥...' },
          { label: '身体的特徴',           key: 'features' as const,   placeholder: undefined },
        ].map(({ label, key, placeholder }) => (
          <div key={key} className="space-y-2 md:col-span-2">
            <label className="text-[10px] uppercase tracking-widest text-amber-500/70 font-black">{label}</label>
            <textarea
              value={currentProtagonist[key]}
              onChange={(e) => updateCurrentProtagonist({ [key]: e.target.value })}
              placeholder={placeholder}
              className="w-full bg-stone-950/50 text-stone-200 border border-stone-800/50 rounded-2xl px-5 py-4 outline-none focus:ring-2 focus:ring-amber-500/20 transition-all resize-none placeholder:text-stone-800 min-h-[100px]"
              rows={3}
            />
          </div>
        ))}
      </div>

      <div className="flex justify-center gap-4">
        <button
          onClick={saveSettings}
          className="flex items-center gap-2 px-8 py-4 bg-stone-900 border border-stone-800 text-stone-300 rounded-full font-medium hover:bg-stone-800 transition-all shadow-xl"
        >
          <span>設定を保存</span>
        </button>
        <button
          onClick={() => setActiveTab('world')}
          className="flex items-center gap-2 px-8 py-4 bg-amber-600 text-black rounded-full font-bold hover:bg-amber-500 transition-all shadow-lg shadow-amber-900/20"
        >
          <span>次へ（世界構築）</span>
          <ChevronRight size={18} />
        </button>
      </div>
    </div>
  );
}
