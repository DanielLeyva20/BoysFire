import { Audio } from "@remotion/media";
import { AbsoluteFill, Sequence, staticFile } from "remotion";
import { Captions } from "../components/Captions";
import words from "../data/words-en.json";
import { FPS, VOICE_OFFSET } from "../theme";
import { ClosingEN } from "./ClosingEN";
import { LiveTour } from "./LiveTour";
import { NewsOpenEN } from "./NewsOpenEN";
import { SatelliteScan } from "./SatelliteScan";
import { SoundDesign } from "./SoundDesign";
import { LogoBurst } from "./Space";
import { StatementEN } from "./StatementEN";

/** BoysFire pitch in English (30 s). Every scene starts on the narration line that names it. */
export const PitchEN: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: "#000" }}>
    <Sequence name="1 · Breaking news" from={0} durationInFrames={171}>
      <NewsOpenEN />
    </Sequence>
    <Sequence name="2 · Statement" from={171} durationInFrames={94}>
      <StatementEN />
    </Sequence>
    <Sequence name="3 · Logo burst" from={265} durationInFrames={59}>
      <LogoBurst />
    </Sequence>
    <Sequence name="4 · Satellite scan" from={324} durationInFrames={129}>
      <SatelliteScan />
    </Sequence>
    <Sequence name="5 · Live product tour" from={453} durationInFrames={229}>
      <LiveTour />
    </Sequence>
    <Sequence name="6 · Closing" from={682} durationInFrames={221}>
      <ClosingEN />
    </Sequence>

    <SoundDesign />
    <Sequence name="Voiceover" from={Math.round(VOICE_OFFSET * FPS)} layout="none">
      <Audio src={staticFile("voice-en.mp3")} volume={1} />
    </Sequence>

    {/* No captions where the big type already is the narration. */}
    <Captions words={words} sizes={[7, 3, 5, 3, 4, 5, 7, 4, 6, 6, 6, 6, 6, 4, 4]} hidden={[[171, 324], [682, 903]]} />
  </AbsoluteFill>
);
