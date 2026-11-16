import { Easing } from "remotion";
import { loadFont } from "@remotion/google-fonts/Archivo";

/** Misma familia que la app: Archivo. */
export const { fontFamily } = loadFont("normal", {
  weights: ["500", "600", "800"],
  subsets: ["latin", "latin-ext"],
});

export const FPS = 30;
/** La voz empieza un poco después del primer cuadro. */
export const VOICE_OFFSET = 0.3;
/** Segundo de la narración → cuadro del video. */
export const at = (seconds: number) => Math.round((seconds + VOICE_OFFSET) * FPS);

/** Paleta de BoysFire (almanaque: papel, tinta, un acento ultramar) + rojo de noticiero. */
export const C = {
  paper: "#F6F8FC",
  paper3: "#E6EAF3",
  ink: "#141D38",
  ink2: "#3D4766",
  accent: "#2A44C9",
  fire: "#E8492E",
  ember: "#FFB547",
  low: "#2FB36B",
  white: "#FFFFFF",
  news: "#C8102E",
} as const;

export const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);
export const EASE_IN_OUT = Easing.bezier(0.77, 0, 0.175, 1);

/** Margen izquierdo común a todos los títulos. */
export const EDGE = 120;
