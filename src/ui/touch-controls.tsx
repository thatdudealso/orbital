/**
 * Mobile touch controls: optional edge strips plus a full-screen tap-to-jump layer.
 *  - TOP bar    = gas
 *  - BOTTOM bar = brake / reverse
 *  - LEFT/RIGHT long strips = steer
 *  - Tap surface = jump
 * Zones combine (multi-touch). Ultra-transparent, brighten on press.
 */

import { useCallback, useRef, useState } from 'react';
import type { InputManager } from '../engine/input';

type Zone = 'top' | 'bottom' | 'left' | 'right';
type PointerState = { kind: 'zone'; zone: Zone; startedAt: number } | { kind: 'tap'; startedAt: number };

const GLYPHS: Record<Zone, string> = {
  top: '▲',
  bottom: '▼',
  left: '◀',
  right: '▶',
};

const TAP_JUMP_MS = 220;

export function TouchControls({ input, showEdgeStrips }: { input: InputManager; showEdgeStrips: boolean }) {
  const [active, setActive] = useState<Set<Zone>>(new Set());
  const pointers = useRef(new Map<number, PointerState>());

  const fireJump = useCallback(() => {
    input.pressJump();
    input.releaseJump();
  }, [input]);

  const recompute = useCallback(
    (zones: Set<Zone>) => {
      const x = (zones.has('right') ? 1 : 0) - (zones.has('left') ? 1 : 0);
      const z = (zones.has('top') ? 1 : 0) - (zones.has('bottom') ? 1 : 0);
      input.setArrows(x, z);
    },
    [input],
  );

  const zoneDown = useCallback(
    (zone: Zone) => (e: React.PointerEvent) => {
      e.preventDefault();
      (e.target as Element).setPointerCapture?.(e.pointerId);
      pointers.current.set(e.pointerId, { kind: 'zone', zone, startedAt: performance.now() });
      setActive((prev) => {
        const next = new Set(prev).add(zone);
        recompute(next);
        return next;
      });
    },
    [recompute],
  );

  const tapDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      (e.target as Element).setPointerCapture?.(e.pointerId);
      pointers.current.set(e.pointerId, { kind: 'tap', startedAt: performance.now() });
    },
    [],
  );

  const tapRelease = useCallback(
    (e: React.PointerEvent) => {
      const pointer = pointers.current.get(e.pointerId);
      if (!pointer || pointer.kind !== 'tap') return;
      pointers.current.delete(e.pointerId);
      e.preventDefault();
      if (performance.now() - pointer.startedAt <= TAP_JUMP_MS) fireJump();
    },
    [fireJump],
  );

  const tapCancel = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      const pointer = pointers.current.get(e.pointerId);
      if (!pointer || pointer.kind !== 'tap') return;
      pointers.current.delete(e.pointerId);
    },
    [],
  );

  const releaseZone = useCallback(
    (e: React.PointerEvent) => {
      const pointer = pointers.current.get(e.pointerId);
      if (!pointer || pointer.kind !== 'zone') return;
      pointers.current.delete(e.pointerId);
      setActive((prev) => {
        const next = new Set(prev);
        let still = false;
        pointers.current.forEach((state) => {
          if (state.kind === 'zone' && state.zone === pointer.zone) still = true;
        });
        if (!still) next.delete(pointer.zone);
        recompute(next);
        return next;
      });
      if (performance.now() - pointer.startedAt <= TAP_JUMP_MS) fireJump();
    },
    [fireJump, recompute],
  );

  return (
    <>
      {showEdgeStrips &&
        (Object.keys(GLYPHS) as Zone[]).map((zone) => (
          <div
            key={zone}
            className={`orb-edge ${zone} ${active.has(zone) ? 'active' : ''}`}
            onPointerDown={zoneDown(zone)}
            onPointerUp={releaseZone}
            onPointerCancel={releaseZone}
            onLostPointerCapture={releaseZone}
            style={{ touchAction: 'none' }}
          >
            {GLYPHS[zone]}
          </div>
        ))}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 4,
          touchAction: 'none',
        }}
        onPointerDown={tapDown}
        onPointerUp={tapRelease}
        onPointerCancel={tapCancel}
        onLostPointerCapture={tapCancel}
      />
    </>
  );
}
