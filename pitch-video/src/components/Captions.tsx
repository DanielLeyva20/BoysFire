import type React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { C, EASE_OUT, FPS, VOICE_OFFSET, fontFamily } from "../theme";

export type Word = { w: string; s: number; e: number };

/** Corta la narración en frases: `sizes` dice cuántas palabras lleva cada una; lo que sobra se corta en la puntuación. */
const group = (words: Word[], sizes: number[]): Word[][] => {
  const groups: Word[][] = [];
  let current: Word[] = [];
  for (const word of words) {
    current.push(word);
    const size = sizes[groups.length];
    if (size ? current.length === size : /[,.:…]$/.test(word.w) || current.length === 6) {
      groups.push(current);
      current = [];
    }
  }
  if (current.length) groups.push(current);
  return groups;
};

/** Subtítulos con la palabra que se está diciendo resaltada y una entrada corta por frase. */
export const Captions: React.FC<{ words: Word[]; sizes: number[]; hidden: [number, number][] }> = ({ words, sizes, hidden }) => {
  const frame = useCurrentFrame();
  if (hidden.some(([a, b]) => frame >= a && frame < b)) return null;
  const t = frame / FPS - VOICE_OFFSET;
  const current = group(words, sizes).find((g) => t >= g[0].s - 0.05 && t <= g[g.length - 1].e + 0.25);
  if (!current) return null;
  const since = frame - Math.round((current[0].s + VOICE_OFFSET) * FPS);
  const pop = interpolate(since, [-2, 6], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE_OUT });
  return (
    <div style={{ position: "absolute", left: 0, right: 0, bottom: 96, display: "flex", justifyContent: "center", pointerEvents: "none" }}>
      <div
        style={{
          fontFamily,
          fontWeight: 600,
          fontSize: 44,
          lineHeight: 1.2,
          color: C.white,
          background: C.ink,
          padding: "12px 26px 14px",
          borderRadius: 6,
          maxWidth: 1400,
          textAlign: "center",
          opacity: pop,
          transform: `translateY(${(1 - pop) * 16}px) scale(${0.94 + 0.06 * pop})`,
        }}
      >
        {current.map((word, i) => (
          <span key={i} style={{ color: t >= word.s && t <= word.e + 0.08 ? C.ember : C.white }}>
            {word.w}
            {i < current.length - 1 ? " " : ""}
          </span>
        ))}
      </div>
    </div>
  );
};
