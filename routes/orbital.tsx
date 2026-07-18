/**
 * ORBITAL lobby: brand hero, campaign level select, Random Run,
 * how-to-play. Login required to play (Cognito).
 */

import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Navbar } from '../../components/navbar';
import { useAuth } from '../contexts/auth-context';
import { api } from '../../lib/api';
import { LevelSelect } from '../orbital/ui/level-select';
import { formatMs } from '../orbital/ui/hud';
import {
  loadLocalProgress,
  syncFromServer,
  type ProgressState,
  emptyProgress,
} from '../orbital/game/save';
import '../orbital/orbital.css';

export function meta() {
  return [
    { title: 'ORBITAL - one ball, ten worlds, no mercy | 5432Wire' },
    { name: 'description', content: 'A neon physics runner across ten worlds with shifting gravity. Roll, jump, survive.' },
  ];
}

export default function OrbitalLobby() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const navigate = useNavigate();
  const [progress, setProgress] = useState<ProgressState>(emptyProgress());

  useEffect(() => {
    setProgress(loadLocalProgress());
    if (isAuthenticated) {
      void syncFromServer(api, loadLocalProgress()).then(setProgress);
    }
  }, [isAuthenticated]);

  const completedCount = Object.values(progress.levels).filter((l) => l.completed).length;

  return (
    <div className="orb-root orb-lobby">
      <Navbar />
      <div className="orb-hero">
        <h1 className="orb-wordmark">ORBITAL</h1>
        <div className="orb-tagline">one ball <b>·</b> ten worlds <b>·</b> no mercy</div>
        {isLoading ? null : isAuthenticated ? (
          <div className="orb-mode-row">
            <Link className="orb-btn violet" to="/orbital/play?mode=random">
              [ RANDOM RUN ]
            </Link>
          </div>
        ) : (
          <div className="orb-mode-row">
            <Link className="orb-btn primary" to="/login">[ LOGIN TO PLAY ]</Link>
            <Link className="orb-btn" to="/signup">[ REGISTER ]</Link>
          </div>
        )}
      </div>

      {isAuthenticated && (
        <>
          <div className="orb-section">
            <h2 className="orb-section-title">$ campaign <span className="p">// {completedCount}/10 worlds cleared{user?.username ? ` · pilot: ${user.username}` : ''}</span></h2>
            <LevelSelect progress={progress} onPlay={(i) => navigate(`/orbital/play?level=${i}`)} />
          </div>

          <div className="orb-section">
            <h2 className="orb-section-title">$ random run <span className="p">// endless, never the same twice</span></h2>
            <div className="orb-howto" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14 }}>
              <div>
                A generated track at a random world with random difficulty.
                <br />
                <b>{progress.randomRun.runs}</b> runs flown
                {progress.randomRun.bestTimeMs != null && (
                  <> · best <b>{formatMs(progress.randomRun.bestTimeMs)}</b></>
                )}
              </div>
              <Link className="orb-btn violet small" to="/orbital/play?mode=random">[ LAUNCH ]</Link>
            </div>
          </div>
        </>
      )}

      <div className="orb-section">
        <h2 className="orb-section-title">$ man orbital <span className="p">// how to survive</span></h2>
        <div className="orb-howto">
          <b>ROLL</b> - <span className="k">WASD / arrows</span> on desktop. On mobile: tilt the phone, or switch to
          <span className="k"> EDGE CONTROLS</span> (hold screen edges: top = gas, bottom = brake, sides = steer).<br />
          <b>JUMP</b> - <span className="k">SPACE</span> on desktop, <span className="k">tap anywhere</span> on mobile.<br />
          <b>SPEED</b> - the longer you hold, the faster you roll. Release to coast, pull back to brake.<br />
          <b>SURVIVE</b> - gravity changes per world. Checkpoints save you, but the timer never stops.
          Grab <span className="k">power-ups</span>, dodge hazards, chase par.
        </div>
      </div>
    </div>
  );
}
