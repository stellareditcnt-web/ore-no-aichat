export interface Message {
  role: 'user' | 'model';
  text: string;
  imageUrl?: string;
}

export interface Character {
  name: string;
  nicknameForProtagonist: string;
  affection: number;
  outfit: string;
  condition: string;
  appearance: string;
  gender: string;
  iconUrl?: string;
}

export interface ProtagonistSettings {
  id: string;
  name: string;
  nickname: string;
  age: string;
  gender: string;
  occupation: string;
  personality: string;
  fetishes: string;
  features: string;
}

export interface SaveSlot {
  id: string;
  name: string;
  worldMessages: Message[];
  adventureMessages: Message[];
  confirmedWorldSetting: string;
  characters: Character[];
  lastUpdated: number;
  storySummary?: string;
}

export interface PromptSettings {
  id: string;
  name: string;
  worldPrompt: string;
  adventurePrompt: string;
}

export type ActiveTab = 'world' | 'story' | 'protagonist' | 'prompt';
