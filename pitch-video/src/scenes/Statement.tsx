import { AbsoluteFill } from "remotion";
import { Reveal } from "../components/Reveal";
import { C, EDGE, at, fontFamily } from "../theme";

const START = at(6.2);
const big: React.CSSProperties = { fontSize: 128, fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 1 };

/** Acto 2: la idea en una frase. Cada parte entra cuando la voz la dice. */
export const Statement: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: C.ink, fontFamily, color: C.white, justifyContent: "center", paddingLeft: EDGE }}>
    <Reveal start={at(6.2) - START} style={{ ...big, color: "rgba(255,255,255,0.72)" }}>
      En un incendio,
    </Reveal>
    <Reveal start={at(7.07) - START} style={big}>
      la información a tiempo
    </Reveal>
    <Reveal start={at(8.08) - START} style={{ ...big, color: C.ember }}>
      salva vidas.
    </Reveal>
  </AbsoluteFill>
);
