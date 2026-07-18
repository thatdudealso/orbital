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
  attempts: number;
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

function normalizeLevelRecord(record?: Partial<LevelRecord>): LevelRecord {
  return {
    completed: record?.completed ?? false,
    bestTimeMs: record?.bestTimeMs ?? null,
    deaths: record?.deaths ?? 0,
    shards: record?.shards ?? 0,
    attempts: record?.attempts ?? 0,
  };
}

function normalizeRandomRun(
  randomRun?: { runs?: number; bestTimeMs?: number | null },
): { runs: number; bestTimeMs: number | null } {
  return {
    runs: randomRun?.runs ?? 0,
    bestTimeMs: randomRun?.bestTimeMs ?? null,
  };
}

export function loadLocalProgress(): ProgressState {
  if (typeof localStorage === 'undefined') return emptyProgress();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return emptyProgress();
    const parsed = JSON.parse(raw) as ProgressState;
    const levels: Record<string, LevelRecord> = {};
    for (const [id, record] of Object.entries(parsed.levels ?? {})) {
      levels[id] = normalizeLevelRecord(record);
    }
    return {
      levels,
      randomRun: normalizeRandomRun(parsed.randomRun),
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
  getGameProgress(): Promise<{ success: boolean; data?: { levels: Record<string, Partial<LevelRecord>> } }>;
  getRandomRunStats(): Promise<{ success: boolean; data?: { runs: number; best_time_ms: number | null } }>;
  putGameProgress(
    levelId: string,
    body: { completed?: boolean; best_time_ms?: number | null; deaths?: number; shards?: number; attempts?: number },
  ): Promise<unknown>;
  putRandomRunStats(body: { runs: number; best_time_ms: number | null }): Promise<unknown>;
}

export function mergeRecord(local: LevelRecord | undefined, remote: LevelRecord | undefined): LevelRecord {
  if (!local && !remote) return normalizeLevelRecord();
  if (!local) return normalizeLevelRecord(remote);
  if (!remote) return normalizeLevelRecord(local);
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
    attempts: Math.max(local.attempts, remote.attempts),
  };
}

export function mergeRandomRun(
  local: { runs: number; bestTimeMs: number | null } | undefined,
  remote: { runs: number; bestTimeMs: number | null } | undefined,
): { runs: number; bestTimeMs: number | null } {
  const normalizedLocal = normalizeRandomRun(local);
  const normalizedRemote = normalizeRandomRun(remote);
  return {
    runs: Math.max(normalizedLocal.runs, normalizedRemote.runs),
    bestTimeMs:
      normalizedLocal.bestTimeMs == null
        ? normalizedRemote.bestTimeMs
        : normalizedRemote.bestTimeMs == null
          ? normalizedLocal.bestTimeMs
          : Math.min(normalizedLocal.bestTimeMs, normalizedRemote.bestTimeMs),
  };
}

export function mergeProgress(local: ProgressState, remote: ProgressState): ProgressState {
  const merged = emptyProgress();
  merged.randomRun = mergeRandomRun(local.randomRun, remote.randomRun);
  const ids = new Set([...Object.keys(local.levels), ...Object.keys(remote.levels)]);
  for (const id of ids) {
    merged.levels[id] = mergeRecord(local.levels[id], remote.levels[id]);
  }
  saveLocalProgress(merged);
  return merged;
}

export function buildLevelCompletionPayload(
  before: ProgressState,
  completed: ProgressState,
  synced: ProgressState,
  levelId: string,
): LevelRecord | null {
  const completedRecord = completed.levels[levelId];
  if (!completedRecord) return null;
  const merged = mergeRecord(completedRecord, synced.levels[levelId]);
  return {
    ...merged,
    attempts: Math.max(before.levels[levelId]?.attempts ?? 0, synced.levels[levelId]?.attempts ?? 0) + 1,
  };
}

export function buildRandomRunCompletionPayload(
  before: ProgressState,
  completed: ProgressState,
  synced: ProgressState,
): { runs: number; bestTimeMs: number | null } {
  return {
    runs: Math.max(before.randomRun.runs, synced.randomRun.runs) + 1,
    bestTimeMs: mergeRandomRun(completed.randomRun, synced.randomRun).bestTimeMs,
  };
}

/** Pull server progress and merge over local. Never throws. */
export async function syncFromServer(api: GameApiLike, local: ProgressState): Promise<ProgressState> {
  try {
    const merged = emptyProgress();
    merged.randomRun = normalizeRandomRun(local.randomRun);
    let remoteLevels: Record<string, Partial<LevelRecord>> | undefined;
    try {
      const progressRes = await api.getGameProgress();
      if (progressRes.success && progressRes.data?.levels) {
        remoteLevels = progressRes.data.levels;
      }
    } catch {
      /* ignore */
    }
    try {
      const randomRunRes = await api.getRandomRunStats();
      if (randomRunRes.success && randomRunRes.data) {
        merged.randomRun = mergeRandomRun(local.randomRun, {
          runs: randomRunRes.data.runs,
          bestTimeMs: randomRunRes.data.best_time_ms,
        });
      }
    } catch {
      /* ignore */
    }
    if (!remoteLevels) {
      const next = { levels: local.levels, randomRun: merged.randomRun };
      saveLocalProgress(next);
      return next;
    }
    const ids = new Set([...Object.keys(local.levels), ...Object.keys(remoteLevels)]);
    for (const id of ids) {
      merged.levels[id] = mergeRecord(local.levels[id], normalizeLevelRecord(remoteLevels[id]));
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
      attempts: rec.attempts,
    });
  } catch {
    /* offline: local copy already saved */
  }
}

export async function pushRandomRunResult(api: GameApiLike, randomRun: { runs: number; bestTimeMs: number | null }): Promise<void> {
  try {
    await api.putRandomRunStats({
      runs: randomRun.runs,
      best_time_ms: randomRun.bestTimeMs,
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
    attempts: (prev?.attempts ?? 0) + 1,
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
