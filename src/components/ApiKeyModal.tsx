import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Key, ExternalLink, CheckCircle, AlertCircle } from 'lucide-react';

interface ApiKeyModalProps {
  isOpen: boolean;
  onSave: (apiKey: string) => void;
  isUpdate?: boolean; // true のときは「変更」モードとして表示
}

export default function ApiKeyModal({ isOpen, onSave, isUpdate = false }: ApiKeyModalProps) {
  const [key, setKey] = useState('');
  const [error, setError] = useState('');
  const [isTesting, setIsTesting] = useState(false);

  const handleSave = async () => {
    const trimmed = key.trim();
    if (!trimmed) {
      setError('APIキーを入力してください。');
      return;
    }
    setError('');
    setIsTesting(true);
    try {
      // 簡易バリデーション：Gemini APIに軽いリクエストを投げて確認
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-001:generateContent?key=${trimmed}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: 'hi' }] }],
            generationConfig: { maxOutputTokens: 5 },
          }),
        }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error?.message || `HTTP ${res.status}`);
      }
      onSave(trimmed);
    } catch (e: any) {
      setError(`APIキーが無効です: ${e.message}`);
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm px-4"
        >
          <motion.div
            initial={{ scale: 0.92, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.92, opacity: 0, y: 20 }}
            className="w-full max-w-md bg-[#121212] border border-stone-800 rounded-[32px] p-8 shadow-2xl"
          >
            {/* アイコン */}
            <div className="flex justify-center mb-6">
              <div className="w-14 h-14 bg-amber-600/20 border border-amber-600/30 rounded-2xl flex items-center justify-center">
                <Key size={28} className="text-amber-400" />
              </div>
            </div>

            {/* タイトル */}
            <h2 className="text-xl font-bold text-stone-100 text-center mb-1">
              {isUpdate ? 'APIキーを変更' : 'Gemini APIキーを設定'}
            </h2>
            <p className="text-stone-500 text-sm text-center mb-6">
              {isUpdate
                ? '新しいGemini APIキーを入力してください。'
                : 'このアプリを使用するにはGemini APIキーが必要です。'}
            </p>

            {/* APIキー取得リンク */}
            {!isUpdate && (
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 mb-5 px-4 py-2.5 bg-stone-900 border border-stone-800 rounded-xl text-xs text-amber-400 hover:border-amber-600/40 hover:bg-amber-950/20 transition-all"
              >
                <ExternalLink size={12} />
                Google AI Studio でAPIキーを無料取得する
              </a>
            )}

            {/* 入力欄 */}
            <div className="space-y-3 mb-5">
              <input
                type="password"
                value={key}
                onChange={(e) => { setKey(e.target.value); setError(''); }}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); }}
                placeholder="AIzaSy..."
                className="w-full bg-stone-950 border border-stone-800 text-stone-200 rounded-2xl px-4 py-3.5 text-sm outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-600/50 transition-all font-mono placeholder:text-stone-700"
                autoFocus
              />
              {error && (
                <div className="flex items-start gap-2 text-red-400 text-xs bg-red-950/30 border border-red-900/40 rounded-xl px-4 py-3">
                  <AlertCircle size={12} className="shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}
            </div>

            {/* ボタン */}
            <button
              onClick={handleSave}
              disabled={isTesting || !key.trim()}
              className="w-full py-3.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-40 disabled:cursor-not-allowed text-black font-bold rounded-2xl transition-all flex items-center justify-center gap-2"
            >
              {isTesting ? (
                <>
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                    className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full"
                  />
                  確認中...
                </>
              ) : (
                <>
                  <CheckCircle size={16} />
                  {isUpdate ? 'APIキーを更新する' : 'APIキーを保存して開始する'}
                </>
              )}
            </button>

            <p className="text-[10px] text-stone-600 text-center mt-4">
              APIキーはお使いのブラウザにのみ保存され、外部に送信されません。
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
