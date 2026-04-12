import { motion, AnimatePresence } from "motion/react";
import { X, Heart, HeartCrack, Camera, Loader2 } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import type { Character } from "../types";

interface CharacterStatusProps {
  characters: Character[];
  removeCharacter: (name: string) => void;
  onIconGenerated: (name: string, url: string) => void;
  selectedModel: string;
}

interface CharacterCardProps {
  char: Character;
  removeCharacter: (name: string) => void;
  onIconGenerated: (name: string, url: string) => void;
  selectedModel: string;
}

const CharacterCard: React.FC<CharacterCardProps> = ({ char, removeCharacter, onIconGenerated, selectedModel }) => {
  const [affectionDiff, setAffectionDiff] = useState(0);
  const prevAffectionRef = useRef(char.affection);
  const [isGeneratingIcon, setIsGeneratingIcon] = useState(false);
  const [iconError, setIconError] = useState<string | null>(null);

  useEffect(() => {
    if (char.affection !== prevAffectionRef.current) {
      setAffectionDiff(char.affection - prevAffectionRef.current);
      prevAffectionRef.current = char.affection;
      const timer = setTimeout(() => setAffectionDiff(0), 3000);
      return () => clearTimeout(timer);
    }
  }, [char.affection]);

  const handleGenerateIcon = async () => {
    setIsGeneratingIcon(true);
    setIconError(null);
    try {
      const response = await fetch('/api/generate-icon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          character: {
            name: char.name,
            appearance: char.appearance,
            outfit: char.outfit,
            gender: char.gender,
          },
          model: selectedModel,
        }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'アイコン生成に失敗しました');
      }
      const data = await response.json();
      onIconGenerated(char.name, data.iconUrl);
    } catch (err: any) {
      setIconError(err.message || 'エラーが発生しました');
      setTimeout(() => setIconError(null), 5000);
    } finally {
      setIsGeneratingIcon(false);
    }
  };

  return (
    <motion.div
      layout
      animate={affectionDiff !== 0 ? { scale: [1, 1.05, 1], y: [0, -3, 0] } : {}}
      transition={{ duration: 0.4 }}
      className={`bg-[#1A1A1A] p-2 rounded-lg border shadow-lg min-w-[140px] flex flex-col gap-1.5 relative group transition-colors duration-500 ${
        affectionDiff > 0 ? 'border-pink-500/50 shadow-pink-500/20' :
        affectionDiff < 0 ? 'border-indigo-500/50 shadow-indigo-500/20' :
        'border-stone-800'
      }`}
    >
      <button
        onClick={() => removeCharacter(char.name)}
        className="absolute -top-1 -right-1 w-4 h-4 bg-stone-800 text-stone-400 rounded-full flex items-center justify-center text-[8px] hover:bg-red-900 hover:text-white transition-colors border border-stone-700 z-10 opacity-0 group-hover:opacity-100"
      >
        <X size={10} />
      </button>

      {/* 差分エフェクトのアイコンフロート */}
      <AnimatePresence>
        {affectionDiff !== 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.5 }}
            animate={{ opacity: 1, y: -20, scale: 1.2 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className={`absolute top-0 right-2 z-20 flex items-center gap-0.5 text-[10px] font-bold ${
              affectionDiff > 0 ? 'text-pink-400' : 'text-indigo-400'
            }`}
          >
            {affectionDiff > 0 ? <Heart size={12} fill="currentColor" /> : <HeartCrack size={12} fill="currentColor" />}
            {affectionDiff > 0 ? '+' : ''}{affectionDiff}
          </motion.div>
        )}
      </AnimatePresence>

      {/* アイコン表示エリア */}
      <div className="relative w-14 h-14 mx-auto">
        <div className="w-full h-full rounded-lg overflow-hidden bg-stone-900 border border-stone-700 flex items-center justify-center">
          {char.iconUrl ? (
            <img src={char.iconUrl} alt={char.name} className="w-full h-full object-cover" />
          ) : (
            <span className="text-2xl font-bold text-amber-500/60 select-none">
              {char.name.charAt(0)}
            </span>
          )}
        </div>
        {/* アイコン生成ボタン（ホバー時にオーバーレイ） */}
        <button
          onClick={handleGenerateIcon}
          disabled={isGeneratingIcon}
          title="アイコンを生成"
          className="absolute inset-0 rounded-lg flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity disabled:cursor-not-allowed"
        >
          {isGeneratingIcon
            ? <Loader2 size={16} className="animate-spin text-white" />
            : <Camera size={16} className="text-white" />}
        </button>
      </div>

      {iconError && (
        <div className="text-[8px] text-red-400 text-center leading-tight px-1 line-clamp-2">{iconError}</div>
      )}

      <div className="flex justify-between items-center">
        <span className="text-[11px] font-bold text-amber-500 truncate pr-2">{char.name}</span>
        <span className={`text-[10px] font-bold transition-colors ${affectionDiff > 0 ? 'text-pink-400' : affectionDiff < 0 ? 'text-indigo-400' : 'text-rose-500'}`}>
          {char.affection}%
        </span>
      </div>
      <div className="h-1 bg-stone-900 rounded-full overflow-hidden relative">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${Math.max(0, Math.min(100, char.affection))}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className={`h-full absolute left-0 top-0 transition-colors ${
            affectionDiff > 0 ? 'bg-gradient-to-r from-pink-600 to-pink-400' :
            affectionDiff < 0 ? 'bg-gradient-to-r from-indigo-700 to-indigo-500' :
            'bg-gradient-to-r from-rose-700 to-rose-500'
          }`}
        />
      </div>
      <div className="flex flex-col gap-0.5 text-[9px] text-stone-400">
        <div className="line-clamp-1"><span className="text-stone-600 mr-1">外見:</span>{char.appearance || "未設定"}</div>
        <div className="line-clamp-1"><span className="text-stone-600 mr-1">服装:</span>{char.outfit || "未設定"}</div>
        <div className="line-clamp-1 italic text-stone-500"><span className="text-stone-600 mr-1 not-italic">状態:</span>{char.condition || "通常"}</div>
      </div>
    </motion.div>
  );
}

export default function CharacterStatus({ characters, removeCharacter, onIconGenerated, selectedModel }: CharacterStatusProps) {
  if (characters.length === 0) return null;

  return (
    <div className="px-6 py-2 bg-[#0F0F0F] border-b border-stone-900 flex flex-col gap-2 overflow-x-auto custom-scrollbar">
      <div className="flex gap-3 min-w-max">
        {[...characters].sort((a, b) => (a.gender === '女性' ? -1 : 1)).map((char, idx) => (
          <CharacterCard key={`${char.name}-${idx}`} char={char} removeCharacter={removeCharacter} onIconGenerated={onIconGenerated} selectedModel={selectedModel} />
        ))}
      </div>
    </div>
  );
}
