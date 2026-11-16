import { AbsoluteFill, Img, interpolate, Sequence, staticFile, useCurrentFrame } from "remotion";
import { useEnter } from "../components/Reveal";
import { C, EASE_OUT, at, fontFamily } from "../theme";

const START = at(15.63);
const cue = (seconds: number) => at(seconds) - START;

/** Captura real de la app a pantalla completa, con un acercamiento lento. */
const Shot: React.FC<{
  src: string;
  length: number;
  origin: string;
  from: number;
  to: number;
  index: string;
  title: string;
  detail: string;
  children?: React.ReactNode;
}> = ({ src, length, origin, from, to, index, title, detail, children }) => {
  const frame = useCurrentFrame();
  const zoom = interpolate(frame, [0, length], [from, to], { easing: EASE_OUT });
  const chip = useEnter(2, 10, 14);
  return (
    <AbsoluteFill style={{ backgroundColor: C.paper, fontFamily }}>
      <AbsoluteFill style={{ transform: `scale(${zoom})`, transformOrigin: origin }}>
        <Img src={staticFile(src)} style={{ width: 1920, height: 1080 }} />
        {children}
      </AbsoluteFill>
      <div style={{ position: "absolute", left: 48, top: 112, display: "flex", alignItems: "stretch", ...chip }}>
        <div style={{ background: C.accent, color: C.white, fontSize: 44, fontWeight: 800, padding: "14px 22px", display: "flex", alignItems: "center", fontVariantNumeric: "tabular-nums" }}>
          {index}
        </div>
        <div style={{ background: C.ink, color: C.white, padding: "12px 26px 14px" }}>
          <div style={{ fontSize: 48, fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1.05 }}>{title}</div>
          <div style={{ fontSize: 30, fontWeight: 500, opacity: 0.8, marginTop: 4 }}>{detail}</div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

/** Pin del reporte comunitario cayendo sobre Ica, con su onda. */
const ReportPin: React.FC = () => {
  const frame = useCurrentFrame();
  const drop = interpolate(frame, [4, 14], [-80, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE_OUT });
  const ring = interpolate(frame, [14, 40], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <div style={{ position: "absolute", left: 690, top: 812 }}>
      <div style={{ position: "absolute", left: -60 * ring, top: -60 * ring, width: 120 * ring, height: 120 * ring, borderRadius: "50%", border: `4px solid ${C.fire}`, opacity: 1 - ring }} />
      <div style={{ position: "absolute", left: -18, top: -48 + drop, width: 36, height: 36, borderRadius: "50% 50% 50% 0", transform: "rotate(-45deg)", background: C.fire, border: `4px solid ${C.white}`, opacity: frame >= 4 ? 1 : 0 }} />
    </div>
  );
};

/** Aviso que llega por Telegram a los responsables de la zona. */
const AlertCard: React.FC = () => {
  const frame = useCurrentFrame();
  const p = interpolate(frame, [16, 30], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE_OUT });
  return (
    <div
      style={{
        position: "absolute",
        left: 880,
        top: 380,
        width: 600,
        background: C.white,
        border: `2px solid ${C.ink}`,
        borderRadius: 14,
        padding: "22px 26px",
        fontFamily,
        color: C.ink,
        opacity: p,
        transform: `translateX(${(1 - p) * 120}px) scale(${0.96 + 0.04 * p})`,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 26, fontWeight: 600, color: C.ink2 }}>
        <span>Telegram · BoysFire Alertas</span>
        <span>ahora</span>
      </div>
      <div style={{ fontSize: 36, fontWeight: 800, marginTop: 10, display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ width: 16, height: 16, borderRadius: 8, background: C.fire }} />
        Reporte: humo cerca de Ica
      </div>
      <div style={{ fontSize: 30, fontWeight: 500, marginTop: 6 }}>
        Riesgo de incendio hoy: <b style={{ color: C.fire }}>ALTO</b> · 7 de 11
      </div>
      <div style={{ display: "flex", gap: 12, marginTop: 18 }}>
        {["Confirmo", "Voy a revisar", "Descartar"].map((label) => (
          <div key={label} style={{ flex: 1, textAlign: "center", fontSize: 28, fontWeight: 600, padding: "10px 0", borderRadius: 8, background: label === "Confirmo" ? C.accent : C.paper3, color: label === "Confirmo" ? C.white : C.ink }}>
            {label}
          </div>
        ))}
      </div>
    </div>
  );
};

/** Acto 3b: el sistema real, módulo por módulo, cada uno cuando la voz lo nombra. */
export const ProductTour: React.FC = () => {
  const mapEnd = cue(17.46);
  const calEnd = cue(19.45);
  const prevEnd = cue(21.16);
  const end = at(23.36) - START;
  return (
    <AbsoluteFill>
      <Sequence name="Mapa" durationInFrames={mapEnd}>
        <Shot src="capturas/mapa.png" length={mapEnd} origin="680px 560px" from={1} to={1.16} index="01" title="Mapa de calor" detail="Focos satelitales por región" />
      </Sequence>
      <Sequence name="Calendario" from={mapEnd} durationInFrames={calEnd - mapEnd}>
        <Shot src="capturas/calendario.png" length={calEnd - mapEnd} origin="960px 470px" from={1.06} to={1.2} index="02" title="Calendario histórico" detail="Cada día frente a su normal, desde 2000" />
      </Sequence>
      <Sequence name="Prevención" from={calEnd} durationInFrames={prevEnd - calEnd}>
        <Shot src="capturas/prevencion.png" length={prevEnd - calEnd} origin="1250px 420px" from={1} to={1.1} index="03" title="Prevención" detail="Riesgo con el clima de los próximos 7 días" />
      </Sequence>
      <Sequence name="Alertas" from={prevEnd} durationInFrames={end - prevEnd}>
        <Shot src="capturas/reportar.png" length={end - prevEnd} origin="700px 800px" from={1} to={1.04} index="04" title="Alertas a la comunidad" detail="Reportes ciudadanos y avisos por Telegram">
          <ReportPin />
        </Shot>
        <AlertCard />
      </Sequence>
    </AbsoluteFill>
  );
};
