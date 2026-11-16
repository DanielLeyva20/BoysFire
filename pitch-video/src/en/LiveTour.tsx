import type React from "react";
import { Video } from "@remotion/media";
import { AbsoluteFill, interpolate, Sequence, staticFile, useCurrentFrame } from "remotion";
import { C, EASE_OUT, at, fontFamily } from "../theme";
import { SPACE, Stars } from "./Space";

const START = at(14.81);
const cue = (s: number) => at(s) - START;
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const FRAME_W = 1500;
const SCALE = FRAME_W / 1920;

/** La app grabada en vivo, dentro de un navegador que entra girando en 3D. */
const BrowserClip: React.FC<{
  src: string;
  length: number;
  trimBefore: number;
  playbackRate: number;
  index: string;
  title: string;
  detail: string;
  children?: React.ReactNode;
}> = ({ src, length, trimBefore, playbackRate, index, title, detail, children }) => {
  const frame = useCurrentFrame();
  const enter = interpolate(frame, [0, 12], [0, 1], { ...clamp, easing: EASE_OUT });
  const drift = interpolate(frame, [0, length], [-7, 5]);
  const zoom = interpolate(frame, [0, length], [1, 1.05]);
  const chip = interpolate(frame, [4, 14], [0, 1], { ...clamp, easing: EASE_OUT });
  return (
    <AbsoluteFill style={{ perspective: 2200, fontFamily }}>
      <div
        style={{
          position: "absolute",
          left: (1920 - FRAME_W) / 2,
          top: 40,
          width: FRAME_W,
          transform: `translateX(${(1 - enter) * 700}px) rotateY(${drift + (1 - enter) * -38}deg) rotateX(4deg) scale(${zoom})`,
          filter: `blur(${(1 - enter) * 12}px)`,
          opacity: enter,
          borderRadius: 14,
          overflow: "hidden",
          border: "2px solid rgba(255,255,255,0.18)",
          background: "#1B2342",
        }}
      >
        <div style={{ height: 44, display: "flex", alignItems: "center", gap: 10, padding: "0 18px" }}>
          {["#FF5F57", "#FEBC2E", "#28C840"].map((c) => (
            <span key={c} style={{ width: 14, height: 14, borderRadius: 7, background: c }} />
          ))}
          <div style={{ marginLeft: 18, flex: 1, height: 28, borderRadius: 14, background: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.75)", fontSize: 18, display: "flex", alignItems: "center", paddingLeft: 16 }}>
            BoysFire · Wildfire almanac of Peru
          </div>
        </div>
        <div style={{ position: "relative", width: FRAME_W, height: 1080 * SCALE, overflow: "hidden" }}>
          <div style={{ width: 1920, height: 1080, transform: `scale(${SCALE})`, transformOrigin: "top left" }}>
            <Video src={staticFile(src)} trimBefore={trimBefore} playbackRate={playbackRate} muted style={{ width: 1920, height: 1080 }} />
          </div>
        </div>
      </div>
      <div style={{ position: "absolute", left: 120, top: 640, display: "flex", alignItems: "stretch", opacity: chip, transform: `translateY(${(1 - chip) * 24}px)` }}>
        <div style={{ background: C.ember, color: C.ink, fontSize: 48, fontWeight: 800, padding: "14px 22px", display: "flex", alignItems: "center" }}>{index}</div>
        <div style={{ background: C.ink, color: C.white, padding: "12px 26px 14px", border: "2px solid rgba(255,255,255,0.15)" }}>
          <div style={{ fontSize: 50, fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1.05 }}>{title}</div>
          <div style={{ fontSize: 30, fontWeight: 500, opacity: 0.8, marginTop: 4 }}>{detail}</div>
        </div>
      </div>
      {children}
    </AbsoluteFill>
  );
};

/** Aviso que llega por Telegram, con una vibración al entrar. */
const AlertCard: React.FC<{ start: number }> = ({ start }) => {
  const frame = useCurrentFrame();
  const p = interpolate(frame, [start, start + 12], [0, 1], { ...clamp, easing: EASE_OUT });
  const buzz = frame >= start + 10 && frame < start + 22 ? Math.sin((frame - start) * 2.4) * 3 : 0;
  return (
    <div
      style={{
        position: "absolute",
        right: 70,
        top: 250,
        width: 620,
        background: C.white,
        border: `3px solid ${C.ink}`,
        borderRadius: 16,
        padding: "22px 26px",
        fontFamily,
        color: C.ink,
        opacity: p,
        transform: `translateY(${(1 - p) * -80}px) rotate(${buzz}deg)`,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 26, fontWeight: 600, color: C.ink2 }}>
        <span>Alert sent to local contacts</span>
        <span>now</span>
      </div>
      <div style={{ fontSize: 38, fontWeight: 800, marginTop: 10, display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ width: 16, height: 16, borderRadius: 8, background: C.fire }} />
        Community report: smoke near Ica
      </div>
      <div style={{ fontSize: 30, fontWeight: 500, marginTop: 6 }}>
        Fire risk today: <b style={{ color: C.fire }}>HIGH</b> · 7 of 11
      </div>
      <div style={{ display: "flex", gap: 12, marginTop: 18 }}>
        {["Confirm", "On my way", "Dismiss"].map((label) => (
          <div key={label} style={{ flex: 1, textAlign: "center", fontSize: 28, fontWeight: 600, padding: "10px 0", borderRadius: 8, background: label === "Confirm" ? C.accent : C.paper3, color: label === "Confirm" ? C.white : C.ink }}>
            {label}
          </div>
        ))}
      </div>
    </div>
  );
};

/** Acto 3c: el sistema real en movimiento, un módulo por frase. */
export const LiveTour: React.FC = () => {
  const map = cue(16.13);
  const cal = cue(18.1);
  const risk = cue(20.18);
  const end = cue(22.43);
  return (
    <AbsoluteFill style={{ backgroundColor: SPACE }}>
      <Stars />
      <Sequence name="Live map" durationInFrames={map}>
        <BrowserClip src="clips/map.mp4" length={map} trimBefore={24} playbackRate={2} index="01" title="Live heat map" detail="Real NASA hotspots, day by day" />
      </Sequence>
      <Sequence name="Calendar" from={map} durationInFrames={cal - map}>
        <BrowserClip src="clips/calendar.mp4" length={cal - map} trimBefore={0} playbackRate={1.4} index="02" title="26 years, day by day" detail="Every day vs. its own normal" />
      </Sequence>
      <Sequence name="Risk forecast" from={cal} durationInFrames={risk - cal}>
        <BrowserClip src="clips/prevention.mp4" length={risk - cal} trimBefore={6} playbackRate={1.6} index="03" title="7-day risk forecast" detail="Live weather from Open-Meteo" />
      </Sequence>
      <Sequence name="Community alerts" from={risk} durationInFrames={end - risk}>
        <BrowserClip src="clips/report.mp4" length={end - risk} trimBefore={15} playbackRate={1.7} index="04" title="Community alerts" detail="Citizen reports + Telegram warnings">
          <AlertCard start={22} />
        </BrowserClip>
      </Sequence>
    </AbsoluteFill>
  );
};
