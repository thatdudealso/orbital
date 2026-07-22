/**
 * ORBITAL game host: canvas + engine lifecycle + React UI bridge.
 * Engine code is dynamically imported so the blog never pays for it.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router';
import { useAuth } from '../contexts/auth-context';
import { api } from '../../lib/api';
import { Emitter } from '../orbital/engine/events';
import { isMobileDevice } from '../orbital/engine/quality';
import { randomSeed } from '../orbital/engine/prng';
import { LEVELS } from '../orbital/game/levels';
import { generateRandomRun, type RandomRunSpec } from '../orbital/game/generator';
import {
  loadSettings,
  saveSettings,
  recordLevelResult,
  recordRandomRunResult,
  pushLevelResult,
  loadLocalProgress,
  type DeviceSettings,
} from '../orbital/game/save';
import type { Game, GameEvents, GameState, BriefingInfo, CompleteStats } from '../orbital/game/game';
import { Hud, type HudState } from '../orbital/ui/hud';
import { Briefing } from '../orbital/ui/briefing';
import { PauseMenu, CompleteMenu } from '../orbital/ui/menus';
import { TouchControls } from '../orbital/ui/touch-controls';
import type { PowerupType } from '../orbital/game/types';
import '../orbital/orbital.css';

export function meta() {
  return [{ title: 'ORBITAL - in run | 5432Wire' }];
}

type Mode = 'campaign' | 'random';

export default function OrbitalPlay() {
  const { isAuthenticated, isLoading } = useAuth();
  const [params] = useSearchParams();
  const navigate = useNavigate();

  const mode: Mode = params.get('mode') === 'random' ? 'random' : 'campaign';
  const levelIndex = Math.max(0, Math.min(LEVELS.length - 1, parseInt(params.get('level') ?? '0', 10) || 0));

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Game | null>(null);
  const eventsRef = useRef<Emitter<GameEvents> | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const [runId, setRunId] = useState(0);
  const [randomRun, setRandomRun] = useState<RandomRunSpec | null>(null);

  const [gameState, setGameState] = useState<GameState>('boot');
  const [briefing, setBriefing] = useState<BriefingInfo | null>(null);
  const [countdown, setCountdown] = useState<number | 'GO' | null>(null);
  const [hud, setHud] = useState<HudState>({ ms: 0, speed: 0, maxSpeed: 14, shards: 0, shardTotal: 0, deaths: 0 });
  const [powerups, setPowerups] = useState<PowerupType[]>([]);
  const [toast, setToast] = useState<{ text: string; tone: 'ok' | 'bad' | 'info' } | null>(null);
  const [stats, setStats] = useState<CompleteStats | null>(null);
  const [settings, setSettings] = useState<DeviceSettings>(loadSettings());
  const [motionReady, setMotionReady] = useState(false);
  const [bootError, setBootError] = useState<string | null>(null);
  const isMobile = isMobileDevice();

  // ---------- game lifecycle ----------

  useEffect(() => {
    if (isLoading || !isAuthenticated) return;
    let cancelled = false;
    let game: Game | null = null;

    const events = new Emitter<GameEvents>();
    eventsRef.current = events;

    events.on('state', ({ state }) => setGameState(state));
    events.on('briefing', (payload) => setBriefing(payload ? payload.info : null));
    events.on('countdown', ({ n }) => setCountdown(n));
    events.on('hud', (h) => setHud(h));
    events.on('powerups', ({ active }) => setPowerups(active));
    events.on('toast', (t) => {
      if (toastTimerRef.current != null) window.clearTimeout(toastTimerRef.current);
      setToast(t);
      toastTimerRef.current = window.setTimeout(() => {
        toastTimerRef.current = null;
        setToast(null);
      }, 1600);
    });
    events.on('complete', ({ stats: s }) => {
      setStats(s);
      // persist: local first, then server
      if (s.mode === 'campaign') {
        const next = recordLevelResult(loadLocalProgress(), s.levelId, {
          timeMs: s.timeMs,
          deaths: s.deaths,
          shards: s.shards,
        });
        const rec = next.levels[s.levelId];
        void pushLevelResult(api, s.levelId, rec);
      } else {
        recordRandomRunResult(loadLocalProgress(), s.timeMs);
      }
    });

    const run = mode === 'random' ? generateRandomRun(randomSeed()) : null;
    setRandomRun(run);
    setBootError(null);

    void (async () => {
      try {
        const mod = await import('../orbital/game/game');
        if (cancelled || !canvasRef.current) return;
        const level = mode === 'campaign' ? LEVELS[levelIndex] : undefined;
        const biomeId = level ? level.biomeId : run!.biomeId;
        game = new mod.Game({
          canvas: canvasRef.current,
          level,
          randomRun: run ?? undefined,
          biomeId,
          parTimeSec: level ? level.parTimeSec : run!.parTimeSec,
          tips: level ? level.tips : [`difficulty: ${run!.difficultyLabel}`, 'generated track - never the same twice'],
          worldNumber: level ? `WORLD ${String(levelIndex + 1).padStart(2, '0')}/20` : 'RANDOM RUN',
          modeLabel: mode === 'campaign' ? 'CAMPAIGN' : `${run!.difficultyLabel}`,
          levelIndex,
          levelId: level ? level.id : `random-${run!.seed}`,
          mode,
          quality: settings.quality,
          muted: settings.muted,
          events,
        });
        gameRef.current = game;
        await game.init();
        if (cancelled || gameRef.current !== game) {
          game.dispose();
          if (gameRef.current === game) gameRef.current = null;
          return;
        }
        // default control mode for mobile: tilt (if permitted) else edges
        if (isMobile && settings.control === 'tilt') {
          const input = game.getInput();
          void input.enableTilt().then((ok) => {
            setMotionReady(ok);
            if (!ok) {
              const merged = { ...settings, control: 'edges' as const };
              setSettings(merged);
              saveSettings(merged);
              input.setMode('arrows');
            }
          });
        } else if (isMobile) {
          game.getInput().setMode('arrows');
        }
      } catch (error) {
        game?.dispose();
        if (gameRef.current === game) gameRef.current = null;
        eventsRef.current = null;
        if (!cancelled) {
          setBootError(error instanceof Error ? error.message : 'BOOT FAILED');
          setGameState('boot');
        }
      }
    })();

    return () => {
      cancelled = true;
      if (toastTimerRef.current != null) {
        window.clearTimeout(toastTimerRef.current);
        toastTimerRef.current = null;
      }
      game?.dispose();
      gameRef.current = null;
      eventsRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, isLoading, mode, levelIndex, runId]);

  // skip briefing with any key
  useEffect(() => {
    if (!briefing) return;
    const skip = () => gameRef.current?.skipBriefing();
    window.addEventListener('keydown', skip);
    return () => window.removeEventListener('keydown', skip);
  }, [briefing]);

  // ---------- actions ----------

  const restart = useCallback(() => {
    setStats(null);
    setHud({ ms: 0, speed: 0, maxSpeed: 14, shards: 0, shardTotal: 0, deaths: 0 });
    setRunId((n) => n + 1);
  }, []);

  const nextLevel = useCallback(() => {
    if (mode === 'random') {
      restart();
    } else {
      navigate(`/orbital/play?level=${Math.min(levelIndex + 1, LEVELS.length - 1)}`);
    }
  }, [mode, levelIndex, navigate, restart]);

  const toggleControl = useCallback(() => {
    const next: DeviceSettings['control'] = settings.control === 'tilt' ? 'edges' : 'tilt';
    const merged = { ...settings, control: next };
    setSettings(merged);
    saveSettings(merged);
    const input = gameRef.current?.getInput();
    if (!input) return;
    if (next === 'tilt') {
      void input.enableTilt().then((ok) => {
        setMotionReady(ok);
        if (!ok) {
          const merged = { ...settings, control: 'edges' as const };
          setSettings(merged);
          saveSettings(merged);
          input.setMode('arrows');
        }
      });
    }
    else {
      input.disableTilt();
      input.setMode('arrows');
    }
  }, [settings]);

  const toggleMute = useCallback(() => {
    const merged = { ...settings, muted: !settings.muted };
    setSettings(merged);
    saveSettings(merged);
    gameRef.current?.setMuted(merged.muted);
  }, [settings]);

  const enableMotion = useCallback(async () => {
    const input = gameRef.current?.getInput();
    if (!input) return;
    const ok = await input.enableTilt();
    setMotionReady(ok);
    if (!ok) {
      // permission denied: fall back to edges
      const merged = { ...settings, control: 'edges' as const };
      setSettings(merged);
      saveSettings(merged);
      input.setMode('arrows');
    }
  }, [settings]);

  const retryBoot = useCallback(() => {
    setBootError(null);
    setRunId((n) => n + 1);
  }, []);

  // ---------- auth gate ----------

  if (isLoading) {
    return (
      <div className="orb-root orb-stage">
        <div className="orb-loading">
          <div className="orb-loading-bar" />
          <div className="orb-loading-text">AUTH CHECK</div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="orb-root orb-stage">
        <div className="orb-menu-wrap">
          <div className="orb-menu">
            <h2>ACCESS DENIED</h2>
            <div className="sub">ORBITAL REQUIRES A PILOT ACCOUNT</div>
            <div className="orb-menu-actions">
              <Link className="orb-btn primary" to="/login">[ LOGIN ]</Link>
              <Link className="orb-btn" to="/signup">[ REGISTER ]</Link>
              <Link className="orb-btn" to="/orbital">[ BACK TO LOBBY ]</Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const level = mode === 'campaign' ? LEVELS[levelIndex] : null;
  const levelName = level ? `${String(levelIndex + 1).padStart(2, '0')} ${level.id.replace(/_/g, ' ').toUpperCase()}` : 'RANDOM RUN';
  const hasNext = mode === 'random' || levelIndex < LEVELS.length - 1;
  const needsMotionBtn = isMobile && settings.control === 'tilt' && !motionReady && gameState !== 'boot';

  return (
    <div className="orb-root orb-stage">
      <canvas ref={canvasRef} className="orb-canvas" />
      <div className="orb-vignette" />

      <div className="orb-overlay">
        <Hud hud={hud} powerups={powerups} countdown={countdown} toast={toast} levelName={levelName} />

        <div className="orb-corner-actions">
          {gameState === 'playing' && (
            <button className="orb-icon-btn" onClick={() => gameRef.current?.togglePause()} aria-label="pause">
              ⏸
            </button>
          )}
          <button className="orb-icon-btn" onClick={toggleMute} aria-label="mute">
            {settings.muted ? '🔇' : '🔊'}
          </button>
        </div>

        {briefing && <Briefing info={briefing} onSkip={() => gameRef.current?.skipBriefing()} />}

        {isMobile && gameRef.current && (gameState === 'playing' || gameState === 'countdown') && (
          <TouchControls input={gameRef.current.getInput()} showEdgeStrips={settings.control === 'edges'} />
        )}

        {needsMotionBtn && (
          <button className="orb-motion-btn" onClick={enableMotion}>
            <span className="orb-btn primary">[ ENABLE MOTION - TILT CONTROLS ]</span>
          </button>
        )}

        {gameState === 'paused' && (
          <PauseMenu
            onResume={() => gameRef.current?.resume()}
            onRestart={restart}
            onQuit={() => navigate('/orbital')}
            controlMode={settings.control}
            onToggleControl={toggleControl}
            muted={settings.muted}
            onToggleMute={toggleMute}
            isMobile={isMobile}
          />
        )}

        {gameState === 'done' && stats && (
          <CompleteMenu
            stats={stats}
            hasNext={hasNext}
            onNext={mode === 'random' ? restart : nextLevel}
            onReplay={restart}
            onQuit={() => navigate('/orbital')}
          />
        )}

        {bootError ? (
          <div className="orb-menu-wrap">
            <div className="orb-menu">
              <h2>BOOT FAILED</h2>
              <div className="sub">{bootError}</div>
              <div className="orb-menu-actions">
                <button className="orb-btn primary" onClick={retryBoot}>[ RETRY ]</button>
                <Link className="orb-btn" to="/orbital">[ BACK TO LOBBY ]</Link>
              </div>
            </div>
          </div>
        ) : gameState === 'boot' && (
          <div className="orb-loading">
            <div className="orb-loading-bar" />
            <div className="orb-loading-text">BUILDING WORLD</div>
          </div>
        )}
      </div>
    </div>
  );
}
