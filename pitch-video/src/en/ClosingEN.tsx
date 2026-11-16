import type React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { Embers } from "../components/Embers";
import { C, EASE_OUT, EDGE, at, fontFamily } from "../theme";
import { SPACE, Stars } from "./Space";

const START = at(22.43);
const cue = (s: number) => at(s) - START;
export const END_CARD = cue(26.8);
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

const Line: React.FC<{ start: number; children: React.ReactNode }> = ({ start, children }) => {
  const frame = useCurrentFrame();
  const p = interpolate(frame, [start, start + 12], [0, 1], { ...clamp, easing: EASE_OUT });
  return (
    <div style={{ overflow: "hidden", paddingBottom: "0.06em" }}>
      <div style={{ fontSize: 112, fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 1, transform: `translateY(${(1 - p) * 105}%)`, filter: `blur(${(1 - p) * 8}px)`, opacity: p > 0 ? 1 : 0 }}>
        {children}
      </div>
    </div>
  );
};

/** La Tierra sube, un satélite la vigila y un escudo se dibuja sobre ella. */
const EarthWatch: React.FC = () => {
  const frame = useCurrentFrame();
  const rise = interpolate(frame, [0, 40], [260, 0], { ...clamp, easing: EASE_OUT });
  const shield = interpolate(frame, [cue(24.51), cue(24.51) + 22], [0, 1], { ...clamp, easing: EASE_OUT });
  const t = frame / 70;
  const sx = 300 + ((frame * 9) % 1500);
  const sy = 640 - Math.sin(t) * 24;
  const beam = 0.25 + 0.2 * Math.sin(frame / 4);
  const cy = 2240 + rise;
  return (
    <svg width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
      <circle cx={960} cy={cy} r={1430} fill="none" stroke="#7F9BFF" strokeWidth={26} opacity={0.18} />
      <circle cx={960} cy={cy} r={1400} fill="#14235E" stroke="#8FA5FF" strokeWidth={3} />
      {Array.from({ length: 9 }, (_, i) => (
        <ellipse key={i} cx={960} cy={cy} rx={1400 - i * 150} ry={1400} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={2} />
      ))}
      <polygon points={`${sx - 8},${sy + 14} ${sx + 8},${sy + 14} ${sx + 90},${cy - 1400 + 12} ${sx - 90},${cy - 1400 + 12}`} fill={C.ember} opacity={beam} />
      <g transform={`translate(${sx} ${sy})`}>
        <rect x={-40} y={-8} width={26} height={16} fill="#9FB2FF" stroke="#fff" strokeWidth={2} />
        <rect x={14} y={-8} width={26} height={16} fill="#9FB2FF" stroke="#fff" strokeWidth={2} />
        <rect x={-12} y={-12} width={24} height={24} rx={4} fill="#fff" />
      </g>
      <path d={`M 120 ${cy - 1330} Q 960 ${cy - 1980} 1800 ${cy - 1330}`} pathLength={1} fill="none" stroke={C.ember} strokeWidth={8} strokeDasharray={1} strokeDashoffset={1 - shield} strokeLinecap="round" />
      <path d={`M 120 ${cy - 1330} Q 960 ${cy - 1980} 1800 ${cy - 1330} Z`} fill={C.ember} opacity={0.08 * shield} />
    </svg>
  );
};

/** Acto 4: la promesa y la tarjeta final. */
export const ClosingEN: React.FC = () => {
  const frame = useCurrentFrame();
  const second = cue(24.16);
  if (frame >= END_CARD) {
    const local = frame - END_CARD;
    const meta = interpolate(local, [18, 30], [0, 1], { ...clamp, easing: EASE_OUT });
    return (
      <AbsoluteFill style={{ backgroundColor: SPACE, fontFamily, color: C.white }}>
        <Stars />
        <Embers count={50} opacity={0.6} speed={0.6} />
        <AbsoluteFill style={{ justifyContent: "center", paddingLeft: EDGE }}>
          <div style={{ display: "flex", fontSize: 250, fontWeight: 800, letterSpacing: "0.01em", lineHeight: 0.95 }}>
            {"BOYSFIRE".split("").map((ch, i) => {
              const p = interpolate(local, [i * 2, i * 2 + 12], [0, 1], { ...clamp, easing: EASE_OUT });
              return (
                <span key={i} style={{ display: "inline-block", opacity: p, transform: `translateY(${(1 - p) * 60}px)`, filter: `blur(${(1 - p) * 10}px)`, color: i >= 4 ? C.ember : C.white }}>
                  {ch}
                </span>
              );
            })}
          </div>
          <div style={{ opacity: meta, transform: `translateY(${(1 - meta) * 14}px)` }}>
            <div style={{ fontSize: 50, fontWeight: 500, marginTop: 22, color: "rgba(255,255,255,0.82)" }}>The wildfire almanac of Peru</div>
            <div style={{ width: 120, height: 8, background: C.ember, marginTop: 40 }} />
            <div style={{ fontSize: 38, fontWeight: 600, marginTop: 40 }}>NASA Space Apps Challenge · Challenge 09</div>
            <div style={{ fontSize: 30, fontWeight: 500, marginTop: 10, color: "rgba(255,255,255,0.72)" }}>Data: NASA FIRMS (MODIS · VIIRS) · Open-Meteo</div>
          </div>
        </AbsoluteFill>
      </AbsoluteFill>
    );
  }
  const fadeFirst = interpolate(frame, [second - 6, second], [1, 0], clamp);
  return (
    <AbsoluteFill style={{ backgroundColor: SPACE, fontFamily, color: C.white }}>
      <Stars />
      <EarthWatch />
      <div style={{ position: "absolute", left: EDGE, top: 130 }}>
        {frame < second ? (
          <div style={{ opacity: fadeFirst }}>
            <Line start={0}>We turn NASA's eyes</Line>
            <Line start={cue(23.64)}>in space</Line>
          </div>
        ) : (
          <div>
            <Line start={second}>
              into the <span style={{ color: C.ember }}>shield</span>
            </Line>
            <Line start={cue(24.83)}>that protects</Line>
            <Line start={cue(25.39)}>our families on Earth.</Line>
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};
