/**
 * Pause menu + level-complete panel.
 */

import type { CompleteStats } from '../game/game';
import { formatMs } from './hud';

export function PauseMenu({
  onResume,
  onRestart,
  onQuit,
  controlMode,
  onToggleControl,
  muted,
  onToggleMute,
  isMobile,
}: {
  onResume: () => void;
  onRestart: () => void;
  onQuit: () => void;
  controlMode: 'tilt' | 'edges' | 'keyboard';
  onToggleControl: () => void;
  muted: boolean;
  onToggleMute: () => void;
  isMobile: boolean;
}) {
  return (
    <div className="orb-menu-wrap">
      <div className="orb-menu">
        <h2>PAUSED</h2>
        <div className="sub">SYSTEM HOLD</div>
        <div className="orb-menu-actions">
          <button className="orb-btn primary" onClick={onResume}>[ RESUME ]</button>
          <button className="orb-btn" onClick={onRestart}>[ RESTART WORLD ]</button>
          {isMobile && (
            <button className="orb-btn" onClick={onToggleControl}>
              [ CONTROLS: {controlMode === 'tilt' ? 'TILT' : 'EDGES'} ]
            </button>
          )}
          <button className="orb-btn" onClick={onToggleMute}>[ SOUND: {muted ? 'OFF' : 'ON'} ]</button>
          <button className="orb-btn" onClick={onQuit}>[ ABANDON RUN ]</button>
        </div>
      </div>
    </div>
  );
}

export function CompleteMenu({
  stats,
  hasNext,
  onNext,
  onReplay,
  onQuit,
}: {
  stats: CompleteStats;
  hasNext: boolean;
  onNext: () => void;
  onReplay: () => void;
  onQuit: () => void;
}) {
  const delta = stats.parMs - stats.timeMs;
  const beatPar = delta >= 0;
  return (
    <div className="orb-menu-wrap">
      <div className="orb-menu">
        <h2 className="win">WORLD CLEARED</h2>
        <div className="sub">{stats.mode === 'random' ? 'RANDOM RUN COMPLETE' : 'LEVEL COMPLETE'}</div>
        <div className="orb-stats">
          <div className="orb-stat">
            <div className="v green">{formatMs(stats.timeMs)}</div>
            <div className="k">YOUR TIME</div>
          </div>
          <div className="orb-stat">
            <div className="v">{formatMs(stats.parMs)}</div>
            <div className="k">PAR</div>
          </div>
          <div className="orb-stat">
            <div className="v amber">{stats.shards}/{stats.shardTotal}</div>
            <div className="k">SHARDS</div>
          </div>
          <div className="orb-stat">
            <div className="v">{stats.deaths}</div>
            <div className="k">DEATHS</div>
          </div>
        </div>
        <div className={`orb-par-delta ${beatPar ? 'beat' : 'miss'}`}>
          {beatPar ? `PAR BEATEN BY ${formatMs(delta)}` : `${formatMs(-delta)} OVER PAR`}
        </div>
        <div className="orb-menu-actions">
          {hasNext && (
            <button className="orb-btn primary" onClick={onNext} autoFocus>
              [ NEXT WORLD &gt;&gt; ]
            </button>
          )}
          <button className="orb-btn" onClick={onReplay}>[ RUN IT AGAIN ]</button>
          <button className="orb-btn" onClick={onQuit}>[ BACK TO LOBBY ]</button>
        </div>
      </div>
    </div>
  );
}
