import type React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { EASE_OUT } from "../theme";

/** Texto que sube desde una máscara en el cuadro `start` (relativo a la escena). */
export const Reveal: React.FC<{
  start: number;
  children: React.ReactNode;
  style?: React.CSSProperties;
  duration?: number;
}> = ({ start, children, style, duration = 14 }) => {
  const frame = useCurrentFrame();
  const p = interpolate(frame, [start, start + duration], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE_OUT,
  });
  return (
    <div style={{ overflow: "hidden", paddingBottom: "0.08em", ...style }}>
      <div style={{ transform: `translateY(${(1 - p) * 105}%)`, opacity: p > 0 ? 1 : 0 }}>{children}</div>
    </div>
  );
};

/** Aparición suave (opacidad + desplazamiento corto). */
export const useEnter = (start: number, duration = 12, distance = 24) => {
  const frame = useCurrentFrame();
  const p = interpolate(frame, [start, start + duration], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE_OUT,
  });
  return { opacity: p, transform: `translateY(${(1 - p) * distance}px)` };
};
