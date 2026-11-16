import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { Embers } from "../components/Embers";
import { C, EASE_OUT, EDGE, at, fontFamily } from "../theme";

const START = at(5.4);
const cue = (s: number) => at(s) - START;
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** Cada palabra cae en su sitio con desenfoque y un leve giro, escalonada. */
const Words: React.FC<{ text: string; start: number; color?: string }> = ({ text, start, color = C.white }) => {
  const frame = useCurrentFrame();
  return (
    <div style={{ display: "flex", gap: "0.24em", fontSize: 150, fontWeight: 800, letterSpacing: "-0.045em", lineHeight: 1.02, color }}>
      {text.split(" ").map((word, i) => {
        const p = interpolate(frame, [start + i * 3, start + i * 3 + 14], [0, 1], { ...clamp, easing: EASE_OUT });
        return (
          <span key={i} style={{ display: "inline-block", overflow: "hidden", paddingBottom: "0.08em" }}>
            <span style={{ display: "inline-block", transform: `translateY(${(1 - p) * 110}%) rotate(${(1 - p) * 8}deg)`, filter: `blur(${(1 - p) * 10}px)`, opacity: p > 0 ? 1 : 0 }}>
              {word}
            </span>
          </span>
        );
      })}
    </div>
  );
};

/** Acto 2: la idea en una frase, sobre las brasas que quedan del noticiero. */
export const StatementEN: React.FC = () => {
  const frame = useCurrentFrame();
  const enter = interpolate(frame, [0, 8], [1.12, 1], { ...clamp, easing: EASE_OUT });
  const underline = interpolate(frame, [cue(7.84), cue(7.84) + 12], [0, 1], { ...clamp, easing: EASE_OUT });
  return (
    <AbsoluteFill style={{ backgroundColor: C.ink, fontFamily }}>
      <Embers count={40} opacity={0.55} speed={0.7} />
      <AbsoluteFill style={{ justifyContent: "center", paddingLeft: EDGE, transform: `scale(${enter})`, transformOrigin: "left center" }}>
        <Words text="In a wildfire," start={0} color="rgba(255,255,255,0.7)" />
        <Words text="timely information" start={cue(6.4)} />
        <div style={{ position: "relative", alignSelf: "flex-start" }}>
          <Words text="saves lives." start={cue(7.46)} color={C.ember} />
          <div style={{ position: "absolute", left: 0, bottom: -6, width: "100%", height: 12, background: C.ember, transform: `scaleX(${underline})`, transformOrigin: "left" }} />
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
