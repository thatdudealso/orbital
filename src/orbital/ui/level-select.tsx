/**
 * Campaign level grid: 10 world cards with lock state and records.
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
    <div className="orb-level-grid">
      {LEVELS.map((level, i) => {
        const biome = BIOMES[level.biomeId];
        const rec = progress.levels[level.id];
        const prevRec = i > 0 ? progress.levels[LEVELS[i - 1].id] : null;
        const unlocked = i === 0 || !!prevRec?.completed;
        return (
          <button
            key={level.id}
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
      })}
    </div>
  );
}
