import { Composition, Still } from "remotion";
import { PitchEN } from "./en/PitchEN";
import { Thumbnail } from "./en/Thumbnail";
import { Pitch } from "./Pitch";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition id="BoysFirePitchEN" component={PitchEN} durationInFrames={903} fps={30} width={1920} height={1080} />
      <Composition id="BoysFirePitch" component={Pitch} durationInFrames={930} fps={30} width={1920} height={1080} />
      <Still id="Thumbnail" component={Thumbnail} width={1280} height={720} />
    </>
  );
};
