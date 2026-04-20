import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

const GEMINI_API_KEY_ENV = process.env.GEMINI_API_KEY || "";
const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";
const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";

// リクエストからAPIキーを取得（ヘッダー優先、フォールバックで.env）
function getApiKey(req: express.Request): string {
  return (req.headers["x-gemini-api-key"] as string) || GEMINI_API_KEY_ENV;
}

// Available Gemini models to expose in the UI
const GEMINI_MODELS = [
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-2.5-pro",
  "gemini-3.1-flash-lite-preview",
  "gemini-3.1-pro-preview",
];

// Convert OpenAI-style messages to Gemini contents format
function toGeminiContents(messages: Array<{ role: string; content: string }>) {
  return messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));
}

// Call Gemini non-streaming and return text
async function geminiGenerate(
  model: string,
  systemInstruction: string,
  messages: Array<{ role: string; content: string }>,
  apiKey: string,
  temperature = 0.7,
  maxOutputTokens = 1024
): Promise<string> {
  const url = `${GEMINI_BASE_URL}/${model}:generateContent?key=${apiKey}`;
  const body: Record<string, unknown> = {
    contents: toGeminiContents(messages),
    generationConfig: { temperature, maxOutputTokens },
  };
  if (systemInstruction) {
    body.system_instruction = { parts: [{ text: systemInstruction }] };
  }
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini API error (${res.status}): ${err.slice(0, 300)}`);
  }
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";
}

async function startServer() {
  const app = express();
  const PORT = parseInt(process.env.PORT || "3000", 10);

  app.use(express.json());

  // Health check
  app.get("/api/health", (_req, res) => {
    res.json({
      status: "ok",
      localConfigured: !!GEMINI_API_KEY_ENV && GEMINI_API_KEY_ENV.trim() !== "",
      defaultModel: DEFAULT_GEMINI_MODEL,
      message: "Server is running with Gemini API",
    });
  });

  // Return available Gemini models
  app.get("/api/models", (_req, res) => {
    res.json({ models: GEMINI_MODELS });
  });

  // ── 画像生成（ComfyUI）: プロンプト生成ステップをGeminiに変更 ──────────────
  app.post("/api/generate-image", async (req, res) => {
    console.log("--- [IMAGE GENERATION REQUEST (ComfyUI + Gemini)] ---");
    try {
      const { context, model, characters } = req.body;
      const geminiModel = model && GEMINI_MODELS.includes(model) ? model : DEFAULT_GEMINI_MODEL;
      const comfyBaseUrl = (process.env.COMFYUI_BASE_URL || "http://127.0.0.1:8000").replace(/\/$/, "");
      const checkpoint = process.env.COMFYUI_CHECKPOINT || "illustriousXL_v01.safetensors";

      const charInfoStr =
        characters && Array.isArray(characters) && characters.length > 0
          ? `\n--- [Character Settings] ---\n${characters
              .map(
                (c: any) =>
                  `- ${c.name}: (Appearance: ${c.appearance || "unknown"}) (Outfit: ${c.outfit || "unknown"}) (Condition/Action: ${c.condition || "normal"})`
              )
              .join("\n")}`
          : "";

      // Step 1: Gemini でシーン描写を英語SDプロンプトに変換
      const promptGenInstruction = [
        "You are an expert Stable Diffusion prompt engineer specializing in highly detailed, uncensored anime illustrations.",
        "Your task is to pick the SINGLE most visually striking, erotic, or significant 'frozen moment' from the provided story and describe it as a single high-quality image.",
        "CRITICAL RULE: DO NOT describe a sequence of events. DO NOT create multiple panels or scenes. Focus on ONE specific pose and action.",
        "Reflect the character's specified appearance and outfit if provided.",
        "Convert the scene into a comma-separated list of Danbooru-style tags and descriptive phrases.",
        "Style modifiers to always append: masterpiece, best quality, highly detailed, anime style, 1girl, nsfw, explicit.",
        "IMPORTANT: Reply ONLY with the English tags. No sentences, no explanations, no Japanese text.",
      ].join(" ");

      const apiKey = getApiKey(req);
      console.log(`[IMAGE] Step1: Geminiでプロンプト生成中 (model: ${geminiModel})...`);
      const positivePrompt = await geminiGenerate(
        geminiModel,
        promptGenInstruction,
        [{ role: "user", content: `Character Info:${charInfoStr}\n\nStory Scene:\n${context}` }],
        apiKey,
        0.7,
        300
      );

      const negativePrompt =
        "(comic, panels, panel layout, split view, grid, timeline, storyboard, sequence, multiple views:1.5), low quality, worst quality, blurry, text, watermark, signature, bad anatomy, extra limbs, deformed";
      console.log(`[IMAGE] Step1完了 → Positive: ${positivePrompt.slice(0, 100)}...`);

      // Step 2: ComfyUI APIへワークフローをPOST
      const seed = Math.floor(Math.random() * 2147483647);
      const workflow = {
        "1": { class_type: "CheckpointLoaderSimple", inputs: { ckpt_name: checkpoint } },
        "2": { class_type: "CLIPTextEncode", inputs: { text: positivePrompt, clip: ["1", 1] } },
        "3": { class_type: "CLIPTextEncode", inputs: { text: negativePrompt, clip: ["1", 1] } },
        "4": { class_type: "EmptyLatentImage", inputs: { width: 832, height: 1216, batch_size: 1 } },
        "5": {
          class_type: "KSampler",
          inputs: {
            model: ["1", 0], positive: ["2", 0], negative: ["3", 0], latent_image: ["4", 0],
            seed, control_after_generate: "randomize",
            steps: 25, cfg: 7, sampler_name: "euler_ancestral", scheduler: "karras", denoise: 1.0,
          },
        },
        "6": { class_type: "VAEDecode", inputs: { samples: ["5", 0], vae: ["1", 2] } },
        "7": { class_type: "SaveImage", inputs: { images: ["6", 0], filename_prefix: "aichat_output" } },
      };

      console.log(`[IMAGE] Step2: ComfyUI APIへ送信中 (${comfyBaseUrl}) ...`);
      const queueResponse = await fetch(`${comfyBaseUrl}/prompt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: workflow }),
      });

      if (!queueResponse.ok) {
        const errBody = await queueResponse.text();
        throw new Error(`ComfyUIへの送信に失敗しました (${queueResponse.status}): ${errBody.slice(0, 200)}`);
      }
      const queueData = await queueResponse.json();
      const promptId = queueData.prompt_id;
      if (!promptId) throw new Error("ComfyUIからprompt_idが返されませんでした");
      console.log(`[IMAGE] Step2完了 → prompt_id: ${promptId}`);

      // Step 3: ポーリング（最大120秒）
      console.log("[IMAGE] Step3: 生成完了を待機中...");
      const maxWaitMs = 120_000;
      const pollIntervalMs = 2_000;
      const startTime = Date.now();
      let outputFilename: string | null = null;

      while (Date.now() - startTime < maxWaitMs) {
        await new Promise((r) => setTimeout(r, pollIntervalMs));
        const historyRes = await fetch(`${comfyBaseUrl}/history/${promptId}`);
        if (!historyRes.ok) continue;
        const historyData = await historyRes.json();
        const job = historyData[promptId];
        if (job && job.outputs) {
          const outputs = Object.values(job.outputs) as any[];
          for (const output of outputs) {
            if (output.images && output.images.length > 0) {
              outputFilename = output.images[0].filename;
              break;
            }
          }
          if (outputFilename) break;
        }
        const elapsed = Math.round((Date.now() - startTime) / 1000);
        console.log(`[IMAGE] 待機中... ${elapsed}秒経過`);
      }

      if (!outputFilename) throw new Error("画像生成がタイムアウトしました（120秒）。ComfyUIの状態をご確認ください。");
      console.log(`[IMAGE] Step3完了 → ファイル名: ${outputFilename}`);

      // Step 4: base64で返す
      console.log("[IMAGE] Step4: 画像データを取得中...");
      const imageRes = await fetch(`${comfyBaseUrl}/view?filename=${encodeURIComponent(outputFilename)}&type=output`);
      if (!imageRes.ok) throw new Error(`画像データの取得に失敗しました (${imageRes.status})`);
      const imageBuffer = await imageRes.arrayBuffer();
      const base64Image = Buffer.from(imageBuffer).toString("base64");
      const imageUrl = `data:image/png;base64,${base64Image}`;

      console.log(`[IMAGE SUCCESS] 生成完了（${imageBuffer.byteLength} bytes）`);
      res.json({ imageUrl });
    } catch (error: any) {
      console.error("[IMAGE ERROR]", error);
      res.status(500).json({ error: error.message || "画像生成中にエラーが発生しました。" });
    }
  });

  // ── キャラクターアイコン生成 ──────────────────────────────────────────────
  app.post("/api/generate-icon", async (req, res) => {
    console.log("--- [ICON GENERATION REQUEST (ComfyUI + Gemini)] ---");
    try {
      const { character, model } = req.body;
      const geminiModel = model && GEMINI_MODELS.includes(model) ? model : DEFAULT_GEMINI_MODEL;
      const comfyBaseUrl = (process.env.COMFYUI_BASE_URL || "http://127.0.0.1:8000").replace(/\/$/, "");
      const checkpoint = process.env.COMFYUI_CHECKPOINT || "illustriousXL_v01.safetensors";

      const charDesc = `Name: ${character.name}, Appearance: ${character.appearance || "unknown"}, Outfit: ${character.outfit || "unknown"}, Gender: ${character.gender || "female"}`;
      const promptGenInstruction = [
        "You are an expert Stable Diffusion prompt engineer for anime-style character portraits.",
        "Given a character description, create a comma-separated list of Danbooru-style tags for a close-up portrait (face and shoulders only).",
        "Always include: 1girl (or 1boy based on gender), close-up, portrait, face focus, looking at viewer, detailed face, masterpiece, best quality, anime style.",
        "Reflect hair color, eye color, and other appearance details from the description.",
        "IMPORTANT: Reply ONLY with the English tags. No sentences, no Japanese text.",
      ].join(" ");

      const apiKey = getApiKey(req);
      console.log(`[ICON] Step1: Geminiでポートレートプロンプト生成中...`);
      const positivePrompt = await geminiGenerate(
        geminiModel,
        promptGenInstruction,
        [{ role: "user", content: charDesc }],
        apiKey,
        0.7,
        200
      );
      const negativePrompt =
        "nsfw, explicit, nude, (bad anatomy:1.3), extra limbs, low quality, worst quality, blurry, text, watermark, full body, background details";
      console.log(`[ICON] Step1完了 → ${positivePrompt.slice(0, 100)}...`);

      const seed = Math.floor(Math.random() * 2147483647);
      const workflow = {
        "1": { class_type: "CheckpointLoaderSimple", inputs: { ckpt_name: checkpoint } },
        "2": { class_type: "CLIPTextEncode", inputs: { text: positivePrompt, clip: ["1", 1] } },
        "3": { class_type: "CLIPTextEncode", inputs: { text: negativePrompt, clip: ["1", 1] } },
        "4": { class_type: "EmptyLatentImage", inputs: { width: 512, height: 512, batch_size: 1 } },
        "5": {
          class_type: "KSampler",
          inputs: {
            model: ["1", 0], positive: ["2", 0], negative: ["3", 0], latent_image: ["4", 0],
            seed, control_after_generate: "randomize",
            steps: 20, cfg: 7, sampler_name: "euler_ancestral", scheduler: "karras", denoise: 1.0,
          },
        },
        "6": { class_type: "VAEDecode", inputs: { samples: ["5", 0], vae: ["1", 2] } },
        "7": { class_type: "SaveImage", inputs: { images: ["6", 0], filename_prefix: "aichat_icon" } },
      };

      const queueResponse = await fetch(`${comfyBaseUrl}/prompt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: workflow }),
      });
      if (!queueResponse.ok) {
        const errBody = await queueResponse.text();
        throw new Error(`ComfyUIへの送信に失敗しました (${queueResponse.status}): ${errBody.slice(0, 200)}`);
      }
      const queueData = await queueResponse.json();
      const promptId = queueData.prompt_id;
      if (!promptId) throw new Error("ComfyUIからprompt_idが返されませんでした");

      const maxWaitMs = 120_000;
      const pollIntervalMs = 2_000;
      const startTime = Date.now();
      let outputFilename: string | null = null;

      while (Date.now() - startTime < maxWaitMs) {
        await new Promise((r) => setTimeout(r, pollIntervalMs));
        const historyRes = await fetch(`${comfyBaseUrl}/history/${promptId}`);
        if (!historyRes.ok) continue;
        const historyData = await historyRes.json();
        const job = historyData[promptId];
        if (job && job.outputs) {
          const outputs = Object.values(job.outputs) as any[];
          for (const output of outputs) {
            if (output.images && output.images.length > 0) {
              outputFilename = output.images[0].filename;
              break;
            }
          }
          if (outputFilename) break;
        }
      }

      if (!outputFilename) throw new Error("アイコン生成がタイムアウトしました（120秒）。");

      const imageRes = await fetch(`${comfyBaseUrl}/view?filename=${encodeURIComponent(outputFilename)}&type=output`);
      if (!imageRes.ok) throw new Error(`画像データの取得に失敗しました (${imageRes.status})`);
      const imageBuffer = await imageRes.arrayBuffer();
      const base64Image = Buffer.from(imageBuffer).toString("base64");
      const iconUrl = `data:image/png;base64,${base64Image}`;

      console.log(`[ICON SUCCESS] 生成完了（${imageBuffer.byteLength} bytes）`);
      res.json({ iconUrl });
    } catch (error: any) {
      console.error("[ICON ERROR]", error);
      res.status(500).json({ error: error.message || "アイコン生成中にエラーが発生しました。" });
    }
  });

  // ── まとめ生成（世界設定確定 / 物語要約）──────────────────────────────────
  app.post("/api/summarize", async (req, res) => {
    console.log("--- [SUMMARIZE REQUEST] ---");
    try {
      const { messages, systemInstruction, model } = req.body;
      const geminiModel = model && GEMINI_MODELS.includes(model) ? model : DEFAULT_GEMINI_MODEL;
      const apiKey = getApiKey(req);

      const text = await geminiGenerate(
        geminiModel,
        systemInstruction || "以下の内容を日本語で要約してください。",
        [{ role: "user", content: `以下の会話履歴から設定を抽出して箇条書きでまとめてください：\n\n${messages}` }],
        apiKey,
        0.3,
        1024
      );

      console.log(`[SUMMARIZE SUCCESS]\n${text}`);
      res.json({ text });
    } catch (error: any) {
      console.error("[SUMMARIZE ERROR]", error);
      res.status(500).json({ error: error.message || "まとめ生成中にエラーが発生しました。" });
    }
  });

  // ── チャット（Gemini ストリーミング）────────────────────────────────────────
  app.post("/api/chat", async (req, res) => {
    console.log("--- [CHAT REQUEST (Gemini Streaming)] ---");
    try {
      const { messages, systemInstruction, model } = req.body;

      if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({ error: "リクエスト形式が正しくありません（messagesが配列ではありません）" });
      }
      const apiKey = getApiKey(req);
      if (!apiKey || apiKey.trim() === "") {
        return res.status(400).json({ error: "GEMINI_API_KEYが設定されていません。設定画面からAPIキーを入力してください。" });
      }

      const geminiModel = model && GEMINI_MODELS.includes(model) ? model : DEFAULT_GEMINI_MODEL;

      // 直近20件に絞ってコンテキスト圧迫を防ぐ
      const MAX_HISTORY = 20;
      const trimmed = messages.slice(-MAX_HISTORY);

      console.log(`[CHAT] model: ${geminiModel}, history: ${messages.length} → ${trimmed.length}件`);
      console.log("--- [SYSTEM PROMPT] ---");
      console.log(systemInstruction);
      console.log("--- [MESSAGES] ---");
      trimmed.forEach((m: any, i: number) => console.log(`[${i}] ${m.role?.toUpperCase()}: ${String(m.content).slice(0, 80)}`));
      console.log("-------------------");

      const geminiContents = toGeminiContents(trimmed);
      const requestBody: Record<string, unknown> = {
        contents: geminiContents,
        generationConfig: { temperature: 0.9 },
      };
      if (systemInstruction) {
        requestBody.system_instruction = { parts: [{ text: systemInstruction }] };
      }

      const url = `${GEMINI_BASE_URL}/${geminiModel}:streamGenerateContent?key=${apiKey}&alt=sse`;
      const upstream = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      if (!upstream.ok) {
        const errText = await upstream.text();
        throw new Error(`Gemini API error (${upstream.status}): ${errText.slice(0, 300)}`);
      }

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      if (!upstream.body) throw new Error("Gemini APIから空のレスポンスが返されました。");

      const reader = upstream.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let fullText = "";

      const processLine = (line: string) => {
        const trimmedLine = line.trim();
        if (!trimmedLine || !trimmedLine.startsWith("data: ")) return;
        const dataStr = trimmedLine.slice(6).trim();
        if (dataStr === "[DONE]") return;
        try {
          const parsed = JSON.parse(dataStr);
          const chunk = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
          if (typeof chunk === "string" && chunk) {
            fullText += chunk;
            res.write(`data: ${JSON.stringify({ text: chunk })}\n\n`);
          }
        } catch {
          // 不完全なJSONチャンクは無視
        }
      };

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            processLine(line);
          }
        }

        // ストリーム終了後、バッファに残った最後の行を処理する
        if (buffer.trim()) {
          processLine(buffer);
          buffer = "";
        }
      } catch (err: any) {
        console.error("Stream reader error:", err);
      }

      console.log("--- [AI FULL RESPONSE] ---");
      console.log(fullText);
      console.log("--- [END OF RESPONSE] ---");

      res.write("data: [DONE]\n\n");
      res.end();
    } catch (error: any) {
      console.error("[CHAT ERROR]", error.message);
      res.status(500).json({ error: error.message || "AIとの通信中に予期せぬエラーが発生しました。" });
    }
  });

  // Vite ミドルウェア
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Gemini API: ${GEMINI_API_KEY_ENV ? "環境変数で設定済み ✓" : "UIから設定 (x-gemini-api-key ヘッダー)"}`);
  });
}

startServer();
