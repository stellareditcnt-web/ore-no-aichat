interface FormattedTextProps {
  text: string;
  isUser: boolean;
}

// 「」セリフ / 【】描写 / (心情) の各ブロックを識別して分割
// 半角 () と全角 （） 両方に対応（モデルが全角を出す場合もあるため）
const BLOCK_PATTERN = /(「[\s\S]*?」|【[\s\S]*?】|\([^)]+\)|（[^）]+）)/g;

export default function FormattedText({ text, isUser }: FormattedTextProps) {
  if (isUser) return <>{text}</>;
  if (!text) return null;

  const parts = text.split(BLOCK_PATTERN);

  return (
    <>
      {parts.map((part, i) => {
        // 「セリフ」— 白寄り・左アンバーボーダー
        if (part.startsWith('「') && part.endsWith('」')) {
          return (
            <span
              key={i}
              className="text-stone-100 font-medium block my-1.5 border-l-2 border-amber-500/40 pl-3 whitespace-pre-wrap"
            >
              {part}
            </span>
          );
        }

        // 【描写】— ローズ系・左太ボーダー
        if (part.startsWith('【') && part.endsWith('】')) {
          return (
            <span
              key={i}
              className="text-rose-400 block my-1.5 bg-rose-950/20 px-3 py-1.5 rounded-xl border-l-4 border-rose-600/70 shadow-sm whitespace-pre-wrap text-sm"
            >
              {part}
            </span>
          );
        }

        // (心情) または （心情）— イエロー・斜体
        const isHalfParen = part.startsWith('(') && part.endsWith(')');
        const isFullParen = part.startsWith('（') && part.endsWith('）');
        if (isHalfParen || isFullParen) {
          return (
            <span
              key={i}
              className="text-yellow-300/90 block my-1 bg-yellow-950/20 px-3 py-1 rounded-lg border-l-2 border-yellow-500/40 italic text-sm whitespace-pre-wrap"
            >
              {part}
            </span>
          );
        }

        // プレーンテキスト
        return (
          <span key={i} className="text-stone-300 whitespace-pre-wrap">
            {part}
          </span>
        );
      })}
    </>
  );
}
