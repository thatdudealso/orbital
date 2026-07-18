/**
 * Level briefing overlay shown during the intro flythrough:
 * world identity, gravity readout, terrain notes, tips, par time.
 */

import type { BriefingInfo } from '../game/game';

export function Briefing({ info, onSkip }: { info: BriefingInfo; onSkip: () => void }) {
  return (
    <div className="orb-briefing" onClick={onSkip}>
      <div className="orb-briefing-card" onClick={(e) => e.stopPropagation()}>
        <div className="orb-briefing-world">{info.worldNumber} · {info.modeLabel}</div>
        <div className="orb-briefing-name">{info.name}</div>
        <div className="orb-briefing-tag">{info.tagline}</div>
        <div className="orb-briefing-grav">{info.gravityNote}</div>
        <p className="orb-briefing-text">{info.briefing}</p>
        <ul className="orb-briefing-tips">
          {info.tips.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
        <div className="orb-briefing-meta">
          <span>PAR {info.parTimeSec}S</span>
          <span className="orb-briefing-skip">TAP / ANY KEY TO SKIP &gt;&gt;</span>
        </div>
      </div>
    </div>
  );
}
