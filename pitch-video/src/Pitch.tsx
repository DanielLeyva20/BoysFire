import { Audio } from "@remotion/media";
import { AbsoluteFill, Sequence, staticFile } from "remotion";
import { Captions } from "./components/Captions";
import words from "./data/words.json";
import { BrandMerge } from "./scenes/BrandMerge";
import { Closing } from "./scenes/Closing";
import { NewsOpen } from "./scenes/NewsOpen";
import { ProductTour } from "./scenes/ProductTour";
import { Statement } from "./scenes/Statement";
import { VOICE_OFFSET, FPS } from "./theme";

/** Pitch de BoysFire (31 s). Cada escena empieza cuando la voz llega a su frase. */
export const Pitch: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: "#000" }}>
    <Sequence name="1 · Noticiero" from={0} durationInFrames={195}>
      <NewsOpen />
    </Sequence>
    <Sequence name="2 · Frase" from={195} durationInFrames={86}>
      <Statement />
    </Sequence>
    <Sequence name="3 · BoysFire y armonización" from={281} durationInFrames={197}>
      <BrandMerge />
    </Sequence>
    <Sequence name="4 · El sistema" from={478} durationInFrames={232}>
      <ProductTour />
    </Sequence>
    <Sequence name="5 · Cierre" from={710} durationInFrames={220}>
      <Closing />
    </Sequence>

    <Sequence name="Voz en off" from={Math.round(VOICE_OFFSET * FPS)} layout="none">
      <Audio src={staticFile("voz.mp3")} />
    </Sequence>

    {/* En la frase, la marca y el cierre el texto grande ya es la narración: ahí no hay subtítulos. */}
    <Captions words={words} sizes={[4, 4, 3, 3, 3, 6, 4, 6, 3, 5, 6, 6, 6, 7]} hidden={[[195, 337], [710, 930]]} />
  </AbsoluteFill>
);
