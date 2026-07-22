/**
 * Progress persistence: localStorage cache + server sync.
 * Server (game_progress table via FastAPI) is the source of truth;
 * local is an instant cache with clean merge rules.
 */

export interface LevelRecord {
  completed: boolean;
  bestTimeMs: number | null;
  deaths: number;
  shards: number;
}

export interface ProgressState {
  levels: Record<string, LevelRecord>;
  randomRun: { runs: number; bestTimeMs: number | null };
}

const KEY = 'orbital.progress.v2';
const SETTINGS_KEY = 'orbital.settings.v1';

export interface DeviceSettings {
  control: 'tilt' | 'edges' | 'keyboard';
  muted: boolean;
  quality: 'auto' | 'low' | 'medium' | 'high';
}

export const DEFAULT_SETTINGS: DeviceSettings = {
  control: 'tilt',
  muted: false,
  quality: 'auto',
};

export function emptyProgress(): ProgressState {
  return { levels: {}, randomRun: { runs: 0, bestTimeMs: null } };
}

export function loadLocalProgress(): ProgressState {
  if (typeof localStorage === 'undefined') return emptyProgress();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return emptyProgress();
    const parsed = JSON.parse(raw) as ProgressState;
    return {
      levels: parsed.levels ?? {},
      randomRun: parsed.randomRun ?? { runs: 0, bestTimeMs: null },
    };
  } catch {
    return emptyProgress();
  }
}

export function saveLocalProgress(p: ProgressState): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* storage full/blocked: non-fatal */
  }
}

export function loadSettings(): DeviceSettings {
  if (typeof localStorage === 'undefined') return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(s: DeviceSettings): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    /* non-fatal */
  }
}

// ------------------------------------------------------------- server sync

export interface GameApiLike {
  getGameProgress(): Promise<{ success: boolean; data?: { levels: Record<string, LevelRecord> } }>;
  putGameProgress(
    levelId: string,
    body: { completed?: boolean; best_time_ms?: number | null; deaths?: number; shards?: number },
  ): Promise<unknown>;
}

export function mergeRecord(local: LevelRecord | undefined, remote: LevelRecord | undefined): LevelRecord {
  if (!local && !remote) return { completed: false, bestTimeMs: null, deaths: 0, shards: 0 };
  if (!local) return remote!;
  if (!remote) return local;
  return {
    completed: local.completed || remote.completed,
    bestTimeMs:
      local.bestTimeMs == null
        ? remote.bestTimeMs
        : remote.bestTimeMs == null
          ? local.bestTimeMs
          : Math.min(local.bestTimeMs, remote.bestTimeMs),
    deaths: Math.max(local.deaths, remote.deaths),
    shards: Math.max(local.shards, remote.shards),
  };
}

/** Pull server progress and merge over local. Never throws. */
export async function syncFromServer(api: GameApiLike, local: ProgressState): Promise<ProgressState> {
  try {
    const res = await api.getGameProgress();
    if (!res.success || !res.data?.levels) return local;
    const merged = emptyProgress();
    merged.randomRun = local.randomRun;
    const ids = new Set([...Object.keys(local.levels), ...Object.keys(res.data.levels)]);
    for (const id of ids) {
      merged.levels[id] = mergeRecord(local.levels[id], res.data.levels[id]);
    }
    saveLocalProgress(merged);
    return merged;
  } catch {
    return local;
  }
}

/** Write-through one level completion. Never throws. */
export async function pushLevelResult(api: GameApiLike, levelId: string, rec: LevelRecord): Promise<void> {
  try {
    await api.putGameProgress(levelId, {
      completed: rec.completed,
      best_time_ms: rec.bestTimeMs,
      deaths: rec.deaths,
      shards: rec.shards,
    });
  } catch {
    /* offline: local copy already saved */
  }
}

export function recordLevelResult(
  p: ProgressState,
  levelId: string,
  result: { timeMs: number; deaths: number; shards: number },
): ProgressState {
  const prev = p.levels[levelId];
  const merged: LevelRecord = {
    completed: true,
    bestTimeMs: prev?.bestTimeMs == null ? result.timeMs : Math.min(prev.bestTimeMs, result.timeMs),
    deaths: Math.max(prev?.deaths ?? 0, result.deaths),
    shards: Math.max(prev?.shards ?? 0, result.shards),
  };
  const next: ProgressState = {
    levels: { ...p.levels, [levelId]: merged },
    randomRun: p.randomRun,
  };
  saveLocalProgress(next);
  return next;
}

export function recordRandomRunResult(p: ProgressState, timeMs: number): ProgressState {
  const next: ProgressState = {
    levels: p.levels,
    randomRun: {
      runs: p.randomRun.runs + 1,
      bestTimeMs: p.randomRun.bestTimeMs == null ? timeMs : Math.min(p.randomRun.bestTimeMs, timeMs),
    },
  };
  saveLocalProgress(next);
  return next;
}
