import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from "motion/react";
import { Menu, Key } from "lucide-react";

import { type ActiveTab, type Character, type Message, type PromptSettings, type ProtagonistSettings, type SaveSlot } from './types';
import { STORAGE_KEY, DEFAULT_WORLD_PROMPT, DEFAULT_ADVENTURE_PROMPT, DEFAULT_WORLD_SUMMARY_PROMPT, DEFAULT_STORY_SUMMARY_PROMPT, MODERN_FEMALE_NAMES, MODERN_MALE_NAMES } from './constants';
import Sidebar from './components/Sidebar';
import CharacterStatus from './components/CharacterStatus';
import PromptTab from './components/PromptTab';
import ProtagonistTab from './components/ProtagonistTab';
import ChatView from './components/ChatView';
import InputArea from './components/InputArea';
import ApiKeyModal from './components/ApiKeyModal';

const GEMINI_API_KEY_STORAGE = 'gemini_api_key';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('protagonist');
  const [saveSlots, setSaveSlots] = useState<SaveSlot[]>([]);
  const [currentSlotId, setCurrentSlotId] = useState<string>('');

  const [worldMessages, setWorldMessages] = useState<Message[]>([]);
  const [adventureMessages, setAdventureMessages] = useState<Message[]>([]);
  const [confirmedWorldSetting, setConfirmedWorldSetting] = useState('');
  const [storySummary, setStorySummary] = useState('');
  const [characters, setCharacters] = useState<Character[]>([]);

  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [removedCharacters, setRemovedCharacters] = useState<string[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [backendStatus, setBackendStatus] = useState<{ ok: boolean; localConfigured: boolean } | null>(null);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [isLoaded, setIsLoaded] = useState(false);

  const [geminiApiKey, setGeminiApiKey] = useState<string>('');
  const [showApiKeyModal, setShowApiKeyModal] = useState<boolean>(false);
  const [isApiKeyUpdate, setIsApiKeyUpdate] = useState<boolean>(false);

  const [protagonists, setProtagonists] = useState<ProtagonistSettings[]>([]);
  const [currentProtagonistId, setCurrentProtagonistId] = useState<string>('');

  const [promptPresets, setPromptPresets] = useState<PromptSettings[]>([]);
  const [currentPromptId, setCurrentPromptId] = useState<string>('');

  const chatEndRef = useRef<HTMLDivElement>(null);

  const currentProtagonist = protagonists.find(p => p.id === currentProtagonistId) || protagonists[0] || {
    id: 'default', name: 'あなた', nickname: 'あなた', age: '20代',
    gender: '男性', occupation: '学生', personality: '普通', fetishes: '特になし', features: '平凡',
  };

  const currentPrompt = promptPresets.find(p => p.id === currentPromptId) || promptPresets[0];

  const buildAdventurePrompt = (worldSetting: string, protagonist: ProtagonistSettings, hasCharacters: boolean) => {
    if (!currentPrompt) return '【最重要ルール】すべての返答を日本語で行うこと。あなたは有能なロールプレイアシスタントです。';

    // 主人公情報をPLists形式で埋め込む
    const protagonistPList = `[主人公: ${protagonist.name}
  ("性別": "${protagonist.gender}")
  ("年齢": "${protagonist.age}")
  ("職業": "${protagonist.occupation}")
  ("性格": "${protagonist.personality}")
  ("外見的特徴": "${protagonist.features}")
  ("フェチ・好み": "${protagonist.fetishes}")
  ("NPCからの呼び名": "${protagonist.nickname}")]`;

    const phaseText = !hasCharacters
      ? `[フェーズ: プロローグ]
NPCを一人登場させ、${protagonist.name}との最初の出会いの場面を鮮やかに描写する。
語り手（ナレーター）とNPCの視点のみで描写する。`
      : `[フェーズ: 物語の継続]
前の場面から自然につながるよう、NPCのセリフと情景を描写する。
語り手（ナレーター）とNPCの視点のみで描写する。`;

    const summaryText = storySummary ? `\n[これまでのあらすじ]\n${storySummary}\n` : '';

    // ランダムサンプリング：女性12名・男性6名を毎回抽出
    const shuffle = <T,>(arr: T[]) => [...arr].sort(() => Math.random() - 0.5);
    const femaleNames = shuffle(MODERN_FEMALE_NAMES).slice(0, 12).join('・');
    const maleNames = shuffle(MODERN_MALE_NAMES).slice(0, 6).join('・');
    const nameSuggestion = `\n[NPC名前候補（この中から選ぶこと。昭和風・古風な名前は使用禁止）]\n女性: ${femaleNames}\n男性: ${maleNames}\n`;

    return currentPrompt.adventurePrompt
      .replace('{{worldSetting}}', worldSetting)
      .replace('{{protagonistName}}', protagonist.name)
      .replace('{{protagonistGender}}', protagonist.gender)
      .replace('{{storySummary}}', summaryText)
      .replace('{{hasCharacters}}', `${protagonistPList}\n\n${phaseText}${nameSuggestion}`);
  };

  // --- Initial load from localStorage ---
  useEffect(() => {
    const savedData = localStorage.getItem(STORAGE_KEY);
    if (!savedData) {
      const protoId = Date.now().toString();
      setProtagonists([{ id: protoId, name: 'あなた', nickname: 'あなた', age: '20代', gender: '男性', occupation: '学生', personality: '普通', fetishes: '特になし', features: '平凡' }]);
      setCurrentProtagonistId(protoId);

      const promptId = (Date.now() + 2).toString();
      setPromptPresets([{ id: promptId, name: 'デフォルト', worldPrompt: DEFAULT_WORLD_PROMPT, adventurePrompt: DEFAULT_ADVENTURE_PROMPT }]);
      setCurrentPromptId(promptId);

      const slotId = (Date.now() + 1).toString();
      setSaveSlots([{ id: slotId, name: '新しい世界 1', worldMessages: [], adventureMessages: [], confirmedWorldSetting: '', storySummary: '', characters: [], lastUpdated: Date.now() }]);
      setCurrentSlotId(slotId);
      setIsLoaded(true);
      return;
    }

    try {
      const parsed = JSON.parse(savedData);

      if (parsed.protagonists) {
        setProtagonists(parsed.protagonists);
        setCurrentProtagonistId(parsed.currentProtagonistId || parsed.protagonists[0]?.id || '');
      }

      if (parsed.saveSlots && parsed.saveSlots.length > 0) {
        setSaveSlots(parsed.saveSlots);
        const slotId = parsed.currentSlotId || parsed.saveSlots[0].id;
        setCurrentSlotId(slotId);
        const currentSlot = parsed.saveSlots.find((s: SaveSlot) => s.id === slotId);
        if (currentSlot) {
          setWorldMessages(currentSlot.worldMessages);
          setAdventureMessages(currentSlot.adventureMessages);
          setConfirmedWorldSetting(currentSlot.confirmedWorldSetting);
          setStorySummary(currentSlot.storySummary || '');
          setCharacters(currentSlot.characters);
        }
      }

      if (parsed.promptPresets && parsed.promptPresets.length > 0) {
        // ─────────────────────────────────────────────────────────────
        // 【自動マイグレーション】古いプロンプトプリセットの検出と自動更新
        // 古いプロンプト（「TRPGの優秀なゲームマスター」ベース）が保存されている場合
        // 最新の改善版プロンプトに自動的に上書きする。
        // これにより、ユーザーが手動でリセットしなくても最新版が適用される。
        // ─────────────────────────────────────────────────────────────
        const RPMASTER_SIGNATURE = 'RPMaster';
        const migratedPresets = parsed.promptPresets.map((preset: PromptSettings) => {
          const isOldFormat = !preset.adventurePrompt?.includes(RPMASTER_SIGNATURE);
          if (isOldFormat) {
            console.log(`[MIGRATION] プリセット「${preset.name}」をRPMaster版プロンプトに自動更新しました`);
            return { ...preset, worldPrompt: DEFAULT_WORLD_PROMPT, adventurePrompt: DEFAULT_ADVENTURE_PROMPT };
          }
          return preset;
        });
        setPromptPresets(migratedPresets);
        setCurrentPromptId(parsed.currentPromptId || parsed.promptPresets[0]?.id || '');
      } else {
        const promptId = (Date.now() + 2).toString();
        setPromptPresets([{ id: promptId, name: 'デフォルト', worldPrompt: DEFAULT_WORLD_PROMPT, adventurePrompt: DEFAULT_ADVENTURE_PROMPT }]);
        setCurrentPromptId(promptId);
      }

      if (parsed.activeTab) setActiveTab(parsed.activeTab);
      if (parsed.selectedModel) setSelectedModel(parsed.selectedModel);
    } catch (e) {
      console.error("Failed to load save data:", e);
    }
    setIsLoaded(true);
  }, []);

  // Auto-save current state into the active save slot
  useEffect(() => {
    if (!isLoaded || !currentSlotId) return;
    setSaveSlots(prev => prev.map(slot =>
      slot.id === currentSlotId
        ? { ...slot, worldMessages, adventureMessages, confirmedWorldSetting, storySummary, characters, lastUpdated: Date.now() }
        : slot
    ));
  }, [worldMessages, adventureMessages, confirmedWorldSetting, storySummary, characters]);

  // Global auto-save to localStorage
  useEffect(() => {
    if (!isLoaded) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      protagonists, currentProtagonistId,
      saveSlots, currentSlotId,
      activeTab, selectedModel,
      promptPresets, currentPromptId,
    }));
  }, [protagonists, currentProtagonistId, saveSlots, currentSlotId, activeTab, selectedModel, isLoaded, promptPresets, currentPromptId]);

  // APIキーをlocalStorageから読み込む（なければモーダルを表示）
  useEffect(() => {
    const stored = localStorage.getItem(GEMINI_API_KEY_STORAGE) || '';
    setGeminiApiKey(stored);
    if (!stored) setShowApiKeyModal(true);
  }, []);

  const handleApiKeySave = (key: string) => {
    localStorage.setItem(GEMINI_API_KEY_STORAGE, key);
    setGeminiApiKey(key);
    setShowApiKeyModal(false);
    setIsApiKeyUpdate(false);
  };

  // fetchリクエストに共通ヘッダーを付与するヘルパー
  const apiHeaders = () => ({
    'Content-Type': 'application/json',
    ...(geminiApiKey ? { 'x-gemini-api-key': geminiApiKey } : {}),
  });

  // Backend health check and model list
  useEffect(() => {
    const initBackend = async () => {
      try {
        const healthRes = await fetch('/api/health');
        const healthData = await healthRes.json();
        setBackendStatus({ ok: healthData.status === 'ok', localConfigured: healthData.localConfigured });
        if (!selectedModel && healthData.defaultModel) setSelectedModel(healthData.defaultModel);

        const modelsRes = await fetch('/api/models');
        const modelsData = await modelsRes.json();
        setAvailableModels(modelsData.models || []);
      } catch {
        setBackendStatus({ ok: false, localConfigured: false });
      }
    };
    initBackend();
  }, []);

  // Scroll to latest message
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [worldMessages, adventureMessages]);

  // --- World management ---
  const createNewWorld = () => {
    const newId = Date.now().toString();
    const newSlot: SaveSlot = { id: newId, name: `新しい世界 ${saveSlots.length + 1}`, worldMessages: [], adventureMessages: [], confirmedWorldSetting: '', storySummary: '', characters: [], lastUpdated: Date.now() };
    setSaveSlots(prev => [newSlot, ...prev]);
    setCurrentSlotId(newId);
    setWorldMessages([]);
    setAdventureMessages([]);
    setConfirmedWorldSetting('');
    setStorySummary('');
    setCharacters([]);
    setActiveTab('protagonist');
  };

  const switchWorld = (id: string, slots: SaveSlot[] = saveSlots) => {
    const slot = slots.find(s => s.id === id);
    if (slot) {
      setCurrentSlotId(id);
      setWorldMessages(slot.worldMessages);
      setAdventureMessages(slot.adventureMessages);
      setConfirmedWorldSetting(slot.confirmedWorldSetting);
      setStorySummary(slot.storySummary || '');
      setCharacters(slot.characters);
      setActiveTab(slot.confirmedWorldSetting ? 'story' : 'world');
    }
  };

  const deleteWorld = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setSaveSlots(prev => {
      const newSlots = prev.filter(s => s.id !== id);
      if (currentSlotId === id) {
        if (newSlots.length > 0) {
          const nextSlot = newSlots[0];
          setTimeout(() => {
            setCurrentSlotId(nextSlot.id);
            setWorldMessages(nextSlot.worldMessages);
            setAdventureMessages(nextSlot.adventureMessages);
            setConfirmedWorldSetting(nextSlot.confirmedWorldSetting);
            setStorySummary(nextSlot.storySummary || '');
            setCharacters(nextSlot.characters);
            setActiveTab(nextSlot.confirmedWorldSetting ? 'story' : 'world');
          }, 0);
        } else {
          setCurrentSlotId('');
          setWorldMessages([]);
          setAdventureMessages([]);
          setConfirmedWorldSetting('');
          setStorySummary('');
          setCharacters([]);
          setActiveTab('world');
        }
      }
      return newSlots;
    });
  };

  const resetAdventure = () => {
    setAdventureMessages([]);
    setCharacters([]);
  };

  const clearHistory = () => {
    setWorldMessages([]);
    setAdventureMessages([]);
    setConfirmedWorldSetting('');
    setCharacters([]);
    setSaveSlots([]);
    setCurrentSlotId('');
    const protoId = Date.now().toString();
    setProtagonists([{ id: protoId, name: 'あなた', nickname: 'あなた', age: '20代', gender: '男性', occupation: '学生', personality: '普通', fetishes: '特になし', features: '平凡' }]);
    setCurrentProtagonistId(protoId);
    localStorage.removeItem(STORAGE_KEY);
    setIsSidebarOpen(false);
    setActiveTab('protagonist');
    const slotId = (Date.now() + 1).toString();
    setSaveSlots([{ id: slotId, name: '新しい世界 1', worldMessages: [], adventureMessages: [], confirmedWorldSetting: '', characters: [], lastUpdated: Date.now() }]);
    setCurrentSlotId(slotId);
  };

  // --- Character management ---
  const parseStatus = (text: string) => {

    // ─────────────────────────────────────────────────────────────
    // 【新フォーマット】 --- で囲まれた | 区切りのステータスブロック
    // 7フィールド: 名前 | 呼び名:XX | 好感度:XX% | 外見:XX | 服装:XX | 状態:XX | 性別:XX
    // 6フィールド: 外見なしの旧7フィールド形式に後方互換
    // ─────────────────────────────────────────────────────────────
    const newFmtMatch = text.match(/---\s*?\n([\s\S]*?)\n\s*?---/);
    if (newFmtMatch) {
      const lines = newFmtMatch[1].trim().split('\n').filter(l => l.trim() !== '' && l.includes('|'));
      const parsed: Character[] = lines.map(line => {
        const parts = line.split('|').map(s => s.trim());
        if (parts.length >= 7) {
          // 新7フィールド形式: 名前 | 呼び名 | 好感度 | 外見 | 服装 | 状態 | 性別
          return {
            name: parts[0],
            nicknameForProtagonist: parts[1]?.split(':')[1]?.trim() || currentProtagonist.nickname,
            affection: parseInt(parts[2]?.match(/\d+/)?.[0] || '0', 10),
            appearance: parts[3]?.split(':')[1]?.trim() || characters.find(c => c.name === parts[0])?.appearance || '未設定',
            outfit: parts[4]?.split(':')[1]?.trim() || '不明',
            condition: parts[5]?.split(':')[1]?.trim() || '不明',
            gender: parts[6]?.split(':')[1]?.trim() || '女性',
          };
        }
        if (parts.length === 6) {
          // 旧6フィールド形式（外見なし）: 名前 | 呼び名 | 好感度 | 服装 | 状態 | 性別
          return {
            name: parts[0],
            nicknameForProtagonist: parts[1]?.split(':')[1]?.trim() || currentProtagonist.nickname,
            affection: parseInt(parts[2]?.match(/\d+/)?.[0] || '0', 10),
            appearance: characters.find(c => c.name === parts[0])?.appearance || '未設定',
            outfit: parts[3]?.split(':')[1]?.trim() || '不明',
            condition: parts[4]?.split(':')[1]?.trim() || '不明',
            gender: parts[5]?.split(':')[1]?.trim() || '女性',
          };
        }
        return null;
      }).filter((c): c is Character =>
        c !== null &&
        c.name !== currentProtagonist.name &&
        !c.name.includes('主人公') &&
        !c.name.includes(currentProtagonist.name)
      );
      if (parsed.length > 0) {
        const filtered = parsed.filter(c => !removedCharacters.includes(c.name));
        if (filtered.length > 0) {
          setCharacters(prev => {
            const next = [...prev];
            filtered.forEach(newC => {
              const idx = next.findIndex(oldC => oldC.name === newC.name);
              if (idx >= 0) next[idx] = newC;
              else next.push(newC);
            });
            return next;
          });
          return;
        }
      }
    }

    // ─────────────────────────────────────────────────────────────
    // 【旧フォーマット（後方互換）】 【名前/好感度：XX/服装:XX/状態:XX】 形式
    // 旧プリセット保存時のプロンプトが使われた場合に対応するフォールバック
    // ─────────────────────────────────────────────────────────────
    const oldFmtMatches = [...text.matchAll(/【([^/【】]+)\/好感度[：:]\s*([^/]+)\/服装[：:]\s*([^/]+)\/状態[：:]\s*([^】]+)】/g)];
    if (oldFmtMatches.length > 0) {
      const parsed: Character[] = oldFmtMatches.map(m => ({
        name: m[1].trim(),
        nicknameForProtagonist: currentProtagonist.nickname,
        affection: parseInt(m[2]?.match(/\d+/)?.[0] || '0', 10),
        outfit: m[3]?.trim() || '不明',
        condition: m[4]?.trim() || '不明',
        appearance: characters.find(c => c.name === m[1].trim())?.appearance || '未設定',
        gender: '女性', // 旧形式に性別フィールドはないためデフォルト値
      })).filter(c =>
        c.name !== currentProtagonist.name &&
        !c.name.includes('主人公') &&
        !c.name.includes(currentProtagonist.name)
      );
      if (parsed.length > 0) {
        const filtered = parsed.filter(c => !removedCharacters.includes(c.name));
        if (filtered.length > 0) {
          setCharacters(prev => {
            const next = [...prev];
            filtered.forEach(newC => {
              const idx = next.findIndex(oldC => oldC.name === newC.name);
              if (idx >= 0) next[idx] = newC;
              else next.push(newC);
            });
            return next;
          });
        }
      }
    }
  };

  const handleIconGenerated = (name: string, url: string) => {
    setCharacters(prev => prev.map(c => c.name === name ? { ...c, iconUrl: url } : c));
  };

  const removeCharacter = (name: string) => {
    setCharacters(prev => prev.filter(c => c.name !== name));
    setRemovedCharacters(prev => [...prev, name]);
  };

  // --- Chat ---
  const handleSendMessage = async (mode: 'dialogue' | 'situation' = 'dialogue', overrideText?: string) => {
    const messageText = overrideText || input;
    if (!messageText.trim() || isTyping) return;
    if (!currentSlotId) createNewWorld();

    // Special command: image generation
    if (messageText.includes('【画像化】')) {
      const lastModelMessage = [...adventureMessages].reverse().find(m => m.role === 'model' && !m.imageUrl);
      if (!lastModelMessage) {
        setAdventureMessages(prev => [...prev, { role: 'model', text: '⚠️ 画像化する対象の物語が見つかりません。' }]);
        setInput('');
        return;
      }
      setAdventureMessages(prev => [...prev, { role: 'user', text: '【画像化】' }]);
      setInput('');
      setIsTyping(true);
      try {
        const res = await fetch('/api/generate-image', {
          method: 'POST',
          headers: apiHeaders(),
          body: JSON.stringify({
            context: lastModelMessage.text,
            model: selectedModel,
            characters: characters
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        setAdventureMessages(prev => [...prev, { role: 'model', text: '描写を画像化しました。', imageUrl: data.imageUrl }]);
      } catch (e: any) {
        setAdventureMessages(prev => [...prev, { role: 'model', text: `⚠️ 画像生成エラー: ${e.message}` }]);
      } finally {
        setIsTyping(false);
      }
      return;
    }

    const isWorldTab = activeTab === 'world';
    const userMessage: Message = { role: 'user', text: messageText };
    const setMessages = isWorldTab ? setWorldMessages : setAdventureMessages;
    const currentMessages = isWorldTab ? worldMessages : adventureMessages;

    setMessages(prev => [...prev, userMessage]);
    if (!overrideText) setInput('');
    setIsTyping(true);

    try {
      const worldSetting = confirmedWorldSetting || worldMessages.map(m => `${m.role === 'user' ? 'ユーザー' : '設定'}: ${m.text}`).join('\n');
      const instruction = isWorldTab
        ? (currentPrompt?.worldPrompt || DEFAULT_WORLD_PROMPT)
        : buildAdventurePrompt(worldSetting, currentProtagonist, characters.length > 0);

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: apiHeaders(),
        body: JSON.stringify({
          model: selectedModel,
          // ─────────────────────────────────────────────────────────────
          // 【バグ修正】ユーザーメッセージに「役割ラベル」を付加する
          //
          // 問題：LLMはロールプレイ学習で「userメッセージ＝補完すべき文章」と
          //       誤解しやすい。例：「今から街に行く」→ AIが「ことにした。〜」と続ける
          //
          // 解決：ユーザーの入力に「【プレイヤーの行動】」ラベルを付けて送信する。
          //       これによりLLMが「これは返答すべき入力である」と正しく認識する。
          //       ※AIの返答はそのまま保存するため画面表示には影響しない。
          // ─────────────────────────────────────────────────────────────
          messages: [...currentMessages, userMessage].map(m => {
            if (m.role === 'user') {
              // 冒険モードのみラベルを付加する（世界設定モードは自然な会話なのでそのまま）
              const labeledContent = !isWorldTab
                ? `【プレイヤーの行動・発言】\n${m.text}`
                : m.text;
              return { role: 'user', content: labeledContent };
            }
            return { role: 'assistant', content: m.text };
          }),
          systemInstruction: instruction,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || `サーバーエラー (${response.status})`);
      }

      setMessages(prev => [...prev, { role: 'model', text: '' }]);
      let currentText = '';

      if (response.body) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || ""; // 最後の不完全な行をバッファに残す

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith('data: ')) continue;

            const dataStr = trimmed.replace('data: ', '').trim();
            if (dataStr === '[DONE]') break;

            try {
              const parsed = JSON.parse(dataStr);
              if (parsed.text) {
                currentText += parsed.text;

                // 思考プロセスや不完全なステータスブロックを描画から除外する（ストリーミング中のチラつき防止）
                const displayText = currentText
                  .replace(/<think>[\s\S]*?(?:<\/think>|$)/g, '') // 思考中や不完全なthinkタグを消す
                  .replace(/---\s*?\n[\s\S]*?(?:---|\\Z|$)/g, '') // 不完全な --- ステータスブロックを消す
                  .replace(/【[^/【】]+\/好感度[\s\S]*?(?:】|\\Z|$)/g, '') // 旧形式のステータスブロックを消す
                  .trim();

                setMessages(prev => {
                  const newMsgs = [...prev];
                  newMsgs[newMsgs.length - 1] = { role: 'model', text: displayText };
                  return newMsgs;
                });
              }
            } catch (e) {
              // ignore parse errors for partial chunks (should be less frequent now with buffer)
            }
          }
        }
      }

      // 最終テキストからステータス情報をパースしてキャラ情報を更新（差分マージ実行）
      const cleanedText = currentText.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
      parseStatus(cleanedText);

      // 保存用に最終的な表示用テキストを確定
      const finalDisplayText = cleanedText
        .replace(/---\s*?\n[\s\S]*?---/g, '')
        .replace(/【[^/【】]+\/好感度[：:]\s*[^/]+\/服装[：:]\s*[^/]+\/状態[：:]\s*[^】]+】/g, '')
        .trim();

      setMessages(prev => {
        const newMsgs = [...prev];
        newMsgs[newMsgs.length - 1] = { role: 'model', text: finalDisplayText || '返答がありませんでした。' };
        return newMsgs;
      });

      setRemovedCharacters([]);

      // ─────────────────────────────────────────────────────────────
      // 長期記憶システム：冒険メッセージが10回（20要素）増えるごとに要約を実行
      // ─────────────────────────────────────────────────────────────
      if (!isWorldTab && adventureMessages.length > 0 && adventureMessages.length % 20 === 0) {
        generateStorySummary();
      }

    } catch (error: any) {
      console.error("Chat Error:", error);
      setMessages(prev => [...prev, { role: 'model', text: `⚠️ エラー: ${error.message}` }]);
    } finally {
      setIsTyping(false);
    }
  };

  // --- 過去のあらすじ要約生成（長期記憶） ---
  const generateStorySummary = async () => {
    try {
      console.log('--- [長期記憶] バックグラウンド要約処理の開始 ---');
      const memoryPrompt = DEFAULT_STORY_SUMMARY_PROMPT;
      // 会話履歴と既存のあらすじを合成
      const historyStr = adventureMessages.slice(-20).map(m => `${m.role === 'user' ? 'ユーザー' : 'AI'}: ${m.text}`).join('\n');
      const messagesStr = storySummary
        ? `【これまでのあらすじ】\n${storySummary}\n\n【新しい会話履歴（続き）】\n${historyStr}`
        : `【新しい会話履歴】\n${historyStr}`;

      const response = await fetch('/api/summarize', {
        method: 'POST',
        headers: apiHeaders(),
        body: JSON.stringify({
          model: selectedModel,
          messages: messagesStr,
          systemInstruction: memoryPrompt,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const newSummary = data.text;
        if (newSummary) {
          console.log('[長期記憶] 要約更新成功:', newSummary);
          setStorySummary(newSummary);
        }
      }
    } catch (error) {
      console.error('[長期記憶] 要約の生成に失敗:', error);
    }
  };

  const handleConfirmWorldSetting = async () => {
    if (worldMessages.length === 0 || isTyping) return;
    setIsTyping(true);
    try {
      const messagesStr = worldMessages.map(m => `${m.role === 'user' ? 'ユーザー' : 'AI'}: ${m.text}`).join('\n');

      // 新規作成した /api/summarize エンドポイントに履歴を送り要約を作成
      const response = await fetch('/api/summarize', {
        method: 'POST',
        headers: apiHeaders(),
        body: JSON.stringify({
          model: selectedModel,
          messages: messagesStr,
          systemInstruction: DEFAULT_WORLD_SUMMARY_PROMPT,
        }),
      });

      if (!response.ok) throw new Error('要約の生成に失敗しました');
      const data = await response.json();
      const worldSettingSummary = data.text || worldMessages.filter(m => m.role === 'user').map(m => m.text).join('\n');

      setConfirmedWorldSetting(worldSettingSummary);
      setActiveTab('story');
      // UI上に要約完了のメッセージを表示
      setWorldMessages(prev => [...prev, { role: 'model', text: '【世界設定を以下の内容で確定し、物語のフェーズへ移行しました】\n' + worldSettingSummary }]);
    } catch (error: any) {
      console.error('Confirm Error:', error);
      // エラー時は旧仕様（ユーザーの発言だけを結合）でフォールバックする
      const fallbackSetting = worldMessages.filter(m => m.role === 'user').map(m => m.text).join('\n');
      setConfirmedWorldSetting(fallbackSetting);
      setActiveTab('story');
    } finally {
      setIsTyping(false);
    }
  };

  // --- Protagonist management ---
  const createNewProtagonist = () => {
    const newId = Date.now().toString();
    setProtagonists(prev => [...prev, { id: newId, name: '新しい主人公', nickname: 'あなた', age: '20代', gender: '男性', occupation: '学生', personality: '普通', fetishes: '特になし', features: '平凡' }]);
    setCurrentProtagonistId(newId);
  };

  const deleteProtagonist = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (protagonists.length <= 1) return;
    const newProtos = protagonists.filter(p => p.id !== id);
    setProtagonists(newProtos);
    if (currentProtagonistId === id) setCurrentProtagonistId(newProtos[0].id);
  };

  const updateCurrentProtagonist = (updates: Partial<ProtagonistSettings>) => {
    setProtagonists(prev => prev.map(p => p.id === currentProtagonistId ? { ...p, ...updates } : p));
  };

  const saveSettings = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      protagonists, currentProtagonistId,
      saveSlots, currentSlotId,
      activeTab, selectedModel,
      promptPresets, currentPromptId,
    }));
  };

  // --- Prompt preset management ---
  const createNewPromptPreset = () => {
    const newId = Date.now().toString();
    setPromptPresets(prev => [...prev, { id: newId, name: `新しいプリセット ${promptPresets.length + 1}`, worldPrompt: DEFAULT_WORLD_PROMPT, adventurePrompt: DEFAULT_ADVENTURE_PROMPT }]);
    setCurrentPromptId(newId);
  };

  const deletePromptPreset = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (promptPresets.length <= 1) return;
    const newPresets = promptPresets.filter(p => p.id !== id);
    setPromptPresets(newPresets);
    if (currentPromptId === id) setCurrentPromptId(newPresets[0].id);
  };

  const updateCurrentPrompt = (updates: Partial<PromptSettings>) => {
    setPromptPresets(prev => prev.map(p => p.id === currentPromptId ? { ...p, ...updates } : p));
  };

  // --- Render ---
  return (
    <div className="flex h-screen bg-[#050505] text-stone-200 font-sans overflow-hidden selection:bg-rose-900 selection:text-white relative">
      <ApiKeyModal
        isOpen={showApiKeyModal}
        onSave={handleApiKeySave}
        isUpdate={isApiKeyUpdate}
      />
      {/* Background decorative blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-amber-900/10 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-rose-900/10 blur-[120px] rounded-full" />
      </div>

      <Sidebar
        activeTab={activeTab} setActiveTab={setActiveTab}
        isSidebarOpen={isSidebarOpen} setIsSidebarOpen={setIsSidebarOpen}
        selectedModel={selectedModel} setSelectedModel={setSelectedModel}
        availableModels={availableModels}
        currentProtagonist={currentProtagonist}
        saveSlots={saveSlots} currentSlotId={currentSlotId}
        switchWorld={switchWorld} createNewWorld={createNewWorld} deleteWorld={deleteWorld}
        resetAdventure={resetAdventure} clearHistory={clearHistory}
      />

      <main className="flex-1 flex flex-col relative max-w-5xl mx-auto w-full border-x border-stone-900">
        {/* Header */}
        <header className="px-6 py-3 flex items-center justify-between bg-[#0A0A0A]/80 backdrop-blur-md sticky top-0 z-30 border-b border-stone-900">
          <div className="flex items-center gap-4">
            <button onClick={() => setIsSidebarOpen(true)} className="p-2 hover:bg-stone-900 rounded-full text-stone-400 lg:hidden">
              <Menu size={20} />
            </button>
            <div className="text-sm font-bold text-stone-400 uppercase tracking-widest">
              {activeTab === 'protagonist' ? '主人公設定' : activeTab === 'world' ? '世界設定' : activeTab === 'story' ? '物語' : 'プロンプト設定'}
            </div>
          </div>
          <button
            onClick={() => { setIsApiKeyUpdate(true); setShowApiKeyModal(true); }}
            title="APIキーを変更"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-stone-800 text-stone-500 hover:border-amber-600/40 hover:text-amber-400 transition-all text-[10px] font-bold uppercase tracking-widest"
          >
            <Key size={11} />
            API Key
          </button>
        </header>

        <CharacterStatus characters={characters} removeCharacter={removeCharacter} onIconGenerated={handleIconGenerated} selectedModel={selectedModel} />

        {/* Backend status banner */}
        {backendStatus && !backendStatus.ok && (
          <div className="px-6 py-2 text-xs font-medium text-center bg-red-950/50 text-red-400">
            ⚠️ サーバーに接続できません。再起動をお試しください。
          </div>
        )}

        {/* Content area */}
        <div className="flex-1 overflow-y-auto px-6 py-8 custom-scrollbar">
          <AnimatePresence mode="wait">
            {activeTab === 'prompt' && (
              <motion.div key="prompt" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <PromptTab
                  promptPresets={promptPresets} currentPromptId={currentPromptId} setCurrentPromptId={setCurrentPromptId}
                  currentPrompt={currentPrompt} createNewPromptPreset={createNewPromptPreset}
                  deletePromptPreset={deletePromptPreset} updateCurrentPrompt={updateCurrentPrompt}
                />
              </motion.div>
            )}
            {activeTab === 'protagonist' && (
              <motion.div key="protagonist" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <ProtagonistTab
                  protagonists={protagonists} currentProtagonistId={currentProtagonistId} setCurrentProtagonistId={setCurrentProtagonistId}
                  currentProtagonist={currentProtagonist} createNewProtagonist={createNewProtagonist}
                  deleteProtagonist={deleteProtagonist} updateCurrentProtagonist={updateCurrentProtagonist}
                  saveSettings={saveSettings} setActiveTab={setActiveTab}
                />
              </motion.div>
            )}
            {(activeTab === 'world' || activeTab === 'story') && (
              <motion.div key={activeTab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                <ChatView
                  activeTab={activeTab}
                  messages={activeTab === 'world' ? worldMessages : adventureMessages}
                  isTyping={isTyping} chatEndRef={chatEndRef} setInput={setInput}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <InputArea
          activeTab={activeTab} input={input} setInput={setInput} isTyping={isTyping}
          worldMessages={worldMessages} handleSendMessage={handleSendMessage}
          handleConfirmWorldSetting={handleConfirmWorldSetting}
        />
      </main>
    </div>
  );
}
