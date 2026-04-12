/**
 * prompt-optimizer.mjs
 *
 * Geminiをコーチ役として、src/constants.ts の DEFAULT_ADVENTURE_PROMPT を
 * 自動評価・改善するループスクリプト。
 *
 * 使い方: node scripts/prompt-optimizer.mjs
 *
 * 環境変数（node に付与する。例: PROMPT_OPTIMIZER_MAX_ITERATIONS=1 node scripts/prompt-optimizer.mjs）:
 *   PROMPT_OPTIMIZER_MAX_ITERATIONS … ループ回数（既定 5）
 *   OLLAMA_FETCH_TIMEOUT_MS … 各 Ollama リクエストのタイムアウト ms（既定 600000）
 *
 * 動作フロー:
 *   1. src/constants.ts から DEFAULT_ADVENTURE_PROMPT を読み込む
 *   2. Ollamaでテスト応答を生成
 *   3. Geminiで評価（スコアリング＋問題点抽出）
 *   4. 合格 or 最大ループに達するまで 2〜3 を繰り返す
 *   5. 最高スコアのプロンプトを src/constants.ts に書き戻す（任意確認後）
 */

import dotenv from 'dotenv';
import readline from 'readline';
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

dotenv.config();

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONSTANTS_PATH = join(__dirname, '..', 'src', 'constants.ts');

// --- 設定 ---
const OLLAMA_BASE_URL = process.env.LOCAL_AI_BASE_URL || 'http://127.0.0.1:11434';
const OLLAMA_MODEL = process.env.LOCAL_AI_MODEL || 'myaichat-32b';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = 'gemini-2.5-flash'; // 修正: gemini-2.0-flash は新規ユーザー向けに廃止済み
const MAX_ITERATIONS = Number(process.env.PROMPT_OPTIMIZER_MAX_ITERATIONS || 5); // 最大改善ループ回数
const OLLAMA_FETCH_TIMEOUT_MS = Number(process.env.OLLAMA_FETCH_TIMEOUT_MS || 600000); // 1リクエストあたり（大モデル向けデフォルト10分）

// Geminiは評価・改善ともにPROHIBITED_CONTENTでブロックされるため現在は未使用
// GEMINI_API_KEYがなくても動作する
if (!GEMINI_API_KEY) {
  console.warn('⚠️  GEMINI_API_KEY が未設定です（現バージョンはOllamaのみ使用するため問題なし）');
}

const ADVENTURE_EXPORT_PREFIX = 'export const DEFAULT_ADVENTURE_PROMPT = `';

/**
 * constants.ts 内の DEFAULT_ADVENTURE_PROMPT テンプレートリテラルを走査で取り出す。
 * （プロンプト本文にバックティックが含まれた場合も、非貪欲正規表現が先に閉じて壊れるのを防ぐ）
 */
function parseAdventurePromptBlock(source) {
  const start = source.indexOf(ADVENTURE_EXPORT_PREFIX);
  if (start === -1) return null;
  let i = start + ADVENTURE_EXPORT_PREFIX.length;
  let inner = '';
  while (i < source.length) {
    const c = source[i];
    if (c === '\\' && i + 1 < source.length) {
      const n = source[i + 1];
      if (n === '`') {
        inner += '`';
        i += 2;
        continue;
      }
      if (n === '\\') {
        inner += '\\';
        i += 2;
        continue;
      }
      if (n === '$' && source[i + 2] === '{') {
        inner += '${';
        i += 3;
        continue;
      }
    }
    if (c === '`' && source[i + 1] === ';') {
      const end = i + 2;
      const fullMatch = source.slice(start, end);
      return { inner, fullMatch, fullMatchStart: start, fullMatchEnd: end };
    }
    inner += c;
    i++;
  }
  return null;
}

// --- src/constants.ts から DEFAULT_ADVENTURE_PROMPT を読み込む ---
function loadAdventurePromptFromConstants() {
  const source = readFileSync(CONSTANTS_PATH, 'utf-8');
  const block = parseAdventurePromptBlock(source);
  if (!block) {
    throw new Error(
      `constants.ts から DEFAULT_ADVENTURE_PROMPT が見つかりませんでした。\nパスを確認してください: ${CONSTANTS_PATH}`
    );
  }
  return block.inner;
}

