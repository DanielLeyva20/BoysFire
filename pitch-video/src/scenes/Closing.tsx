import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { Reveal, useEnter } from "../components/Reveal";
import { C, EDGE, at, fontFamily } from "../theme";

const START = at(23.36);
const cue = (seconds: number) => at(seconds) - START;
/** Cuando termina la voz, corte a la tarjeta final. */
export const END_CARD = at(27.96) - START;

const line: React.CSSProperties = { fontSize: 112, fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 1 };

/** Órbitas de satélite dibujadas como fondo: el motivo del cierre. */
const Orbits: React.FC = () => {
  const frame = useCurrentFrame();
  const angle = frame / 40;
  const rx = 1100;
  const ry = 300;
  const x = 960 + rx * Math.cos(angle);
  const y = 620 + ry * Math.sin(angle);
  return (
    <svg width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
      <g transform="rotate(-12 960 620)" fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth={2}>
        <ellipse cx={960} cy={620} rx={rx} ry={ry} />
        <ellipse cx={960} cy={620} rx={rx * 0.78} ry={ry * 0.7} />
        <circle cx={x} cy={y} r={10} fill={C.ember} stroke="none" />
      </g>
    </svg>
  );
};

/** Acto 4: la promesa, y la tarjeta final con la marca. */
export const Closing: React.FC = () => {
  const frame = useCurrentFrame();
  const second = cue(25.65);
  const firstOut = interpolate(frame, [second - 6, second], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const meta = useEnter(END_CARD + 12, 12, 12);
  const credit = useEnter(END_CARD + 20, 12, 8);

  if (frame >= END_CARD) {
    return (
      <AbsoluteFill style={{ backgroundColor: C.ink, fontFamily, color: C.white, justifyContent: "center", paddingLeft: EDGE }}>
        <Reveal start={END_CARD + 2} style={{ fontSize: 236, fontWeight: 800, letterSpacing: "0.01em", lineHeight: 0.95 }}>
          BOYSFIRE
        </Reveal>
        <div style={{ ...meta, fontSize: 48, fontWeight: 500, marginTop: 20, color: "rgba(255,255,255,0.8)" }}>
          Almanaque de incendios de Perú
        </div>
        <div style={{ ...meta, width: 120, height: 8, background: C.ember, marginTop: 40 }} />
        <div style={{ ...credit, fontSize: 36, fontWeight: 600, marginTop: 40 }}>NASA Space Apps Challenge · Reto 09</div>
        <div style={{ ...credit, fontSize: 30, fontWeight: 500, marginTop: 10, color: "rgba(255,255,255,0.72)" }}>
          Datos: NASA FIRMS (MODIS · VIIRS) · Open-Meteo
        </div>
      </AbsoluteFill>
    );
  }

  return (
    <AbsoluteFill style={{ backgroundColor: C.accent, fontFamily, color: C.white }}>
      <Orbits />
      <AbsoluteFill style={{ justifyContent: "center", paddingLeft: EDGE }}>
        {frame < second ? (
          <div style={{ opacity: firstOut }}>
            <Reveal start={0} style={line}>Convertimos los ojos</Reveal>
            <Reveal start={cue(24.38)} style={line}>de la NASA en el espacio</Reveal>
          </div>
        ) : (
          <div>
            <Reveal start={second} style={line}>
              en el <span style={{ color: C.ember }}>escudo</span> que protege
            </Reveal>
            <Reveal start={cue(26.73)} style={line}>a nuestras familias</Reveal>
            <Reveal start={cue(27.47)} style={line}>en la Tierra.</Reveal>
          </div>
        )}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
