/**
 * Device capability detection and render quality tiers.
 * The game must hold 60fps on mid-range mobile, so we scale
 * pixel ratio, shadows, decoration density and particle budgets.
 */

export type Quality = 'low' | 'medium' | 'high';

export interface QualitySettings {
  pixelRatio: number;
  shadows: boolean;
  shadowMapSize: number;
  /** Multiplier for decoration scatter counts. */
  decorationDensity: number;
  /** Max live particles. */
  particleBudget: number;
}

export function isMobileDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Android|iPhone|iPad|iPod|Mobile|Silk/i.test(navigator.userAgent);
}

export function detectQuality(): Quality {
  if (typeof navigator === 'undefined') return 'high';
  const cores = navigator.hardwareConcurrency || 4;
  const mobile = isMobileDevice();
  if (mobile) {
    return cores >= 8 ? 'medium' : 'low';
  }
  return cores >= 4 ? 'high' : 'medium';
}

export function qualitySettings(q: Quality): QualitySettings {
  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
  switch (q) {
    case 'low':
      return {
        pixelRatio: Math.min(dpr, 1.25),
        shadows: false,
        shadowMapSize: 512,
        decorationDensity: 0.4,
        particleBudget: 400,
      };
    case 'medium':
      return {
        pixelRatio: Math.min(dpr, 1.5),
        shadows: true,
        shadowMapSize: 1024,
        decorationDensity: 0.7,
        particleBudget: 900,
      };
    case 'high':
    default:
      return {
        pixelRatio: Math.min(dpr, 2),
        shadows: true,
        shadowMapSize: 2048,
        decorationDensity: 1,
        particleBudget: 1600,
      };
  }
}
