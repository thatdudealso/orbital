/**
 * Unified input: keyboard (desktop), transparent on-screen arrows,
 * and device-orientation tilt (mobile). Produces a camera-space move
 * vector {x = right, z = forward} plus jump edges, in [-1, 1].
 */

export type ControlMode = 'keyboard' | 'arrows' | 'tilt';

export interface MoveVector {
  x: number;
  z: number;
  jumpPressed: boolean;
  jumpHeld: boolean;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export class InputManager {
  mode: ControlMode = 'keyboard';
  onPause: (() => void) | null = null;
  onAnyInput: (() => void) | null = null;

  private keys = new Set<string>();
  private arrowVec = { x: 0, z: 0 };
  private tiltVec = { x: 0, z: 0 };
  private tiltZero = { beta: 0, gamma: 0 };
  private tiltReady = false;
  private jumpQueued = false;
  private jumpHeldFlag = false;
  private attached = false;

  attach(): void {
    if (this.attached || typeof window === 'undefined') return;
    this.attached = true;
    window.addEventListener('keydown', this.onKeyDown, { passive: false });
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
  }

  detach(): void {
    if (!this.attached) return;
    this.attached = false;
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
    window.removeEventListener('deviceorientation', this.onTilt);
    this.keys.clear();
  }

  // ---------------- keyboard ----------------

  private onKeyDown = (e: KeyboardEvent): void => {
    const k = e.key.toLowerCase();
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) {
      e.preventDefault();
    }
    if (!e.repeat) {
      if (k === ' ') {
        this.jumpQueued = true;
        this.jumpHeldFlag = true;
      }
      this.onAnyInput?.();
    }
    if (k === 'escape' || k === 'p') this.onPause?.();
    this.keys.add(k);
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    const k = e.key.toLowerCase();
    this.keys.delete(k);
    if (k === ' ') this.jumpHeldFlag = false;
  };

  private onBlur = (): void => {
    this.keys.clear();
    this.jumpHeldFlag = false;
  };

  // ---------------- arrows overlay (React writes these) ----------------

  setArrows(x: number, z: number): void {
    this.arrowVec.x = clamp(x, -1, 1);
    this.arrowVec.z = clamp(z, -1, 1);
  }

  setMode(mode: ControlMode): void {
    this.mode = mode;
  }

  /** Called by React arrow buttons / tap-to-jump. */
  pressJump(): void {
    this.jumpQueued = true;
    this.jumpHeldFlag = true;
    this.onAnyInput?.();
  }

  releaseJump(): void {
    this.jumpHeldFlag = false;
  }

  // ---------------- tilt ----------------

  /** Request permission (iOS) and start listening. Must be called from a user gesture. */
  async enableTilt(): Promise<boolean> {
    if (typeof window === 'undefined') return false;
    const doe = DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> };
    try {
      if (doe && typeof doe.requestPermission === 'function') {
        const res = await doe.requestPermission();
        if (res !== 'granted') return false;
      }
    } catch {
      return false;
    }
    this.tiltReady = false;
    window.addEventListener('deviceorientation', this.onTilt);
    this.mode = 'tilt';
    return true;
  }

  disableTilt(): void {
    window.removeEventListener('deviceorientation', this.onTilt);
    if (this.mode === 'tilt') this.mode = 'arrows';
  }

  /** Snapshot current orientation as the neutral resting pose. */
  calibrateTilt(): void {
    this.tiltReady = false; // re-zero on next event
  }

  private onTilt = (e: DeviceOrientationEvent): void => {
    if (e.beta == null || e.gamma == null) return;
    if (!this.tiltReady) {
      this.tiltZero.beta = e.beta;
      this.tiltZero.gamma = e.gamma;
      this.tiltReady = true;
      return;
    }
    let dBeta = e.beta - this.tiltZero.beta;
    let dGamma = e.gamma - this.tiltZero.gamma;

    // Rotate axes for landscape screens so "forward" follows the device.
    const orient = (screen.orientation?.angle ?? 0) % 360;
    if (orient === 90) [dBeta, dGamma] = [-dGamma, dBeta];
    else if (orient === 270 || orient === -90) [dBeta, dGamma] = [dGamma, -dBeta];
    else if (orient === 180) [dBeta, dGamma] = [-dBeta, -dGamma];

    const FULL = 32; // degrees for full deflection
    const DEAD = 2.5; // deadzone
    const dz = (v: number) => (Math.abs(v) < DEAD ? 0 : v - Math.sign(v) * DEAD);
    this.tiltVec.x = clamp(dz(dGamma) / FULL, -1, 1);
    this.tiltVec.z = clamp(-dz(dBeta) / FULL, -1, 1);
    this.onAnyInput?.();
  };

  // ---------------- poll ----------------

  poll(): MoveVector {
    let x = 0;
    let z = 0;
    if (this.mode === 'keyboard') {
      const k = this.keys;
      if (k.has('a') || k.has('arrowleft')) x -= 1;
      if (k.has('d') || k.has('arrowright')) x += 1;
      if (k.has('w') || k.has('arrowup')) z += 1;
      if (k.has('s') || k.has('arrowdown')) z -= 1;
    } else if (this.mode === 'arrows') {
      x = this.arrowVec.x;
      z = this.arrowVec.z;
    } else {
      x = this.tiltVec.x;
      z = this.tiltVec.z;
    }
    const len = Math.hypot(x, z);
    if (len > 1) {
      x /= len;
      z /= len;
    }
    const jumpPressed = this.jumpQueued;
    this.jumpQueued = false;
    return { x, z, jumpPressed, jumpHeld: this.jumpHeldFlag };
  }
}
