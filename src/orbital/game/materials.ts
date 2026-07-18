/**
 * Shared materials derived from the biome palette.
 * Flat + emissive: cheap to render, pure neon minimalism.
 */

import * as THREE from 'three';
import type { PowerupType } from './types';

export interface BiomePalette {
  track: string;
  trackSide: string;
  edge: string;
  accent: string;
  hazard: string;
  shard: string;
}

export interface Materials {
  track: THREE.MeshStandardMaterial;
  trackSide: THREE.MeshStandardMaterial;
  edge: THREE.MeshStandardMaterial;
  accent: THREE.MeshStandardMaterial;
  hazard: THREE.MeshStandardMaterial;
  checkpoint: THREE.MeshStandardMaterial;
  checkpointOn: THREE.MeshStandardMaterial;
  shard: THREE.MeshStandardMaterial;
  slick: THREE.MeshStandardMaterial;
  power: Record<PowerupType, THREE.MeshStandardMaterial>;
}

function emissive(hex: string, intensity = 1.6): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: '#050505',
    emissive: new THREE.Color(hex),
    emissiveIntensity: intensity,
    roughness: 0.6,
    metalness: 0.1,
  });
}

export function buildMaterials(p: BiomePalette): Materials {
  return {
    track: new THREE.MeshStandardMaterial({ color: p.track, roughness: 0.92, metalness: 0.05 }),
    trackSide: new THREE.MeshStandardMaterial({ color: p.trackSide, roughness: 0.95, metalness: 0.02 }),
    edge: emissive(p.edge, 2.2),
    accent: emissive(p.accent, 1.8),
    hazard: emissive(p.hazard, 2.4),
    checkpoint: emissive(p.edge, 1.2),
    checkpointOn: emissive('#4ade80', 2.6),
    shard: emissive(p.shard, 2.4),
    slick: new THREE.MeshStandardMaterial({
      color: p.track,
      roughness: 0.15,
      metalness: 0.35,
      transparent: true,
      opacity: 0.92,
    }),
    power: {
      boost: emissive('#22d3ee', 2.4),
      shield: emissive('#fbbf24', 2.4),
      magnet: emissive('#a78bfa', 2.4),
      slow: emissive('#f0abfc', 2.4),
      anchor: emissive('#4ade80', 2.4),
    },
  };
}
