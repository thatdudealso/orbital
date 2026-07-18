/**
 * Cinematic bookends: intro flythrough along the track centerline and
 * the victory orbit. Pure path math - CameraRig does the motion.
 */

import * as THREE from 'three';

/** Build the intro flythrough: dive from high above the goal, sweep
 * backwards along the track, settle behind the ball. */
export function buildIntroPath(pathPoints: THREE.Vector3[], startPos: THREE.Vector3): THREE.Vector3[] {
  const pts: THREE.Vector3[] = [];
  const goal = pathPoints[pathPoints.length - 1] ?? startPos;

  // opening: high above + beyond the goal
  pts.push(goal.clone().add(new THREE.Vector3(14, 26, 14)));

  // sweep backwards along the centerline, elevated
  const stride = Math.max(2, Math.floor(pathPoints.length / 14));
  for (let i = pathPoints.length - 1; i >= 0; i -= stride) {
    const p = pathPoints[i].clone();
    p.y += 5.2;
    pts.push(p);
  }

  // final approach: descend to just behind the ball
  pts.push(startPos.clone().add(new THREE.Vector3(0, 3.6, 9.5)));
  return pts;
}

/** Look-target track for the intro: start gazing at the goal, blend to
 * the ball as the camera arrives. */
export function introLookAt(pathPoints: THREE.Vector3[], startPos: THREE.Vector3): (t: number) => THREE.Vector3 {
  const goal = pathPoints[pathPoints.length - 1] ?? startPos;
  const from = goal.clone().add(new THREE.Vector3(0, 1.5, 0));
  const to = startPos.clone();
  return (t: number) => {
    // bias early looks at the track ahead, late looks at the ball
    const k = Math.max(0, (t - 0.35) / 0.65);
    return new THREE.Vector3().lerpVectors(from, to, k * k);
  };
}
