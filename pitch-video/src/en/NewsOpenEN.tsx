import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { Embers } from "../components/Embers";
import { useEnter } from "../components/Reveal";
import { C, EASE_OUT, EDGE, at, fontFamily } from "../theme";

/** Corte entre fotos cuando la voz dice "threatening". */
const CUT = at(2.0);
export const NEWS_END = at(5.4);
const TICKER = "WILDFIRES IN PERU  •  HEAT DETECTED BY NASA SATELLITES  •  COMMUNITIES ON ALERT  •  BURNING SEASON  •  ";
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** Acto 1: el problema, como un noticiero de última hora. */
export const NewsOpenEN: React.FC = () => {
  const frame = useCurrentFrame();
  const first = frame < CUT;
  const local = first ? frame : frame - CUT;
  const span = first ? CUT : NEWS_END - CUT;
  const zoom = first ? interpolate(local, [0, span], [1.08, 1.2]) : interpolate(local, [0, span], [1.18, 1.05]);
  const pan = first ? interpolate(local, [0, span], [10, -40]) : interpolate(local, [0, span], [-50, 20]);
  // Cámara en mano: un temblor leve.
  const shakeX = Math.sin(frame * 1.3) * 3 + Math.sin(frame * 0.37) * 4;
  const shakeY = Math.cos(frame * 1.7) * 2;
  // Destello en el corte y zoom de salida hacia la frase.
  const flash = (frame >= CUT ? interpolate(frame, [CUT, CUT + 5], [0.85, 0], clamp) : 0) + interpolate(frame, [0, 6], [1, 0], clamp);
  const exit = interpolate(frame, [NEWS_END - 7, NEWS_END], [0, 1], clamp);
  const flicker = 0.35 + 0.25 * Math.sin(frame / 3.1) * Math.sin(frame / 5.3);

  const bar = interpolate(frame, [12, 28], [0, 100], { ...clamp, easing: EASE_OUT });
  const live = useEnter(6, 10, 0);
  const sub = useEnter(26, 12, 12);
  const pulse = 0.55 + 0.45 * Math.abs(Math.sin(frame / 7));
  const tickerX = -((frame * 7) % 1500);

  return (
    <AbsoluteFill style={{ backgroundColor: "#000", fontFamily, overflow: "hidden" }}>
      <AbsoluteFill
        style={{
          transform: `translate(${shakeX}px, ${shakeY}px) scale(${zoom * (1 + exit * 0.35)}) translateX(${pan}px)`,
          filter: `blur(${exit * 10}px) saturate(1.15)`,
        }}
      >
        <Img src={staticFile(first ? "noticia1.jpg" : "noticia2.jpg")} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </AbsoluteFill>
      {/* Luz del fuego que parpadea desde abajo */}
      <AbsoluteFill style={{ background: "radial-gradient(ellipse at 50% 110%, rgba(255,110,40,0.55), transparent 60%)", opacity: flicker, mixBlendMode: "screen" }} />
      <AbsoluteFill style={{ background: "radial-gradient(ellipse at center, transparent 45%, rgba(0,0,0,0.55) 100%)" }} />
      <Embers count={80} />

      <div style={{ position: "absolute", top: 64, left: EDGE, display: "flex", ...live }}>
        <div style={{ background: C.news, color: C.white, fontWeight: 800, fontSize: 30, padding: "10px 20px", display: "flex", alignItems: "center", gap: 12, letterSpacing: "0.06em" }}>
          <span style={{ width: 14, height: 14, borderRadius: 7, background: C.white, opacity: pulse }} />
          LIVE
        </div>
        <div style={{ background: C.white, color: C.ink, fontWeight: 800, fontSize: 30, padding: "10px 20px", letterSpacing: "0.06em" }}>BREAKING NEWS</div>
      </div>

      <div style={{ position: "absolute", left: EDGE, top: 640, clipPath: `inset(0 ${100 - bar}% 0 0)` }}>
        <div style={{ display: "flex", alignItems: "stretch" }}>
          <div style={{ background: C.news, color: C.white, fontWeight: 800, fontSize: 32, padding: "0 22px", display: "flex", alignItems: "center", letterSpacing: "0.08em" }}>ALERT</div>
          <div style={{ background: C.white, color: C.ink, fontWeight: 800, fontSize: 60, padding: "8px 28px 12px", letterSpacing: "-0.02em", lineHeight: 1.05 }}>
            Wildfires threaten communities in Peru
          </div>
        </div>
      </div>
      <div style={{ position: "absolute", left: EDGE, top: 736, background: C.ink, color: C.white, fontWeight: 600, fontSize: 32, padding: "8px 22px", ...sub }}>
        No warning reached them in time
      </div>

      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 64, background: C.news, display: "flex", alignItems: "center", overflow: "hidden" }}>
        <div style={{ background: C.ink, color: C.white, fontWeight: 800, fontSize: 28, height: "100%", display: "flex", alignItems: "center", padding: "0 28px", zIndex: 1, letterSpacing: "0.06em" }}>PERU</div>
        <div style={{ whiteSpace: "nowrap", color: C.white, fontWeight: 600, fontSize: 30, transform: `translateX(${tickerX}px)`, paddingLeft: 32 }}>{TICKER.repeat(4)}</div>
      </div>
      <div style={{ position: "absolute", right: 40, top: 72, color: "rgba(255,255,255,0.75)", fontSize: 28, fontWeight: 500 }}>Reference images</div>

      <AbsoluteFill style={{ backgroundColor: C.white, opacity: flash }} />
    </AbsoluteFill>
  );
};
