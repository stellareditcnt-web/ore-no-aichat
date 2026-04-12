import { type RefObject } from "react";
import { motion } from "motion/react";
import { Sparkles, MessageSquare } from "lucide-react";
// Note: the outer animation wrapper (motion.div) is managed by App.tsx
import FormattedText from "./FormattedText";
import type { Message } from "../types";

interface ChatViewProps {
  activeTab: 'world' | 'story';
  messages: Message[];
  isTyping: boolean;
  chatEndRef: RefObject<HTMLDivElement>;
  setInput: (text: string) => void;
}

export default function ChatView({ activeTab, messages, isTyping, chatEndRef, setInput }: ChatViewProps) {
  const handleAiProposal = () => {
    setInput('最高にエキサイティングで背徳的な世界観を一つ提案してください。');
    setTimeout(() => {
      const sendBtn = document.getElementById('send-button');
      sendBtn?.click();
    }, 100);
  };

  return (
    <div className="space-y-6 pb-32">
      {/* Empty state */}
      {messages.length === 0 && (
        <div className="text-center py-20 space-y-6">
          <div className="w-16 h-16 bg-stone-900 rounded-full flex items-center justify-center mx-auto text-stone-700">
            {activeTab === 'world' ? <Sparkles size={32} /> : <MessageSquare size={32} />}
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl text-amber-500">
              {activeTab === 'world' ? '世界設定を構築しましょう' : '会話を始めましょう'}
            </h2>
            <p className="text-stone-500 max-w-xs mx-auto text-sm">
              {activeTab === 'world'
                ? 'どんなシチュエーションで、どんな女性と出会いたいですか？'
                : '好きな状況や発言を入力して、物語を始めてください。'}
            </p>
            {activeTab === 'world' && (
              <button
                onClick={handleAiProposal}
                className="mt-4 px-6 py-2 bg-amber-600/20 text-amber-500 rounded-full text-xs font-bold border border-amber-600/30 hover:bg-amber-600/30 transition-all flex items-center gap-2 mx-auto"
              >
                <Sparkles size={14} />
                AIに世界観を提案してもらう
              </button>
            )}
          </div>
        </div>
      )}

      {/* Messages */}
      {messages.map((msg, i) => (
        <motion.div
          key={`${activeTab}-${i}`}
          initial={{ opacity: 0, y: 10, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
        >
          <div className={`max-w-[85%] px-5 py-3 rounded-2xl text-[15px] leading-relaxed whitespace-pre-wrap transition-all ${msg.role === 'user'
            ? 'bg-gradient-to-br from-amber-600 to-amber-700 text-black rounded-tr-none shadow-lg shadow-amber-900/20 font-medium'
            : 'bg-[#1A1A1A] border border-stone-800 text-stone-200 rounded-tl-none shadow-xl backdrop-blur-sm'
            }`}>
            <FormattedText text={msg.text} isUser={msg.role === 'user'} />
            {msg.imageUrl && (
              <img src={msg.imageUrl} alt="生成された画像" className="mt-3 rounded-xl max-w-full border border-stone-700" />
            )}
          </div>
        </motion.div>
      ))}

      {/* Typing indicator */}
      {isTyping && (
        <div className="flex justify-start">
          <div className="bg-[#1A1A1A] border border-stone-800 p-4 rounded-2xl rounded-tl-none flex gap-1">
            <motion.div animate={{ opacity: [0, 1, 0] }} transition={{ repeat: Infinity, duration: 1 }} className="w-1.5 h-1.5 bg-stone-600 rounded-full" />
            <motion.div animate={{ opacity: [0, 1, 0] }} transition={{ repeat: Infinity, duration: 1, delay: 0.2 }} className="w-1.5 h-1.5 bg-stone-600 rounded-full" />
            <motion.div animate={{ opacity: [0, 1, 0] }} transition={{ repeat: Infinity, duration: 1, delay: 0.4 }} className="w-1.5 h-1.5 bg-stone-600 rounded-full" />
          </div>
        </div>
      )}

      <div ref={chatEndRef} />
    </div>
  );
}
