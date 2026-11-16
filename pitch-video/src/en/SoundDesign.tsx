import { Audio } from "@remotion/media";
import { interpolate, Sequence, staticFile } from "remotion";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** Volumen de la música: sube donde no hay voz y baja mientras se habla, para que la narración se entienda. */
const UNDER_VOICE = 0.12;

/** Un efecto corto en un cuadro exacto. */
const Sfx: React.FC<{ name: string; at: number; file: string; volume: number }> = ({ name, at, file, volume }) => (
  <Sequence name={name} from={at} layout="none">
    <Audio src={staticFile(`sfx/${file}.mp3`)} volume={volume} />
  </Sequence>
);

/** Música de fondo y efectos, sincronizados con las escenas de PitchEN (30 fps, 903 cuadros). */
export const SoundDesign: React.FC = () => (
  <>
    {/* Fondo tenso: el problema (noticiero y frase) */}
    <Sequence name="Music · tense" from={0} durationInFrames={330} layout="none">
      <Audio
        src={staticFile("sfx/bed_tense.mp3")}
        volume={(f) => interpolate(f, [0, 6, 12, 300, 330], [0, 0.4, UNDER_VOICE, UNDER_VOICE, 0], clamp)}
      />
    </Sequence>
    {/* Fondo esperanzador: la solución, sube en la tarjeta final */}
    <Sequence name="Music · hopeful" from={262} durationInFrames={641} layout="none">
      <Audio
        src={staticFile("sfx/bed_hope.mp3")}
        volume={(f) => interpolate(f, [0, 24, 551, 566, 616, 641], [0, UNDER_VOICE, UNDER_VOICE, 0.45, 0.45, 0], clamp)}
      />
    </Sequence>

    {/* Noticiero */}
    <Sequence name="Fire crackle" from={0} durationInFrames={171} layout="none">
      <Audio src={staticFile("sfx/crackle.mp3")} volume={(f) => interpolate(f, [0, 8, 140, 171], [0, 0.32, 0.25, 0], clamp)} />
    </Sequence>
    <Sfx name="News sting" at={2} file="sting" volume={0.5} />
    <Sfx name="Photo cut flash" at={68} file="flash" volume={0.6} />
    <Sfx name="Into statement" at={163} file="whoosh" volume={0.55} />

    {/* Marca */}
    <Sfx name="Logo riser" at={258} file="riser" volume={0.45} />
    <Sfx name="Logo boom" at={293} file="boom" volume={0.75} />

    {/* Satélites */}
    <Sfx name="Into satellites" at={321} file="whoosh" volume={0.45} />
    <Sfx name="MODIS scan" at={353} file="scan" volume={0.4} />
    <Sfx name="VIIRS scan" at={369} file="scan" volume={0.4} />
    <Sfx name="Data merge" at={400} file="merge" volume={0.5} />

    {/* Recorrido por la app */}
    <Sfx name="Into live tour" at={450} file="whoosh" volume={0.45} />
    <Sfx name="Calendar in" at={490} file="whoosh" volume={0.35} />
    <Sfx name="Forecast in" at={550} file="whoosh" volume={0.35} />
    <Sfx name="Alerts in" at={611} file="whoosh" volume={0.35} />
    <Sfx name="Alert notification" at={635} file="notify" volume={0.65} />

    {/* Cierre */}
    <Sfx name="Into closing" at={679} file="whoosh" volume={0.45} />
    <Sfx name="Shield swell" at={742} file="swell" volume={0.45} />
    <Sfx name="End card hit" at={812} file="endhit" volume={0.75} />
  </>
);
