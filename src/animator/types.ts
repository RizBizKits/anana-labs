export type AnimId =
  | "idle"
  | "walk"
  | "thinking"
  | "success"
  | "error";

export interface Vec2 {
  x: number;
  y: number;
}

export interface LayerPose {
  x: number;
  y: number;
  rot: number;
  sx: number;
  sy: number;
}

export interface CharacterPose {
  body: LayerPose;
  armL: LayerPose;
  armR: LayerPose;
}

export interface AnimPreset {
  id: AnimId;
  label: string;
  /** Suggested loop length in seconds. */
  durationSec: number;
  /** Default frame count when generating a sheet. */
  defaultFrames: number;
}

export interface FrameRect {
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  durationMs: number;
}

export interface SpritesheetAtlas {
  meta: {
    image: string;
    size: { w: number; h: number };
    frameSize: { w: number; h: number };
    animation: string;
    frameCount: number;
    fps: number;
    columns: number;
    rows: number;
    generator: string;
  };
  frames: FrameRect[];
}

export interface PackedSpritesheet {
  canvas: HTMLCanvasElement;
  atlas: SpritesheetAtlas;
  frames: HTMLCanvasElement[];
}
