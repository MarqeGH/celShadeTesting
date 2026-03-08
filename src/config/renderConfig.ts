// Centralized rendering configuration.
// Resolution, shadows, outlines, post-processing, and cel-shading tuning.

export const RENDER_CONFIG = {
  // ── Resolution ──────────────────────────────────────────────
  resolution: {
    pixelRatioScale: 1.0,
  },

  // ── Clear / Background ──────────────────────────────────────
  clearColor: 0x1a1a1a,

  // ── Cel-Shading Ramp ────────────────────────────────────────
  celShading: {
    lightDirection: { x: 0.5, y: 1.0, z: 0.3 },
    ambientColor: { r: 0.08, g: 0.08, b: 0.12 },
    rampThresholds: [0.6, 0.2, -0.1] as const,
    rampIntensities: [1.1, 0.85, 0.6, 0.35] as const,
  },

  // ── Outline ─────────────────────────────────────────────────
  outline: {
    width: 2.0,
    depthThreshold: 0.15,
    normalThreshold: 0.5,
  },

  // ── Camera Clipping ─────────────────────────────────────────
  camera: {
    near: 0.1,
    far: 1000.0,
  },

  // ── Post-Processing Toggles ─────────────────────────────────
  postProcessing: {
    enabled: true,
    outlineEnabled: true,
    vignetteEnabled: true,
  },
} as const;

export type RenderConfig = typeof RENDER_CONFIG;
