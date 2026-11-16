import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { Reveal, useEnter } from "../components/Reveal";
import { C, EASE_IN_OUT, EASE_OUT, EDGE, at, fontFamily } from "../theme";

const START = at(9.08);
const cue = (seconds: number) => at(seconds) - START;

// Recorte del gráfico real de la línea de tiempo (captura de la app), escalado ×1.25.
const CROP = { x: 288, y: 370, w: 1344, h: 330 };
const SCALE = 1.18;
const CHART_TOP = 290;

const Tag: React.FC<{ start: number; x: number; y: number; color: string; children: React.ReactNode }> = ({ start, x, y, color, children }) => {
  const style = useEnter(start, 10, 10);
  return (
    <div style={{ position: "absolute", left: x, top: y, display: "flex", alignItems: "center", gap: 12, ...style }}>
      <span style={{ width: 16, height: 16, background: color, borderRadius: 2 }} />
      <span style={{ background: C.ink, color: C.white, fontSize: 32, fontWeight: 600, padding: "6px 14px", borderRadius: 4 }}>{children}</span>
    </div>
  );
};

/** Acto 3a: la marca y la armonización (dos satélites → una serie comparable). */
export const BrandMerge: React.FC = () => {
  const frame = useCurrentFrame();
  const split = cue(10.94);
  const brandOut = interpolate(frame, [split, split + 10], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE_IN_OUT });
  const chartWipe = interpolate(frame, [split + 4, split + 26], [0, 100], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE_OUT });
  const intro = useEnter(0, 10, 12);
  const title = useEnter(split + 2, 12, 16);
  const figA = useEnter(cue(14.5), 12, 16);
  const figB = useEnter(cue(14.5) + 6, 12, 16);

  return (
    <AbsoluteFill style={{ backgroundColor: C.paper, fontFamily, color: C.ink }}>
      {/* Marca */}
      {frame < split + 12 && (
        <AbsoluteFill style={{ justifyContent: "center", paddingLeft: EDGE, opacity: 1 - brandOut, transform: `translateY(${-brandOut * 60}px)` }}>
          <div style={{ fontSize: 40, fontWeight: 600, color: C.ink2, marginBottom: 12, ...intro }}>Por eso creamos</div>
          <Reveal start={cue(9.86)} style={{ fontSize: 236, fontWeight: 800, letterSpacing: "0.01em", lineHeight: 0.95 }}>
            BOYSFIRE
          </Reveal>
          <Reveal start={cue(9.86) + 8} style={{ fontSize: 48, fontWeight: 500, color: C.ink2, marginTop: 18 }}>
            Almanaque de incendios de Perú
          </Reveal>
          <div style={{ width: 120, height: 8, background: C.accent, marginTop: 36, transform: `scaleX(${interpolate(frame, [cue(9.86) + 10, cue(9.86) + 24], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE_OUT })})`, transformOrigin: "left" }} />
        </AbsoluteFill>
      )}

      {/* Armonización */}
      {frame >= split && (
        <>
          <div style={{ position: "absolute", left: EDGE, top: 120, ...title }}>
            <div style={{ fontSize: 68, fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1 }}>Dos satélites, una sola serie</div>
            <div style={{ fontSize: 32, fontWeight: 500, color: C.ink2, marginTop: 14 }}>Focos de calor de NASA FIRMS en Perú, 2000–2026</div>
          </div>
          <div
            style={{
              position: "absolute",
              left: EDGE,
              top: CHART_TOP,
              width: CROP.w * SCALE,
              height: CROP.h * SCALE,
              overflow: "hidden",
              clipPath: `inset(0 ${100 - chartWipe}% 0 0)`,
            }}
          >
            <Img
              src={staticFile("capturas/linea.png")}
              style={{ position: "absolute", left: -CROP.x * SCALE, top: -CROP.y * SCALE, width: 1920 * SCALE, height: 1080 * SCALE }}
            />
          </div>
          <Tag start={cue(12.05)} x={EDGE + 310} y={CHART_TOP + 222} color="#7E86A3">MODIS · desde 2000</Tag>
          <Tag start={cue(12.59)} x={EDGE + 715} y={CHART_TOP + 142} color="#C9CEDD">VIIRS · desde 2012</Tag>
          <Tag start={cue(13.78)} x={EDGE + 445} y={CHART_TOP + 36} color={C.accent}>Índice armonizado</Tag>

          <div style={{ position: "absolute", left: EDGE, top: 704, display: "flex", gap: 120 }}>
            <div style={figA}>
              <div style={{ fontSize: 120, fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>7,9×</div>
              <div style={{ fontSize: 32, fontWeight: 500, color: C.ink2, marginTop: 6 }}>más focos crudos al sumar VIIRS</div>
            </div>
            <div style={figB}>
              <div style={{ fontSize: 120, fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 1, color: C.accent, fontVariantNumeric: "tabular-nums" }}>0,95</div>
              <div style={{ fontSize: 32, fontWeight: 500, color: C.ink2, marginTop: 6 }}>con la serie armonizada: comparable</div>
            </div>
          </div>
        </>
      )}
    </AbsoluteFill>
  );
};
