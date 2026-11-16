import type React from "react";
import { useCurrentFrame } from "remotion";

/** Número pseudoaleatorio estable: el mismo cuadro siempre dibuja lo mismo. */
export const rand = (i: number, salt = 0) => {
  const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
  return x - Math.floor(x);
};

/** Chispas que suben desde abajo, parpadeando. */
export const Embers: React.FC<{ count?: number; opacity?: number; speed?: number }> = ({ count = 70, opacity = 1, speed = 1 }) => {
  const frame = useCurrentFrame();
  return (
    <svg width={1920} height={1080} style={{ position: "absolute", inset: 0, mixBlendMode: "screen", opacity }}>
      {Array.from({ length: count }, (_, i) => {
        const v = (1.6 + rand(i, 1) * 3.4) * speed;
        const y = 1120 - ((frame * v + rand(i, 2) * 1300) % 1300);
        const x = rand(i, 3) * 1920 + Math.sin(frame / (14 + rand(i, 4) * 20) + i) * (14 + rand(i, 5) * 26);
        const r = 1.5 + rand(i, 6) * 3.5;
        const flicker = 0.45 + 0.55 * Math.abs(Math.sin(frame / (4 + rand(i, 7) * 6) + i));
        const fade = Math.min(1, Math.max(0, (y + 80) / 500));
        return <circle key={i} cx={x} cy={y} r={r} fill={rand(i, 8) > 0.5 ? "#FFB547" : "#FF6B2E"} opacity={flicker * fade} />;
      })}
    </svg>
  );
};
