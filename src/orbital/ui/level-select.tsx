/**
 * Campaign level grid: 20 world cards (Act I + Act II) with lock state and records.
 */

import { LEVELS } from '../game/levels';
import { BIOMES } from '../game/biomes';
import type { ProgressState } from '../game/save';
import { formatMs } from './hud';

export function LevelSelect({
  progress,
  onPlay,
}: {
  progress: ProgressState;
  onPlay: (index: number) => void;
}) {
  return (
    <div className="orb-level-grid-wrap">
      <div className="orb-act-label">ACT I · WORLDS 01-10</div>
      <div className="orb-level-grid">
        {LEVELS.slice(0, 10).map((level, i) => (
          <LevelCard key={level.id} level={level} i={i} progress={progress} onPlay={onPlay} />
        ))}
      </div>
      <div className="orb-act-label" style={{ marginTop: 22 }}>ACT II · WORLDS 11-20</div>
      <div className="orb-level-grid">
        {LEVELS.slice(10).map((level, i) => (
          <LevelCard key={level.id} level={level} i={i + 10} progress={progress} onPlay={onPlay} />
        ))}
      </div>
    </div>
  );
}

function LevelCard({
  level,
  i,
  progress,
  onPlay,
}: {
  level: (typeof LEVELS)[number];
  i: number;
  progress: ProgressState;
  onPlay: (index: number) => void;
}) {
  const biome = BIOMES[level.biomeId];
  const rec = progress.levels[level.id];
  const prevRec = i > 0 ? progress.levels[LEVELS[i - 1].id] : null;
  const unlocked = i === 0 || !!prevRec?.completed;
  return (
    <button
      className={`orb-level-card ${unlocked ? '' : 'locked'}`}
      style={{ ['--card-accent' as string]: biome.palette.edge }}
      disabled={!unlocked}
      onClick={() => onPlay(i)}
    >
      <div className="orb-level-num">{String(i + 1).padStart(2, '0')} {unlocked ? '' : '· LOCKED'}</div>
      <div className="orb-level-name">{biome.name}</div>
      <div className="orb-level-tag">{biome.tagline}</div>
      <div className="orb-level-meta">
        <span>{biome.gravityNote.split('-')[0].trim()}</span>
        {rec?.completed ? (
          <span className="done">✓ {rec.bestTimeMs != null ? formatMs(rec.bestTimeMs) : ''}</span>
        ) : (
          <span>PAR {level.parTimeSec}S</span>
        )}
      </div>
    </button>
  );
}