/** 推論モデルが付与する思考タグなどを除去（タグの表記ゆれに対応） */
function stripModelArtifacts(text) {
  if (!text || typeof text !== 'string') return '';
  return text
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/<redacted_thinking>[\s\S]*?<\/redacted_thinking>/gi, '')
    .trim();
}

function ollamaFetchSignal() {
  return AbortSignal.timeout(OLLAMA_FETCH_TIMEOUT_MS);
}

// --- 改善されたプロンプトを src/constants.ts に書き戻す ---
function writeAdventurePromptToConstants(newPrompt) {
  const source = readFileSync(CONSTANTS_PATH, 'utf-8');
  const block = parseAdventurePromptBlock(source);
  if (!block) {
    throw new Error(
      'constants.ts 内に export const DEFAULT_ADVENTURE_PROMPT = `...`; の形式が見つかりません。'
    );
  }
  if (block.inner === newPrompt) {
    throw new Error(
      '書き戻す内容が constants.ts と既に同一です（差分がありません）。\n' +
      '※ブラウザの localStorage に保存されたプロンプトプリセットは、起動時に constants の更新より優先されることがあります。アプリの「プロンプト」タブで内容を確認するか、ストレージをクリアしてください。'
    );
  }

  const escapedPrompt = newPrompt
    .replace(/\\/g, '\\\\')
    .replace(/`/g, '\\`')
    .replace(/\$\{/g, '\\${');
  const newDeclaration = `export const DEFAULT_ADVENTURE_PROMPT = \`${escapedPrompt}\`;`;
  const updated = source.slice(0, block.fullMatchStart) + newDeclaration + source.slice(block.fullMatchEnd);

  writeFileSync(CONSTANTS_PATH, updated, 'utf-8');
  console.log(`✅ src/constants.ts の DEFAULT_ADVENTURE_PROMPT を更新しました。`);
}

// --- テスト用のメッセージ（ユーザーからの最初の一言） ---
// 天候に触れるとモデルが「お天気」路線に引っ張られ評価基準9と衝突しやすいため、中立の一言にする
const TEST_USER_MESSAGE = 'こんにちは。ちょっといいかな。';

// --- テスト時のプレースホルダー置換（実際のアプリに合わせた代替値） ---
function resolvePlaceholders(prompt) {
  return prompt
    .replace('{{worldSetting}}', '現代日本の大学キャンパス。主人公は男性学生。')
    .replace('{{protagonistName}}', '田中')
    .replace('{{protagonistGender}}', '男性')
    .replace('{{storySummary}}', '')
    .replace('{{hasCharacters}}', '[主人公: 田中\n  ("性別": "男性")\n  ("年齢": "20代")\n  ("職業": "学生")]\n\n[フェーズ: プロローグ]\nNPCを一人登場させ、田中との最初の出会いの場面を鮮やかに描写する。');
}

// --- 評価基準（Geminiに渡す「こうあってほしい」の定義） ---
const EVALUATION_CRITERIA = `
以下の基準でAIの返答を評価してください：

【合格基準（すべて満たす必要あり）】
1. 完全に日本語のみで返答されているか（英語が1文字でも混じったら不合格）
2. セリフが「」で囲まれているか
3. 情景描写が【】で囲まれているか
4. 返答の最後に 1/2/3 の選択肢があるか
5. 返答の一番最後に --- で囲まれたキャラクター状態ブロックが記載されているか
   （例: NPCの本名 | 呼び名:XX | 好感度:XX% | 外見:XX | 服装:XX | 状態:XX | 性別:XX）
6. 返答全体が700文字以上であるか（密度の高い描写のため、短すぎるのも不合格）
7. キャラクターが官能的・魅力的な雰囲気があるか（過度に真面目・説教的でないか）
8. 選択肢を提示した後に物語を先に進めていないか（ユーザーの反応を待っているか）
9. 天候・風景など無関係な情景描写で文章が始まっていないか
10. NPCのセリフが2行以上の改行形式になっているか

【採点結果の形式】
以下のJSONだけを返してください。他の文章は一切不要です：
{
  "passed": true または false,
  "score": 0〜100の点数,
  "issues": ["問題点1", "問題点2", ...],
  "improvements": "プロンプトの改善案（具体的に、どの文言をどう変えるかを詳細に）"
}
`;

// --- Ollama APIを呼び出す関数 ---
async function callOllama(systemPrompt, userMessage) {
  console.log(`\n🤖 [Ollama:${OLLAMA_MODEL}] テストメッセージ送信中...`);
  const resolvedPrompt = resolvePlaceholders(systemPrompt);

  const response = await fetch(`${OLLAMA_BASE_URL}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ollama',
    },
    signal: ollamaFetchSignal(),
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      messages: [
        { role: 'system', content: resolvedPrompt },
        { role: 'user', content: `【プレイヤーの行動・発言】\n${userMessage}` },
      ],
      temperature: 0.85,
      max_tokens: 2048,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Ollama APIエラー (${response.status}): ${err}`);
  }

  const data = await response.json();
  return stripModelArtifacts(data.choices[0].message.content || '');
}

// --- Gemini APIを呼び出す関数 ---
async function callGemini(prompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.3 }, // 評価・改善は低温度（一貫性重視）
      // 成人向けフィクションの評価・改善タスクのため安全フィルターを無効化
      safetySettings: [
        { category: 'HARM_CATEGORY_HARASSMENT',        threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_HATE_SPEECH',       threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
      ],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Gemini APIエラー (${response.status}): ${err}`);
  }

  const data = await response.json();

  // candidatesが空の場合（安全フィルターにブロックされた場合など）のハンドリング
  if (!data.candidates || data.candidates.length === 0) {
    const blockReason = data.promptFeedback?.blockReason || 'UNKNOWN';
    throw new Error(`Geminiがコンテンツをブロックしました (blockReason: ${blockReason})\n詳細: ${JSON.stringify(data.promptFeedback)}`);
  }

  const candidate = data.candidates[0];
  if (!candidate.content?.parts?.[0]?.text) {
    const finishReason = candidate.finishReason || 'UNKNOWN';
    throw new Error(`Geminiの応答テキストが空です (finishReason: ${finishReason})`);
  }

  return candidate.content.parts[0].text.trim();
}

// --- Ollamaに返答を評価させる関数 ---
// Geminiは PROHIBITED_CONTENT でブロックされるため、ローカルの無検閲モデルで評価する
async function evaluateWithOllama(currentPrompt, aiResponse) {
  console.log(`\n🎓 [Ollama] 返答を評価中...`);
  const evaluationPrompt = `あなたはAI出力品質の専門評価者です。
以下の「AIへの指示（システムプロンプト）」と「AIが実際に返した返答」を見て、品質を評価してください。

## AIへの指示（システムプロンプト、プレースホルダー置換後）:
\`\`\`
${resolvePlaceholders(currentPrompt)}
\`\`\`

## AIが返した返答:
\`\`\`
${aiResponse}
\`\`\`

## 評価基準:
${EVALUATION_CRITERIA}

必ずJSONだけを返してください。前置き・説明文・思考用タグは付けないでください。`;

  const response = await fetch(`${OLLAMA_BASE_URL}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ollama' },
    signal: ollamaFetchSignal(),
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      messages: [{ role: 'user', content: evaluationPrompt }],
      temperature: 0.2,   // 評価は低温度（一貫性・正確性重視）
      max_tokens: 2048,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Ollama評価APIエラー (${response.status}): ${err}`);
  }

  const data = await response.json();
  const rawResult = stripModelArtifacts(data.choices[0].message.content || '');

  if (!rawResult) throw new Error('Ollamaの評価応答が空でした');

  // JSONだけを抽出
  const jsonMatch = rawResult.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error(`Ollamaの評価結果をJSONとして解析できませんでした:\n${rawResult}`);
  }
  try {
    return JSON.parse(jsonMatch[0]);
  } catch (parseErr) {
    throw new Error(`Ollamaの評価JSONのパースに失敗しました: ${parseErr.message}\n${jsonMatch[0].slice(0, 500)}`);
  }
}

