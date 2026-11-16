import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { useEnter } from "../components/Reveal";
import { C, EASE_OUT, EDGE, at, fontFamily } from "../theme";

/** Corte entre las dos fotos: cuando la voz dice "amenaza". */
const CUT = at(3.01);
const TICKER =
  "INCENDIOS FORESTALES EN EL PERÚ  •  FOCOS DE CALOR DETECTADOS POR SATÉLITE  •  COMUNIDADES EN ALERTA  •  TEMPORADA DE QUEMAS  •  ";

/** Acto 1: el problema, contado como un noticiero. */
export const NewsOpen: React.FC = () => {
  const frame = useCurrentFrame();
  const first = frame < CUT;
  const local = first ? frame : frame - CUT;
  const span = first ? CUT : 120;
  const zoom = first
    ? interpolate(local, [0, span], [1.06, 1.16])
    : interpolate(local, [0, span], [1.14, 1.04]);
  const pan = first ? interpolate(local, [0, span], [0, -30]) : interpolate(local, [0, span], [-40, 10]);

  // Rótulo inferior: entra recortado de izquierda a derecha.
  const bar = interpolate(frame, [10, 26], [0, 100], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE_OUT });
  const live = useEnter(4, 10, 0);
  const sub = useEnter(24, 12, 12);
  const pulse = 0.55 + 0.45 * Math.abs(Math.sin(frame / 9));
  const tickerX = -((frame * 6) % 1800);

  return (
    <AbsoluteFill style={{ backgroundColor: "#000", fontFamily }}>
      <AbsoluteFill style={{ transform: `scale(${zoom}) translateX(${pan}px)` }}>
        <Img src={staticFile(first ? "noticia1.jpg" : "noticia2.jpg")} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </AbsoluteFill>
      <AbsoluteFill style={{ backgroundColor: "rgba(8, 10, 20, 0.28)" }} />

      {/* EN VIVO */}
      <div style={{ position: "absolute", top: 64, left: EDGE, display: "flex", gap: 0, ...live }}>
        <div style={{ background: C.news, color: C.white, fontWeight: 800, fontSize: 30, padding: "10px 20px", display: "flex", alignItems: "center", gap: 12, letterSpacing: "0.06em" }}>
          <span style={{ width: 14, height: 14, borderRadius: 7, background: C.white, opacity: pulse }} />
          EN VIVO
        </div>
        <div style={{ background: C.white, color: C.ink, fontWeight: 800, fontSize: 30, padding: "10px 20px", letterSpacing: "0.06em" }}>
          ÚLTIMA HORA
        </div>
      </div>

      {/* Rótulo */}
      <div style={{ position: "absolute", left: EDGE, top: 640, clipPath: `inset(0 ${100 - bar}% 0 0)` }}>
        <div style={{ display: "flex", alignItems: "stretch" }}>
          <div style={{ background: C.news, color: C.white, fontWeight: 800, fontSize: 32, padding: "0 22px", display: "flex", alignItems: "center", letterSpacing: "0.08em" }}>
            ALERTA
          </div>
          <div style={{ background: C.white, color: C.ink, fontWeight: 800, fontSize: 60, padding: "8px 28px 12px", letterSpacing: "-0.02em", lineHeight: 1.05 }}>
            Incendios forestales amenazan comunidades
          </div>
        </div>
      </div>
      <div style={{ position: "absolute", left: EDGE, top: 736, background: C.ink, color: C.white, fontWeight: 600, fontSize: 32, padding: "8px 22px", ...sub }}>
        Perú · sin una advertencia a tiempo
      </div>

      {/* Cinta de noticias */}
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 64, background: C.news, display: "flex", alignItems: "center", overflow: "hidden" }}>
        <div style={{ background: C.ink, color: C.white, fontWeight: 800, fontSize: 28, height: "100%", display: "flex", alignItems: "center", padding: "0 28px", zIndex: 1, letterSpacing: "0.06em" }}>
          PERÚ
        </div>
        <div style={{ whiteSpace: "nowrap", color: C.white, fontWeight: 600, fontSize: 30, transform: `translateX(${tickerX}px)`, paddingLeft: 32 }}>
          {TICKER.repeat(4)}
        </div>
      </div>

      <div style={{ position: "absolute", right: 40, top: 70, color: "rgba(255,255,255,0.75)", fontSize: 28, fontWeight: 500 }}>
        Imágenes de referencia
      </div>
    </AbsoluteFill>
  );
};
