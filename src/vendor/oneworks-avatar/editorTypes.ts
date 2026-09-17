/**
 * Type shims for the vendored OneWorks Avatar engine (MIT).
 * The originals live in the editor UI (AvatarControls.tsx / ExportToolbar.tsx);
 * VH vendors only the engine, so the two shared types are mirrored here verbatim.
 */
export type AvatarCameraFrame = 'circle' | 'rounded' | 'square';
export const EXPORT_SIZES = [128, 256, 512] as const;
export type ExportSize = (typeof EXPORT_SIZES)[number];

/* Mirrored from InteractiveAvatar.tsx (editor shell, not vendored) — types only. */
export type AvatarInteractionMode = 'move' | 'rotate';
export interface AvatarDropShadowStyle {
  readonly color?: string;
  readonly direction: number;
  readonly distance: number;
  readonly opacity: number;
  readonly softness: number;
}
export interface AvatarOutlineStyle {
  readonly color: string;
  readonly opacity: number;
  readonly width: number;
}
export interface AvatarViewState {
  readonly pitch: number;
  readonly positionX: number;
  readonly positionY: number;
  readonly roll: number;
  readonly scale: number;
  readonly yaw: number;
}
