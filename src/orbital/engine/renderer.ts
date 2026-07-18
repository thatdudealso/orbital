/**
 * Rendering stage: WebGL renderer, scene, camera, lights, gradient sky dome.
 * Minimal flat-neon look: hemisphere + one shadow-casting directional,
 * fog for depth, emissive materials do the neon work.
 */

import * as THREE from 'three';
import type { QualitySettings } from './quality';

export interface SkySpec {
  top: string;
  bottom: string;
  fogColor: string;
  fogDensity: number;
}

const SKY_VERT = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    vec4 pos = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_Position = pos.xyww; // pin to far plane
  }
`;

const SKY_FRAG = /* glsl */ `
  varying vec3 vDir;
  uniform vec3 uTop;
  uniform vec3 uBottom;
  void main() {
    float h = clamp(vDir.y * 0.5 + 0.5, 0.0, 1.0);
    vec3 col = mix(uBottom, uTop, pow(h, 0.8));
    gl_FragColor = vec4(col, 1.0);
  }
`;

export class Stage {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  readonly dirLight: THREE.DirectionalLight;
  private readonly hemi: THREE.HemisphereLight;
  private sky: THREE.Mesh | null = null;

  constructor(canvas: HTMLCanvasElement, qs: QualitySettings) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
      stencil: false,
    });
    this.renderer.setPixelRatio(qs.pixelRatio);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = qs.shadows;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(62, 1, 0.1, 900);
    this.camera.position.set(0, 6, 10);

    this.hemi = new THREE.HemisphereLight(0xbfd8ff, 0x1a2420, 1.05);
    this.scene.add(this.hemi);

    this.dirLight = new THREE.DirectionalLight(0xffffff, 1.9);
    this.dirLight.position.set(24, 48, 18);
    if (qs.shadows) {
      this.dirLight.castShadow = true;
      this.dirLight.shadow.mapSize.set(qs.shadowMapSize, qs.shadowMapSize);
      const s = 42;
      const cam = this.dirLight.shadow.camera;
      cam.left = -s; cam.right = s; cam.top = s; cam.bottom = -s;
      cam.near = 4; cam.far = 140;
      this.dirLight.shadow.bias = -0.0006;
    }
    this.scene.add(this.dirLight);
    this.scene.add(this.dirLight.target);
  }

  setSky(spec: SkySpec): void {
    if (this.sky) {
      this.scene.remove(this.sky);
      (this.sky.material as THREE.Material).dispose();
      this.sky.geometry.dispose();
    }
    const geo = new THREE.SphereGeometry(600, 24, 16);
    const mat = new THREE.ShaderMaterial({
      vertexShader: SKY_VERT,
      fragmentShader: SKY_FRAG,
      uniforms: {
        uTop: { value: new THREE.Color(spec.top) },
        uBottom: { value: new THREE.Color(spec.bottom) },
      },
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    });
    this.sky = new THREE.Mesh(geo, mat);
    this.sky.frustumCulled = false;
    this.scene.add(this.sky);
    this.scene.fog = new THREE.FogExp2(spec.fogColor, spec.fogDensity);
    this.hemi.color.set(spec.top);
    this.hemi.groundColor.set(spec.bottom);
  }

  /** Keep the sky dome + shadow frustum centered on the action. */
  trackFocus(p: THREE.Vector3): void {
    if (this.sky) this.sky.position.copy(p);
    this.dirLight.position.set(p.x + 24, p.y + 48, p.z + 18);
    this.dirLight.target.position.copy(p);
  }

  resize(width: number, height: number): void {
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / Math.max(1, height);
    this.camera.updateProjectionMatrix();
  }

  render(): void {
    this.renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    this.renderer.dispose();
    this.scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
      else if (mat) mat.dispose();
    });
  }
}
