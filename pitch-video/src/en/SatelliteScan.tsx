import type React from "react";
import { AbsoluteFill, interpolate, interpolateColors, useCurrentFrame } from "remotion";
import peru from "../data/peru.json";
import { C, EASE_OUT, EDGE, at, fontFamily } from "../theme";
import { SPACE, Stars } from "./Space";

const START = at(10.51);
const cue = (s: number) => at(s) - START;
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

const MODIS = "#FF8A3D";
const VIIRS = "#FFD166";
const PASS = 34; // cuadros que tarda cada pasada sobre Perú
const PASSES = [cue(11.46), cue(11.99)]; // MODIS, VIIRS: cuando la voz los nombra
const MERGE = cue(13.06);
const MORPH = cue(13.58);
const MAP = { left: 1110, top: 70, scale: 0.95 };
const W = peru.width;
const H = peru.height;
type Point = [number, number, number, number];
const POINTS = peru.points as Point[];

const passY = (frame: number, sensor: number) => interpolate(frame, [PASSES[sensor], PASSES[sensor] + PASS], [-40, H + 40], clamp);
const revealAt = (y: number, sensor: number) => PASSES[sensor] + ((y + 40) / (H + 80)) * PASS;

/** Un satélite sencillo: cuerpo y dos paneles solares. */
const Satellite: React.FC<{ x: number; y: number; color: string }> = ({ x, y, color }) => (
  <g transform={`translate(${x} ${y})`}>
    <rect x={-46} y={-9} width={30} height={18} fill="#9FB2FF" stroke="#fff" strokeWidth={2} />
    <rect x={16} y={-9} width={30} height={18} fill="#9FB2FF" stroke="#fff" strokeWidth={2} />
    <rect x={-14} y={-14} width={28} height={28} rx={4} fill="#fff" />
    <circle r={6} fill={color} />
  </g>
);

const Legend: React.FC<{ start: number; color: string; name: string; detail: string }> = ({ start, color, name, detail }) => {
  const frame = useCurrentFrame();
  const p = interpolate(frame, [start, start + 10], [0, 1], { ...clamp, easing: EASE_OUT });
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 18, opacity: p, transform: `translateX(${(1 - p) * -30}px)`, marginTop: 18 }}>
      <span style={{ width: 22, height: 22, borderRadius: 11, background: color }} />
      <span style={{ fontSize: 40, fontWeight: 800 }}>{name}</span>
      <span style={{ fontSize: 32, fontWeight: 500, color: "rgba(255,255,255,0.7)" }}>{detail}</span>
    </div>
  );
};

/** Acto 3b: dos satélites barren Perú y aparecen los focos reales de un día; luego se vuelven una sola serie. */
export const SatelliteScan: React.FC = () => {
  const frame = useCurrentFrame();
  const draw = interpolate(frame, [0, 22], [0, 1], { ...clamp, easing: EASE_OUT });
  const merge = interpolate(frame, [MERGE, MERGE + 12], [0, 1], clamp);
  const ring = interpolate(frame, [MERGE, MERGE + 24], [0, 1], { ...clamp, easing: EASE_OUT });
  const revealed = POINTS.reduce((n, [, y, s]) => n + (frame >= revealAt(y, s) ? 1 : 0), 0);
  const count = Math.round((revealed / POINTS.length) * peru.total);
  // Cifra real de la armonización: el salto de 7,9× desaparece (0,95).
  const morph = interpolate(frame, [MORPH, MORPH + 16], [7.895, 0.949], { ...clamp, easing: EASE_OUT });
  const morphing = frame >= MERGE;
  const title2 = interpolate(frame, [MERGE, MERGE + 12], [0, 1], { ...clamp, easing: EASE_OUT });
  const stat = interpolate(frame, [PASSES[0], PASSES[0] + 10], [0, 1], clamp);

  return (
    <AbsoluteFill style={{ backgroundColor: SPACE, fontFamily, color: C.white }}>
      <Stars />
      <svg
        width={W * MAP.scale}
        height={H * MAP.scale}
        viewBox={`0 0 ${W} ${H}`}
        style={{ position: "absolute", left: MAP.left, top: MAP.top, overflow: "visible" }}
      >
        {peru.paths.map((d, i) => (
          <path key={i} d={d} pathLength={1} fill={`rgba(255,255,255,${0.04 * draw})`} stroke="rgba(255,255,255,0.45)" strokeWidth={1.2} strokeDasharray={1} strokeDashoffset={1 - draw} />
        ))}

        {/* Franjas de barrido de cada satélite */}
        {[0, 1].map((s) => {
          const y = passY(frame, s);
          const on = frame >= PASSES[s] && frame <= PASSES[s] + PASS;
          const color = s === 0 ? MODIS : VIIRS;
          return on ? (
            <g key={s}>
              <rect x={-160} y={y - 26} width={W + 320} height={52} fill={color} opacity={0.14} />
              <line x1={-160} x2={W + 160} y1={y} y2={y} stroke={color} strokeWidth={2} opacity={0.9} />
              <Satellite x={s === 0 ? -150 : W + 150} y={y} color={color} />
            </g>
          ) : null;
        })}

        {POINTS.map(([x, y, s, frp], i) => {
          const t = revealAt(y, s);
          if (frame < t) return null;
          const p = interpolate(frame, [t, t + 6], [0, 1], clamp);
          const base = s === 0 ? MODIS : VIIRS;
          const color = interpolateColors(merge, [0, 1], [base, "#FF5A36"]);
          const r = (1.6 + Math.min(frp, 80) / 40) * (1 + (1 - p) * 1.6);
          return <circle key={i} cx={x} cy={y} r={r} fill={color} opacity={0.85} />;
        })}

        <circle cx={W / 2} cy={H / 2} r={80 + ring * 700} fill="none" stroke="#fff" strokeWidth={4 * (1 - ring)} opacity={frame >= MERGE ? 1 - ring : 0} />
      </svg>

      <div style={{ position: "absolute", left: EDGE, top: 120, width: 940 }}>
        <div style={{ fontSize: 30, fontWeight: 600, letterSpacing: "0.08em", color: C.ember, opacity: draw }}>NASA FIRMS · PERU · SEP 13, 2024</div>
        <div style={{ fontSize: 96, fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 1, marginTop: 14, opacity: draw }}>Two satellites.</div>
        <div style={{ fontSize: 96, fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 1, color: C.ember, opacity: title2, transform: `translateY(${(1 - title2) * 30}px)` }}>
          One record.
        </div>
        <div style={{ marginTop: 34 }}>
          <Legend start={PASSES[0]} color={MODIS} name="MODIS" detail="Terra & Aqua · since 2000" />
          <Legend start={PASSES[1]} color={VIIRS} name="VIIRS" detail="S-NPP & NOAA-20 · since 2012" />
        </div>
        <div style={{ marginTop: 52, opacity: stat }}>
          <div style={{ fontSize: 132, fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 1, fontVariantNumeric: "tabular-nums", color: morphing ? C.ember : C.white }}>
            {morphing ? `${morph.toFixed(2)}×` : count.toLocaleString("en-US")}
          </div>
          <div style={{ fontSize: 34, fontWeight: 500, color: "rgba(255,255,255,0.75)", marginTop: 8 }}>
            {morphing
              ? frame < MORPH + 16
                ? "fake jump in raw counts when VIIRS arrived"
                : "harmonized: the same fire, truly comparable"
              : "hotspots detected in a single day"}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
