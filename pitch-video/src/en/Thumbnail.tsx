import { AbsoluteFill } from "remotion";
import { rand } from "../components/Embers";
import peru from "../data/peru.json";
import { C, fontFamily } from "../theme";
import { SPACE } from "./Space";

type Point = [number, number, number, number];
const POINTS = peru.points as Point[];
const MAP_H = 650;
const MAP_SCALE = MAP_H / peru.height;
const MAP_LEFT = 800;
const MAP_TOP = 34;

/** Miniatura de YouTube (1280x720): Perú visto desde el espacio con los focos reales de un día. */
export const Thumbnail: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: SPACE, fontFamily, color: C.white, overflow: "hidden" }}>
    <svg width={1280} height={720} style={{ position: "absolute", inset: 0 }}>
      <defs>
        <radialGradient id="heat" cx="78%" cy="45%" r="45%">
          <stop offset="0%" stopColor="#FF6B2E" stopOpacity={0.35} />
          <stop offset="100%" stopColor="#FF6B2E" stopOpacity={0} />
        </radialGradient>
        <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="4" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      {Array.from({ length: 90 }, (_, i) => (
        <circle key={i} cx={rand(i, 31) * 1280} cy={rand(i, 32) * 720} r={0.6 + rand(i, 33) * 1.4} fill="#fff" opacity={0.2 + rand(i, 34) * 0.4} />
      ))}
      <rect width={1280} height={720} fill="url(#heat)" />

      <g transform={`translate(${MAP_LEFT} ${MAP_TOP}) scale(${MAP_SCALE})`}>
        {peru.paths.map((d, i) => (
          <path key={i} d={d} fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.5)" strokeWidth={1.6} />
        ))}
        <g filter="url(#glow)">
          {POINTS.map(([x, y, s, frp], i) => (
            <circle key={i} cx={x} cy={y} r={2 + Math.min(frp, 80) / 30} fill={s === 1 ? "#FFB547" : "#FF5A36"} opacity={0.9} />
          ))}
        </g>
      </g>

      {/* Satélite con su línea de barrido */}
      <line x1={760} x2={1250} y1={250} y2={250} stroke={C.ember} strokeWidth={2} opacity={0.8} />
      <rect x={740} y={226} width={520} height={48} fill={C.ember} opacity={0.1} />
      <g transform="translate(740 250)">
        <rect x={-42} y={-9} width={28} height={18} fill="#9FB2FF" stroke="#fff" strokeWidth={2} />
        <rect x={14} y={-9} width={28} height={18} fill="#9FB2FF" stroke="#fff" strokeWidth={2} />
        <rect x={-13} y={-13} width={26} height={26} rx={4} fill="#fff" />
        <circle r={6} fill={C.ember} />
      </g>
    </svg>

    <div style={{ position: "absolute", left: 64, top: 70 }}>
      <div style={{ display: "inline-block", background: C.news, color: C.white, fontSize: 26, fontWeight: 800, letterSpacing: "0.08em", padding: "8px 16px" }}>
        NASA SATELLITES · PERU
      </div>
      <div style={{ fontSize: 112, fontWeight: 800, letterSpacing: "-0.035em", lineHeight: 0.92, marginTop: 26 }}>
        SEEING
        <br />
        WILDFIRES
        <br />
        FROM <span style={{ color: C.ember }}>SPACE</span>
      </div>
    </div>

    <div style={{ position: "absolute", left: 64, bottom: 56, display: "flex", alignItems: "center", gap: 18 }}>
      <div style={{ fontSize: 46, fontWeight: 800, letterSpacing: "0.01em" }}>
        BOYS<span style={{ color: C.ember }}>FIRE</span>
      </div>
      <div style={{ width: 3, height: 40, background: "rgba(255,255,255,0.35)" }} />
      <div style={{ fontSize: 24, fontWeight: 600, color: "rgba(255,255,255,0.8)", lineHeight: 1.15 }}>
        MODIS + VIIRS
        <br />
        one comparable record
      </div>
    </div>

    <div style={{ position: "absolute", right: 40, top: 40, background: C.white, color: C.ink, borderRadius: 8, padding: "10px 18px", textAlign: "right" }}>
      <div style={{ fontSize: 44, fontWeight: 800, lineHeight: 1, letterSpacing: "-0.02em" }}>{peru.total.toLocaleString("en-US")}</div>
      <div style={{ fontSize: 20, fontWeight: 600, color: C.ink2 }}>hotspots in one day</div>
    </div>
  </AbsoluteFill>
);
