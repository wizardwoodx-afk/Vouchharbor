/**
 * The Generalist's face — 19.5.0 "The Face".
 *
 * Renders the real OneWorks Avatar engine (vendored, MIT — see
 * src/vendor/oneworks-avatar/NOTICE.md) as the Generalist's living face:
 * a barn owl, in the VH light system, whose posture follows engine state.
 * Users SEE the Generalist work instead of only reading text.
 *
 * SSR-safe: the renderer is browser-only, so it is lazy-loaded after mount.
 * Server-rendered surfaces (the door probe) get the deterministic VH seal
 * face — honest fallback, never a crash.
 *
 * Honest boundary: the face presents engine state. Receipts remain evidence.
 */
import React, { Suspense, useEffect, useRef, useState } from "react";
import { VhAvatar } from "./avatar";

export type GeneralistMood = "idle" | "thinking" | "acting" | "gate" | "sealed" | "refused";

const MOOD_CAPTION: Record<GeneralistMood, string> = {
  idle: "the Generalist is listening",
  thinking: "routing to the bench…",
  acting: "specialists at work",
  gate: "waiting for your approval",
  sealed: "receipt sealed",
  refused: "nothing was executed",
};

/* Loaded after mount — the OneWorks renderer needs a real browser surface. */
interface FaceEngine {
  InteractiveAvatar: React.ComponentType<Record<string, unknown>>;
  definition: import("../vendor/oneworks-avatar/core/index").AvatarDefinition;
  parts: readonly unknown[];
  decals: readonly unknown[];
  palette: unknown;
  faceStyle: unknown;
}

async function loadFaceEngine(): Promise<FaceEngine> {
  const [{ InteractiveAvatar }, core, nativePreset, geometry] = await Promise.all([
    import("../vendor/oneworks-avatar/InteractiveAvatar"),
    import("../vendor/oneworks-avatar/core/index"),
    import("../vendor/oneworks-avatar/native-preset"),
    import("../vendor/oneworks-avatar/avatarGeometry"),
  ]);
  const d = core.createDefaultAvatarDefinition();
  const definition = {
    ...d,
    scene: {
      ...d.scene,
      appearance: { ...d.scene.appearance, paletteId: "barn-owl", bodyShape: "sphere" },
      camera: { ...d.scene.camera, background: "#d8d5db" },
      effects: {
        ...d.scene.effects,
        outline: { color: "#2d3142", opacity: 32, width: 3 },
        avatarShadow: { color: "#2d3142", direction: 90, distance: 10, opacity: 16, softness: 18 },
        showOutline: true,
        showAvatarShadow: true,
      },
      entity: { ...d.scene.entity, preset: "owl" },
    },
  } as FaceEngine["definition"];
  const native = nativePreset.resolveNativeAvatarPreset(definition);
  return {
    InteractiveAvatar: InteractiveAvatar as unknown as React.ComponentType<Record<string, unknown>>,
    definition,
    parts: native.parts,
    decals: native.decals,
    palette: core.getAvatarPalette("barn-owl"),
    faceStyle: geometry.resolveAvatarFaceStyle(definition.scene.face),
  };
}

const BASE_VIEW = { pitch: 0, positionX: 0, positionY: 0, roll: 0, scale: 1.22, yaw: 0 };

export interface GeneralistFaceProps {
  mood: GeneralistMood;
  size?: number;
}

/**
 * <GeneralistFace/> — the owl that fronts the VH-19 door.
 * Subtle posture animation per mood; prefers-reduced-motion stays still.
 */
export function GeneralistFace({ mood, size = 150 }: GeneralistFaceProps): React.ReactElement {
  const [engine, setEngine] = useState<FaceEngine | null>(null);
  const [view, setView] = useState(BASE_VIEW);
  const frame = useRef(0);

  useEffect(() => {
    let alive = true;
    loadFaceEngine().then((e) => { if (alive) setEngine(e); }).catch(() => undefined);
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    let live = true;
    const t0 = performance.now();
    const tick = (now: number) => {
      if (!live) return;
      const t = (now - t0) / 1000;
      if (mood === "thinking" || mood === "acting") {
        setView({ ...BASE_VIEW, yaw: Math.sin(t * 1.4) * 14, pitch: Math.sin(t * 0.9) * 4 - 2, scale: 1.26 });
      } else if (mood === "gate") {
        setView({ ...BASE_VIEW, pitch: -4, scale: 1.3 });
      } else if (mood === "sealed") {
        setView({ ...BASE_VIEW, pitch: 3, scale: 1.24 });
      } else if (mood === "refused") {
        setView({ ...BASE_VIEW, scale: 1.14, pitch: 2 });
      } else {
        setView({ ...BASE_VIEW, pitch: Math.sin(t * 0.7) * 1.6, scale: 1.22 + Math.sin(t * 0.7) * 0.012 });
      }
      frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
    return () => { live = false; cancelAnimationFrame(frame.current); };
  }, [mood]);

  const caption = MOOD_CAPTION[mood];

  if (!engine) {
    // SSR / engine loading — the deterministic VH seal face stands in.
    return (
      <div className={`vh-face vh-face--${mood}`} style={{ width: size }} role="img" aria-label={`the Generalist — ${caption}`}>
        <div className="vh-face-render vh-face-render--seal" style={{ width: size, height: size, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <VhAvatar seed="vh-generalist" name="the Generalist" size={Math.round(size * 0.72)} state={mood === "gate" ? "gate" : mood === "refused" ? "refused" : mood === "sealed" ? "sealed" : "idle"} />
        </div>
        <div className="vh-face-caption">{caption}</div>
      </div>
    );
  }

  const Ia = engine.InteractiveAvatar;
  return (
    <div className={`vh-face vh-face--${mood}`} style={{ width: size }} role="img" aria-label={`the Generalist — ${caption}`}>
      <div className="vh-face-render" style={{ width: size, height: size }}>
        <Suspense fallback={null}>
          <Ia
            auxiliaryParts={[]}
            auxiliaryShapes={[]}
            backgroundStyle="solid"
            bodyShape={engine.definition.scene.appearance.bodyShape}
            canvasBackgroundColor="#d8d5db"
            entityParts={engine.parts}
            faceStyle={engine.faceStyle}
            interactive={false}
            interactionMode="rotate"
            lightDirection={{ azimuth: -35, elevation: 40 }}
            onViewStateChange={() => undefined}
            palette={engine.palette}
            shadowStyle={engine.definition.scene.effects.faceShadow}
            showLight={false}
            showOutline={engine.definition.scene.effects.showOutline}
            showAvatarShadow={engine.definition.scene.effects.showAvatarShadow}
            showShadow={engine.definition.scene.effects.showFaceShadow}
            avatarOutlineStyle={engine.definition.scene.effects.outline}
            avatarShadowStyle={engine.definition.scene.effects.avatarShadow}
            surfaceDecals={engine.decals}
            viewState={view}
          />
        </Suspense>
      </div>
      <div className="vh-face-caption">{caption}</div>
    </div>
  );
}

export default GeneralistFace;
