import { motion } from "motion/react";
import { Send, MessageSquare, Sparkles, ChevronRight, Image as ImageIcon, CheckCircle } from "lucide-react";
import type { ActiveTab, Message } from "../types";

interface InputAreaProps {
  activeTab: ActiveTab;
  input: string;
  setInput: (text: string) => void;
  isTyping: boolean;
  worldMessages: Message[];
  handleSendMessage: (mode: 'dialogue' | 'situation', overrideText?: string) => void;
  handleConfirmWorldSetting: () => void;
}

export default function InputArea({
  activeTab, input, setInput, isTyping,
  worldMessages, handleSendMessage, handleConfirmWorldSetting,
}: InputAreaProps) {
  if (activeTab === 'protagonist' || activeTab === 'prompt') return null;

  return (
    <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-[#0A0A0A] via-[#0A0A0A] to-transparent pt-12">
      {activeTab === 'world' && worldMessages.length > 0 && (
        <motion.button
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          onClick={handleConfirmWorldSetting}
          disabled={isTyping}
          className="mb-3 w-full py-3 bg-emerald-700 text-white rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg hover:bg-emerald-600 transition-all disabled:opacity-50"
        >
          <CheckCircle size={18} />
          <span>この設定で確定して物語を開始する</span>
        </motion.button>
      )}

      <div className="flex items-end gap-3 bg-[#1A1A1A] p-2 pl-5 rounded-[28px] shadow-2xl border border-stone-800 relative z-10">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              handleSendMessage('dialogue');
            }
          }}
          placeholder={activeTab === 'world' ? "世界設定を入力..." : "メッセージを入力..."}
          className="flex-1 py-3 bg-transparent outline-none resize-none max-h-32 min-h-[44px] text-[15px] text-stone-200 placeholder:text-stone-600"
          rows={1}
        />
        <div className="flex items-center gap-2 pr-2 flex-shrink-0">
          {activeTab === 'story' ? (
            <>
              <button
                onClick={() => handleSendMessage('dialogue')}
                disabled={!input.trim() || isTyping}
                className="flex flex-col items-center gap-1 p-2 bg-amber-600/90 text-black rounded-2xl hover:bg-amber-500 transition-colors disabled:opacity-30 disabled:cursor-not-allowed shadow-lg shadow-amber-900/20 min-w-[54px]"
                title="会話として送信"
              >
                <MessageSquare size={18} />
                <span className="text-[9px] font-black">会話</span>
              </button>
              <button
                onClick={() => handleSendMessage('situation')}
                disabled={!input.trim() || isTyping}
                className="flex flex-col items-center gap-1 p-2 bg-stone-700 text-stone-200 rounded-2xl hover:bg-stone-600 transition-colors disabled:opacity-30 disabled:cursor-not-allowed shadow-lg min-w-[54px]"
                title="状況として送信"
              >
                <Sparkles size={18} />
                <span className="text-[9px] font-black">状況</span>
              </button>
              <button
                onClick={() => handleSendMessage('situation', '続けてください')}
                disabled={isTyping}
                className="flex flex-col items-center gap-1 p-2 bg-rose-700/80 text-white rounded-2xl hover:bg-rose-600 transition-colors disabled:opacity-30 disabled:cursor-not-allowed shadow-lg min-w-[54px]"
                title="物語を続ける"
              >
                <ChevronRight size={18} />
                <span className="text-[9px] font-black">続ける</span>
              </button>
              <button
                onClick={() => handleSendMessage('situation', '【画像化】')}
                disabled={isTyping}
                className="flex flex-col items-center gap-1 p-2 bg-indigo-700/80 text-white rounded-2xl hover:bg-indigo-600 transition-colors disabled:opacity-30 disabled:cursor-not-allowed shadow-lg min-w-[54px]"
                title="最新の描写を画像化"
              >
                <ImageIcon size={18} />
                <span className="text-[9px] font-black">画像化</span>
              </button>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center">
              <button
                id="send-button"
                onClick={() => handleSendMessage('dialogue')}
                disabled={!input.trim() || isTyping}
                className="p-3 bg-amber-600 text-black rounded-full hover:bg-amber-500 transition-colors disabled:opacity-30 disabled:cursor-not-allowed shadow-lg shadow-amber-900/20"
              >
                <Send size={20} />
              </button>
              <span className="text-[9px] text-stone-600 mt-1 font-medium whitespace-nowrap">Cmd+Enter</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