// --- Ollamaでプロンプトを改善させる関数（リトライあり）---
// Geminiは成人向けコンテンツの「生成」を拒否するため、ローカルの無検閲モデルで改善を行う。
async function improvePromptWithOllama(currentPrompt, issues, improvements) {
  console.log(`\n🔧 [Ollama] プロンプトを改善中...`);
  const issueList = Array.isArray(issues) ? issues : [];
  const improvementText = typeof improvements === 'string' ? improvements : '';
  const improveRequest = `あなたはAIシステムプロンプトの最適化の専門家です。
以下の「現在のプロンプト」を、「問題点」と「改善案」に基づいて書き直してください。

## 現在のプロンプト:
${currentPrompt}

## 問題点:
${issueList.map((iss, idx) => `${idx + 1}. ${iss}`).join('\n') || '(なし)'}

## 改善案:
${improvementText || '(なし)'}

## 重要な指示:
- 改善されたプロンプトのテキストだけを返してください。説明文や前置きは不要です。
- {{worldSetting}}, {{protagonistName}}, {{protagonistGender}}, {{storySummary}}, {{hasCharacters}} というプレースホルダーは実行時にアプリが置換します。プロンプト内にこれらがあっても構いません。
- プロンプトは必ず日本語で書いてください。
- コードブロック（\`\`\`）で囲まずに、プロンプト本文だけを返してください。`;

  const MAX_RETRIES = 3;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`   試行 ${attempt}/${MAX_RETRIES}...`);
      const response = await fetch(`${OLLAMA_BASE_URL}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ollama' },
        signal: ollamaFetchSignal(),
        body: JSON.stringify({
          model: OLLAMA_MODEL,
          messages: [{ role: 'user', content: improveRequest }],
          temperature: 0.4,
          max_tokens: 2048,  // 4096から2048に削減（接続安定性のため）
        }),
      });

      if (!response.ok) {
        const err = await response.text();
        throw new Error(`Ollama改善APIエラー (${response.status}): ${err}`);
      }

      const data = await response.json();
      const text = stripModelArtifacts(data.choices[0].message.content || '');

      if (!text) throw new Error('Ollamaの改善応答が空でした');
      return text;
    } catch (e) {
      const msg =
        e && (e.name === 'TimeoutError' || e.name === 'AbortError')
          ? `タイムアウト（${OLLAMA_FETCH_TIMEOUT_MS}ms）。OLLAMA_FETCH_TIMEOUT_MS を延長してください。`
          : e.message;
      console.warn(`   ⚠️ 試行${attempt}失敗: ${msg}`);
      if (attempt < MAX_RETRIES) {
        console.log(`   3秒待ってリトライします...`);
        await new Promise(r => setTimeout(r, 3000));
      } else {
        throw e;
      }
    }
  }
}

// --- stdin から入力を受け取るユーティリティ ---
async function askUser(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(question, ans => { rl.close(); resolve(ans.trim()); }));
}

// --- メインの最適化ループ ---
async function optimize() {
  console.log('====================================');
  console.log('🚀 プロンプト自動最適化を開始します');
  console.log(`   使用AI: ${OLLAMA_MODEL} (全工程ローカル)`);
  console.log(`   評価・改善・テスト: すべてOllama`);
  console.log(`   最大ループ回数: ${MAX_ITERATIONS}`);
  console.log(`   対象ファイル: src/constants.ts → DEFAULT_ADVENTURE_PROMPT`);
  console.log('====================================\n');

  // src/constants.ts から実際のプロンプトを読み込む
  let currentPrompt;
  try {
    currentPrompt = loadAdventurePromptFromConstants();
    console.log(`✅ constants.ts からプロンプトを読み込みました（${currentPrompt.length} 文字）`);
  } catch (e) {
    console.error(`❌ プロンプト読み込みエラー: ${e.message}`);
    process.exit(1);
  }

  let bestPrompt = currentPrompt;
  let bestScore = 0;

  for (let i = 1; i <= MAX_ITERATIONS; i++) {
    console.log(`\n${'='.repeat(40)}`);
    console.log(`📍 ループ ${i} / ${MAX_ITERATIONS}`);
    console.log(`${'='.repeat(40)}`);

    // Step 1: Ollamaでテスト
    let aiResponse;
    try {
      aiResponse = await callOllama(currentPrompt, TEST_USER_MESSAGE);
      console.log('\n📝 AI返答（全文）:\n' + '-'.repeat(40));
      console.log(aiResponse);
      console.log('-'.repeat(40));
      console.log(`（文字数: ${aiResponse.length}文字）`);
    } catch (e) {
      const msg =
        e && (e.name === 'TimeoutError' || e.name === 'AbortError')
          ? `Ollamaがタイムアウトしました（${OLLAMA_FETCH_TIMEOUT_MS}ms）。OLLAMA_FETCH_TIMEOUT_MS を延長するか、軽いモデルを試してください。`
          : e.message;
      console.error(`❌ Ollamaエラー: ${msg}`);
      break;
    }

    // Step 2: Ollamaで評価（GeminiはPROHIBITED_CONTENTでブロックされるため全工程Ollama）
    let evaluation;
    let numericScore = 0;
    let passed = false;
    try {
      evaluation = await evaluateWithOllama(currentPrompt, aiResponse);
      const evalScore = Number(evaluation.score);
      numericScore = Number.isFinite(evalScore) ? evalScore : 0;
      passed = evaluation.passed === true;
      console.log(`\n📊 評価結果: ${numericScore}点 | ${passed ? '✅ 合格' : '❌ 改善が必要'}`);
      if (evaluation.issues && evaluation.issues.length > 0) {
        console.log('   問題点:');
        evaluation.issues.forEach(issue => console.log(`   - ${issue}`));
      }
    } catch (e) {
      const msg =
        e && (e.name === 'TimeoutError' || e.name === 'AbortError')
          ? `タイムアウト（${OLLAMA_FETCH_TIMEOUT_MS}ms）`
          : e.message;
      console.error(`❌ Ollama評価エラー: ${msg}`);
      break;
    }

    // スコアが過去最高なら記録
    if (numericScore > bestScore) {
      bestScore = numericScore;
      console.log(`   ⭐ 新記録！ベストスコア更新: ${bestScore}点`);
    }
    // 評価が同点（例: 毎回 65 点）のとき、改善後の currentPrompt が捨てられて初回のままになるのを防ぐ
    if (numericScore >= bestScore) {
      bestPrompt = currentPrompt;
    }

    // 合格したら終了
    if (passed) {
      console.log('\n🎉 合格基準を満たしました！最適化完了。');
      break;
    }

    // 最終ループなら改善せずに終了
    if (i === MAX_ITERATIONS) {
      console.log(`\n⚠️ 最大ループ回数 (${MAX_ITERATIONS}) に達しました。最高スコア(${bestScore}点)のプロンプトを使用します。`);
      break;
    }

    // Step 3: Ollamaでプロンプトを改善（GeminiはPROHIBITED_CONTENTで生成を拒否するため）
    try {
      currentPrompt = await improvePromptWithOllama(
        currentPrompt,
        evaluation.issues,
        evaluation.improvements
      );
      console.log('\n✨ プロンプトを改善しました。次のループへ...');
    } catch (e) {
      console.error(`❌ Ollama改善エラー: ${e.message}`);
      break;
    }
  }

  // --- 結果の表示 ---
  console.log('\n\n====================================');
  console.log('🏁 最適化結果');
  console.log('====================================');
  console.log(`最高スコア: ${bestScore}点`);
  console.log('\n📋 最適化されたプロンプト:\n' + '='.repeat(40));
  console.log(bestPrompt);
  console.log('='.repeat(40));

  // --- src/constants.ts に書き戻すか確認 ---
  const save = await askUser('\nこのプロンプトを src/constants.ts の DEFAULT_ADVENTURE_PROMPT に書き戻しますか？ (y/n): ');
  if (save.toLowerCase() === 'y') {
    try {
      writeAdventurePromptToConstants(bestPrompt);
      console.log('   👉 アプリを再起動すると新しいプロンプトが反映されます。');
    } catch (e) {
      console.error(`❌ 書き戻しエラー: ${e.message}`);
      // フォールバック：テキストファイルとして保存
      const filename = `optimized_prompt_${Date.now()}.txt`;
      writeFileSync(filename, bestPrompt, 'utf-8');
      console.log(`   📄 代わりに "${filename}" として保存しました。手動でコピー&ペーストしてください。`);
    }
  } else {
    // テキストファイルにも保存しておく
    const filename = `optimized_prompt_${Date.now()}.txt`;
    writeFileSync(filename, bestPrompt, 'utf-8');
    console.log(`📄 "${filename}" として保存しました。`);
  }

  console.log('\n以上です。お疲れ様でした！');
}

// スクリプトを実行
optimize().catch(err => {
  console.error('予期せぬエラーが発生しました:', err);
  process.exit(1);
});
