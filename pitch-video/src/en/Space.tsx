import type React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { rand } from "../components/Embers";
import { C, EASE_OUT, at, fontFamily } from "../theme";

export const SPACE = "#0A0F24";
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** Fondo de espacio con estrellas que titilan. */
export const Stars: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <svg width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
      {Array.from({ length: 140 }, (_, i) => (
        <circle key={i} cx={rand(i, 11) * 1920} cy={rand(i, 12) * 1080} r={0.6 + rand(i, 13) * 1.6} fill="#fff" opacity={0.15 + 0.4 * Math.abs(Math.sin(frame / (10 + rand(i, 14) * 30) + i))} />
      ))}
    </svg>
  );
};

const LOGO_START = at(8.52);
const cueLogo = (s: number) => at(s) - LOGO_START;

/** Acto 3a: la marca. Las letras caen una a una y estalla una onda con chispas. */
export const LogoBurst: React.FC = () => {
  const frame = useCurrentFrame();
  const letters = "BOYSFIRE".split("");
  const first = cueLogo(9.11);
  const land = first + 12;
  const wave = interpolate(frame, [land, land + 26], [0, 1], { ...clamp, easing: EASE_OUT });
  const label = interpolate(frame, [0, 10], [0, 1], { ...clamp, easing: EASE_OUT });
  const tag = interpolate(frame, [land + 2, land + 14], [0, 1], { ...clamp, easing: EASE_OUT });
  return (
    <AbsoluteFill style={{ backgroundColor: SPACE, fontFamily, color: C.white }}>
      <Stars />
      <svg width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
        <circle cx={960} cy={520} r={80 + wave * 900} fill="none" stroke={C.ember} strokeWidth={6 * (1 - wave)} opacity={1 - wave} />
        {Array.from({ length: 48 }, (_, i) => {
          const a = (i / 48) * Math.PI * 2 + rand(i, 21) * 0.3;
          const d = 120 + wave * (300 + rand(i, 22) * 500);
          return <circle key={i} cx={960 + Math.cos(a) * d} cy={520 + Math.sin(a) * d * 0.6} r={2 + rand(i, 23) * 4} fill={rand(i, 24) > 0.5 ? C.ember : C.fire} opacity={frame >= land ? 1 - wave : 0} />;
        })}
      </svg>
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
        <div style={{ fontSize: 44, fontWeight: 600, color: "rgba(255,255,255,0.7)", opacity: label, transform: `translateY(${(1 - label) * 14}px)`, marginBottom: 10 }}>
          That's why we built
        </div>
        <div style={{ display: "flex", fontSize: 250, fontWeight: 800, letterSpacing: "0.01em", lineHeight: 1 }}>
          {letters.map((ch, i) => {
            const p = interpolate(frame, [first + i * 2, first + i * 2 + 12], [0, 1], { ...clamp, easing: EASE_OUT });
            return (
              <span key={i} style={{ display: "inline-block", opacity: p, transform: `translateY(${(1 - p) * -120}px) scale(${1.6 - 0.6 * p})`, filter: `blur(${(1 - p) * 14}px)`, color: i >= 4 ? C.ember : C.white }}>
                {ch}
              </span>
            );
          })}
        </div>
        <div style={{ fontSize: 44, fontWeight: 500, color: "rgba(255,255,255,0.75)", marginTop: 16, opacity: tag, letterSpacing: "0.02em" }}>
          The wildfire almanac of Peru
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
