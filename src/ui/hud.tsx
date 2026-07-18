/**
 * In-game HUD: timer, shards, deaths, speedometer, power-up chips,
 * toasts, countdown. Pure React state fed by engine events.
 */

import type { GameEvents } from '../game/game';
import type { PowerupType } from '../game/types';

export interface HudState {
  ms: number;
  speed: number;
  maxSpeed: number;
  shards: number;
  shardTotal: number;
  deaths: number;
}

export function formatMs(ms: number): string {
  const total = Math.max(0, ms);
  const m = Math.floor(total / 60000);
  const s = Math.floor((total % 60000) / 1000);
  const t = Math.floor((total % 1000) / 100);
  return `${m}:${s.toString().padStart(2, '0')}.${t}`;
}

const POWER_COLORS: Record<PowerupType, string> = {
  boost: '#22d3ee',
  shield: '#fbbf24',
  magnet: '#a78bfa',
  slow: '#f0abfc',
  anchor: '#4ade80',
};

export function Hud({
  hud,
  powerups,
  countdown,
  toast,
  levelName,
}: {
  hud: HudState;
  powerups: PowerupType[];
  countdown: number | 'GO' | null;
  toast: { text: string; tone: 'ok' | 'bad' | 'info' } | null;
  levelName: string;
}) {
  const speedPct = Math.min(1, hud.speed / Math.max(1, hud.maxSpeed));
  return (
    <>
      <div className="orb-hud-top">
        <div className="orb-hud-box">
          <span className="dim">WORLD</span>
          {levelName}
        </div>
        <div className="orb-hud-box orb-hud-timer">{formatMs(hud.ms)}</div>
        <div className="orb-hud-right">
          <div className="orb-hud-box">
            <span className="dim">SHARDS</span>
            {hud.shards}/{hud.shardTotal}
          </div>
          <div className="orb-hud-box">
            <span className="dim">DEATHS</span>
            {hud.deaths}
          </div>
        </div>
      </div>

      {powerups.length > 0 && (
        <div className="orb-power-row">
          {powerups.map((p) => (
            <span key={p} className="orb-power-chip" style={{ color: POWER_COLORS[p] }}>
              {p.toUpperCase()}
            </span>
          ))}
        </div>
      )}

      <div className="orb-speedo">
        <div className="orb-speedo-bar">
          <div className="orb-speedo-fill" style={{ width: `${Math.round(speedPct * 100)}%` }} />
        </div>
        <div className="orb-speedo-label">
          <b>{hud.speed.toFixed(1)}</b> M/S
        </div>
      </div>

      {toast && <div className={`orb-toast ${toast.tone}`}>{toast.text}</div>}
      {countdown != null && (
        <div className="orb-countdown" key={String(countdown)}>
          {countdown}
        </div>
      )}
    </>
  );
}

export type { GameEvents };
