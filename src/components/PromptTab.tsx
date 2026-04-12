import React from 'react';
import { Sparkles, X, RotateCcw, CheckCircle } from "lucide-react";
import { DEFAULT_WORLD_PROMPT, DEFAULT_ADVENTURE_PROMPT } from "../constants";
import type { PromptSettings } from "../types";

interface PromptTabProps {
  promptPresets: PromptSettings[];
  currentPromptId: string;
  setCurrentPromptId: (id: string) => void;
  currentPrompt: PromptSettings | undefined;
  createNewPromptPreset: () => void;
  deletePromptPreset: (id: string, e: React.MouseEvent) => void;
  updateCurrentPrompt: (updates: Partial<PromptSettings>) => void;
}

export default function PromptTab({
  promptPresets, currentPromptId, setCurrentPromptId,
  currentPrompt, createNewPromptPreset, deletePromptPreset, updateCurrentPrompt,
}: PromptTabProps) {
  return (
    <div className="max-w-2xl mx-auto space-y-8 pb-32">
      <div className="text-center space-y-2">
        <h2 className="text-2xl text-amber-500">プロンプト設定</h2>
        <p className="text-stone-500 text-sm">AIへの指示（システムプロンプト）を編集・保存できます。</p>
      </div>

      {/* プリセット選択 */}
      <div className="flex flex-wrap gap-3 justify-center">
        {promptPresets.map(p => (
          <div key={p.id} className="relative group">
            <button
              onClick={() => setCurrentPromptId(p.id)}
              className={`px-4 py-2 rounded-xl border transition-all text-sm font-medium ${
                currentPromptId === p.id
                  ? 'bg-amber-600 border-amber-500 text-black shadow-lg shadow-amber-900/20'
                  : 'bg-stone-900 border-stone-800 text-stone-500 hover:border-stone-700'
              }`}
            >
              {p.name}
            </button>
            <button
              onClick={(e) => deletePromptPreset(p.id, e)}
              className="absolute -top-2 -right-2 w-5 h-5 bg-red-600 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
            >
              <X size={10} />
            </button>
          </div>
        ))}
        <button
          onClick={createNewPromptPreset}
          className="px-4 py-2 rounded-xl border border-dashed border-stone-700 text-stone-600 hover:border-amber-500 hover:text-amber-500 transition-all text-sm font-medium flex items-center gap-2"
        >
          <Sparkles size={14} />
          <span>新規作成</span>
        </button>
      </div>

      {/* 編集フォーム */}
      {currentPrompt && (
        <div className="space-y-6 bg-[#1A1A1A]/40 backdrop-blur-xl p-8 rounded-[40px] shadow-2xl border border-stone-800/50">
          {/* プリセット名 */}
          <div className="space-y-2">
            <label className="text-[10px] uppercase tracking-widest text-amber-500/70 font-black">プリセット名</label>
            <input
              type="text"
              value={currentPrompt.name}
              onChange={(e) => updateCurrentPrompt({ name: e.target.value })}
              className="w-full bg-stone-950/50 text-stone-200 border border-stone-800/50 rounded-2xl px-5 py-4 outline-none focus:ring-2 focus:ring-amber-500/20 transition-all"
            />
          </div>

          {/* 世界設定用プロンプト */}
          <div className="space-y-2">
            <label className="text-[10px] uppercase tracking-widest text-amber-500/70 font-black">世界設定フェーズ用プロンプト</label>
            <textarea
              value={currentPrompt.worldPrompt}
              onChange={(e) => updateCurrentPrompt({ worldPrompt: e.target.value })}
              className="w-full bg-stone-950/50 text-stone-200 border border-stone-800/50 rounded-2xl px-5 py-4 outline-none focus:ring-2 focus:ring-amber-500/20 transition-all resize-y font-mono text-xs leading-relaxed"
              rows={10}
            />
          </div>

          {/* 冒険用プロンプト */}
          <div className="space-y-2">
            <label className="text-[10px] uppercase tracking-widest text-amber-500/70 font-black">冒険（物語）フェーズ用プロンプトテンプレート</label>
            <textarea
              value={currentPrompt.adventurePrompt}
              onChange={(e) => updateCurrentPrompt({ adventurePrompt: e.target.value })}
              className="w-full bg-stone-950/50 text-stone-200 border border-stone-800/50 rounded-2xl px-5 py-4 outline-none focus:ring-2 focus:ring-amber-500/20 transition-all resize-y font-mono text-xs leading-relaxed"
              rows={14}
            />
            <div className="bg-stone-950/60 rounded-2xl p-4 border border-stone-800/40 space-y-1.5">
              <p className="text-[10px] text-amber-500/60 font-black uppercase tracking-widest mb-2">使用できるプレースホルダー</p>
              {[
                ['{{worldSetting}}',    '確定した世界設定の内容'],
                ['{{protagonistName}}', '主人公の名前'],
                ['{{protagonistGender}}', '主人公の性別'],
                ['{{hasCharacters}}',   'キャラクターの有無に応じたヒント文'],
              ].map(([ph, desc]) => (
                <div key={ph} className="flex items-start gap-3">
                  <code className="text-rose-400 text-[10px] font-mono shrink-0">{ph}</code>
                  <span className="text-stone-500 text-[10px]">{desc}</span>
                </div>
              ))}
            </div>
          </div>

          {/* フッター */}
          <div className="flex justify-between items-center pt-2">
            <button
              onClick={() => updateCurrentPrompt({
                worldPrompt: DEFAULT_WORLD_PROMPT,
                adventurePrompt: DEFAULT_ADVENTURE_PROMPT,
              })}
              className="flex items-center gap-2 px-5 py-3 bg-stone-900 border border-stone-800 text-stone-500 rounded-full text-xs font-medium hover:text-stone-300 hover:border-stone-700 transition-all"
            >
              <RotateCcw size={12} />
              デフォルトに戻す
            </button>
            <div className="flex items-center gap-2 text-emerald-500 text-xs">
              <CheckCircle size={14} />
              <span>変更は自動保存されます</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
