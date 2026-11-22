import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { MusclePart } from '../../lib/anatomy';
import {
  interpolatePose,
  type FigurePose,
  type MotionProfile,
  type Point,
  type PropKind,
  type SceneKind,
} from '../../lib/exerciseMotions';

export interface Stage3DProps {
  exerciseId: string;
  exerciseName: string;
  profile: MotionProfile;
  primary: MusclePart[];
  accent: string;
  paused: boolean;
  slow: boolean;
  resetSignal: number;
  onPhaseChange?: (phase: number, label: string) => void;
  onWebGLError?: () => void;
}

const SCALE = 1 / 138; // 138px ≈ 1m -> standing figure ~1.78m tall
const FLOOR_PY = 284;

const ASYMMETRIC_SIDE = new Set([
  'lunge',
  'bulgarian-split-squat',
  'treadmill',
  'jump-rope',
  'cable-kickback',
  'stationary-bike',
  'farmers-walk',
]);

const MAT_EXERCISES = new Set(['plank', 'push-up', 'ab-wheel', 'glute-bridge', 'russian-twist']);

interface Pose3D {
  head: THREE.Vector3;
  neck: THREE.Vector3;
  shoulderL: THREE.Vector3;
  shoulderR: THREE.Vector3;
  elbowL: THREE.Vector3;
  elbowR: THREE.Vector3;
  handL: THREE.Vector3;
  handR: THREE.Vector3;
  hipL: THREE.Vector3;
  hipR: THREE.Vector3;
  kneeL: THREE.Vector3;
  kneeR: THREE.Vector3;
  ankleL: THREE.Vector3;
  ankleR: THREE.Vector3;
  toeL: THREE.Vector3;
  toeR: THREE.Vector3;
}

function toVec(p: Point, z = 0): THREE.Vector3 {
  return new THREE.Vector3((p.x - 160) * SCALE, (FLOOR_PY - p.y) * SCALE, z);
}

function avgPt(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function poseTo3D(
  pose: FigurePose,
  profile: MotionProfile,
  exerciseId: string,
  eased: number,
): Pose3D {
  if (profile.view === 'front') {
    const isSeated =
      exerciseId === 'lat-pulldown' ||
      exerciseId === 'db-shoulder-press' ||
      exerciseId === 'shoulder-press' ||
      exerciseId === 'arnold-press' ||
      exerciseId === 'russian-twist';
    const isLegRaise = exerciseId === 'hanging-leg-raise';
    const isCurlLike =
      profile.prop !== 'none' &&
      (exerciseId.includes('curl') ||
        exerciseId === 'upright-row' ||
        exerciseId === 'overhead-press' ||
        exerciseId === 'overhead-tricep-extension' ||
        exerciseId === 'db-shoulder-press' ||
        exerciseId === 'arnold-press');

    const handZ = (h: Point, s: Point) => {
      if (exerciseId === 'russian-twist') return h.x < 150 ? 0.24 : 0.22;
      if (isCurlLike) return Math.max(0.03, Math.min(0.22, ((s.y + 75 - h.y) / 110) * 0.18));
      return 0.02;
    };
    const kneeZ = isLegRaise ? 0.36 * eased : isSeated ? 0.26 : 0.03;
    const ankleZ = isLegRaise ? 0.44 * eased : isSeated ? 0.28 : 0.01;
    const toeZ = isLegRaise ? 0.46 * eased : isSeated ? 0.34 : 0.11;
    const headZ = exerciseId === 'russian-twist' ? -0.1 : 0;

    return {
      head: toVec(pose.head, headZ),
      neck: toVec(pose.neck, headZ * 0.6),
      shoulderL: toVec(pose.shoulderL, headZ * 0.4),
      shoulderR: toVec(pose.shoulderR, headZ * 0.4),
      elbowL: toVec(pose.elbowL, isSeated ? 0.06 : 0.04),
      elbowR: toVec(pose.elbowR, isSeated ? 0.06 : 0.04),
      handL: toVec(pose.handL, handZ(pose.handL, pose.shoulderL)),
      handR: toVec(pose.handR, handZ(pose.handR, pose.shoulderR)),
      hipL: toVec(pose.hipL, 0),
      hipR: toVec(pose.hipR, 0),
      kneeL: toVec(pose.kneeL, kneeZ),
      kneeR: toVec(pose.kneeR, kneeZ),
      ankleL: toVec(pose.ankleL, ankleZ),
      ankleR: toVec(pose.ankleR, ankleZ),
      toeL: toVec(pose.toeL, toeZ),
      toeR: toVec(pose.toeR, toeZ),
    };
  }

  // Side view: separate L (+Z) and R (-Z) anatomically in 3D depth
  const symSide = !ASYMMETRIC_SIDE.has(exerciseId);
  const sPt = symSide ? avgPt(pose.shoulderL, pose.shoulderR) : null;
  const ePt = symSide ? avgPt(pose.elbowL, pose.elbowR) : null;
  const hPt = symSide ? avgPt(pose.handL, pose.handR) : null;
  const hpPt = symSide ? avgPt(pose.hipL, pose.hipR) : null;
  const kPt = symSide ? avgPt(pose.kneeL, pose.kneeR) : null;
  const aPt = symSide ? avgPt(pose.ankleL, pose.ankleR) : null;
  const tPt = symSide ? avgPt(pose.toeL, pose.toeR) : null;

  const isFly = exerciseId === 'db-fly' || exerciseId === 'cable-fly' || exerciseId === 'pec-deck' || exerciseId === 'rear-delt-fly';
  const flySpread = isFly ? 0.16 + (1 - eased) * 0.34 : 0;
  const elbowZ = isFly ? flySpread * 0.85 : 0.21;
  const centralGrip =
    profile.prop === 'kettlebell' ||
    profile.prop === 'rope' ||
    exerciseId === 'goblet-squat';
  const handZ = isFly
    ? flySpread
    : centralGrip
      ? 0.07
      : exerciseId === 'ab-wheel'
        ? 0.14
        : exerciseId === 'squat' || exerciseId === 'good-morning'
          ? 0.28
          : 0.20;

  return {
    head: toVec(pose.head, 0),
    neck: toVec(pose.neck, 0),
    shoulderL: toVec(sPt ?? pose.shoulderL, 0.185),
    shoulderR: toVec(sPt ?? pose.shoulderR, -0.185),
    elbowL: toVec(ePt ?? pose.elbowL, elbowZ),
    elbowR: toVec(ePt ?? pose.elbowR, -elbowZ),
    handL: toVec(hPt ?? pose.handL, handZ),
    handR: toVec(hPt ?? pose.handR, -handZ),
    hipL: toVec(hpPt ?? pose.hipL, 0.095),
    hipR: toVec(hpPt ?? pose.hipR, -0.095),
    kneeL: toVec(kPt ?? pose.kneeL, 0.105),
    kneeR: toVec(kPt ?? pose.kneeR, -0.105),
    ankleL: toVec(aPt ?? pose.ankleL, 0.10),
    ankleR: toVec(aPt ?? pose.ankleR, -0.10),
    toeL: toVec(tPt ?? pose.toeL, 0.10),
    toeR: toVec(tPt ?? pose.toeR, -0.10),
  };
}

function wave(phase: number) {
  const triangle = phase < 0.5 ? phase * 2 : (1 - phase) * 2;
  const held = Math.min(1, Math.max(0, (triangle - 0.07) / 0.86));
  return held * held * held * (held * (held * 6 - 15) + 10);
}

/** Smooth anatomical limb geometry from y = 0 to y = 1 using LatheGeometry. */
function makeMuscleLathe(rStart: number, rMid: number, rEnd: number, peakT = 0.38) {
  const pts: THREE.Vector2[] = [];
  const steps = 16;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const base = rStart + (rEnd - rStart) * t;
    const bell = Math.sin(Math.PI * Math.pow(t, Math.log(0.5) / Math.log(peakT)));
    const r = base + (rMid - (rStart + rEnd) * 0.5) * Math.max(0, bell);
    pts.push(new THREE.Vector2(Math.max(0.005, r), t));
  }
  const geo = new THREE.LatheGeometry(pts, 20);
  return geo;
}

const UP = new THREE.Vector3(0, 1, 0);

function placeBetween(mesh: THREE.Object3D, a: THREE.Vector3, b: THREE.Vector3, radiusScale = 1) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = Math.max(0.001, dir.length());
  mesh.position.copy(a);
  mesh.quaternion.setFromUnitVectors(UP, dir.clone().normalize());
  mesh.scale.set(radiusScale, len, radiusScale);
}

function placeShoe(shoeGroup: THREE.Group, ankle: THREE.Vector3, toe: THREE.Vector3, knee: THREE.Vector3) {
  const fwd = new THREE.Vector3().subVectors(toe, ankle);
  const len = Math.max(0.06, fwd.length());
  const fwdDir = fwd.clone().normalize();
  const shinDir = new THREE.Vector3().subVectors(knee, ankle).normalize();
  // Orthonormal frame: +Z = forward (toe), +Y = toward shin (top of shoe), +X = side
  const side = new THREE.Vector3().crossVectors(shinDir, fwdDir);
  if (side.lengthSq() < 1e-5) side.set(0, 0, 1);
  side.normalize();
  const up = new THREE.Vector3().crossVectors(fwdDir, side).normalize();
  const m = new THREE.Matrix4().makeBasis(side, up, fwdDir);
  shoeGroup.position.copy(ankle).addScaledVector(fwdDir, len * 0.36).addScaledVector(up, -0.012);
  shoeGroup.quaternion.setFromRotationMatrix(m);
  shoeGroup.scale.set(1, 1, Math.max(0.85, len / 0.14));
}

function createPropMesh(kind: PropKind, accentColor: THREE.Color): {
  group: THREE.Group;
  cableLine?: THREE.Line;
  ropeL?: THREE.Line;
  ropeR?: THREE.Line;
} {
  const group = new THREE.Group();
  const steelMat = new THREE.MeshStandardMaterial({ color: 0xdbe2ea, metalness: 0.85, roughness: 0.22 });
  const ironMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.45, roughness: 0.5 });
  const accentMat = new THREE.MeshStandardMaterial({
    color: accentColor,
    metalness: 0.2,
    roughness: 0.38,
    emissive: accentColor,
    emissiveIntensity: 0.25,
  });

  if (kind === 'none') return { group };

  if (kind === 'barbell' || kind === 'ez-bar') {
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 1.32, 16), steelMat);
    bar.rotation.x = Math.PI / 2;
    bar.castShadow = true;
    group.add(bar);

    for (const side of [-1, 1]) {
      const innerPlate = new THREE.Mesh(new THREE.CylinderGeometry(0.145, 0.145, 0.036, 24), ironMat);
      innerPlate.rotation.x = Math.PI / 2;
      innerPlate.position.z = side * 0.52;
      innerPlate.castShadow = true;
      group.add(innerPlate);

      const outerPlate = new THREE.Mesh(new THREE.CylinderGeometry(0.115, 0.115, 0.03, 24), ironMat);
      outerPlate.rotation.x = Math.PI / 2;
      outerPlate.position.z = side * 0.565;
      outerPlate.castShadow = true;
      group.add(outerPlate);

      const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.028, 16), accentMat);
      collar.rotation.x = Math.PI / 2;
      collar.position.z = side * 0.485;
      group.add(collar);
    }
    return { group };
  }

  if (kind === 'dumbbells') {
    for (const name of ['dbL', 'dbR']) {
      const db = new THREE.Group();
      db.name = name;
      const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, 0.18, 12), steelMat);
      handle.rotation.x = Math.PI / 2;
      handle.castShadow = true;
      db.add(handle);
      for (const s of [-1, 1]) {
        const hex = new THREE.Mesh(new THREE.CylinderGeometry(0.056, 0.056, 0.045, 6), ironMat);
        hex.rotation.x = Math.PI / 2;
        hex.position.z = s * 0.095;
        hex.castShadow = true;
        db.add(hex);

        const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.058, 0.01, 6), accentMat);
        ring.rotation.x = Math.PI / 2;
        ring.position.z = s * 0.072;
        db.add(ring);
      }
      group.add(db);
    }
    return { group };
  }

  if (kind === 'kettlebell') {
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.085, 20, 16), ironMat);
    body.scale.set(1, 0.92, 0.85);
    body.position.y = -0.07;
    body.castShadow = true;
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.012, 10, 20, Math.PI), steelMat);
    handle.position.y = -0.005;
    const stripe = new THREE.Mesh(new THREE.TorusGeometry(0.082, 0.008, 8, 24), accentMat);
    stripe.rotation.x = Math.PI / 2;
    stripe.position.y = -0.065;
    group.add(body, handle, stripe);
    return { group };
  }

  if (kind === 'ab-wheel') {
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.095, 0.055, 28), ironMat);
    wheel.rotation.x = Math.PI / 2;
    wheel.castShadow = true;
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.072, 0.012, 10, 28), accentMat);
    const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, 0.34, 12), steelMat);
    axle.rotation.x = Math.PI / 2;
    group.add(wheel, rim, axle);
    return { group };
  }

  // Cable handle or rope
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.16, 12), accentMat);
  handle.rotation.x = Math.PI / 2;
  group.add(handle);
  const cableMat = new THREE.LineBasicMaterial({ color: 0x94a3b8 });
  const cableLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), cableMat);
  group.add(cableLine);

  if (kind === 'rope') {
    const ropeMat = new THREE.LineBasicMaterial({ color: 0x334155 });
    const ropeL = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), ropeMat);
    const ropeR = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), ropeMat);
    group.add(ropeL, ropeR);
    return { group, cableLine, ropeL, ropeR };
  }

  return { group, cableLine };
}

function buildSceneEnvironment(sceneKind: SceneKind, exerciseId: string, accentColor: THREE.Color) {
  const env = new THREE.Group();
  const metalMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.65, roughness: 0.35 });
  const darkMetal = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.55, roughness: 0.42 });
  const padMat = new THREE.MeshStandardMaterial({ color: 0x172030, metalness: 0.1, roughness: 0.72 });
  const accentMat = new THREE.MeshStandardMaterial({
    color: accentColor,
    metalness: 0.25,
    roughness: 0.4,
    emissive: accentColor,
    emissiveIntensity: 0.2,
  });

  if (sceneKind === 'floor' && MAT_EXERCISES.has(exerciseId)) {
    const mat = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.02, 0.75), padMat);
    mat.position.set(0, 0.01, 0);
    mat.receiveShadow = true;
    env.add(mat);
  }

  if (sceneKind === 'bench' || sceneKind === 'incline-bench' || sceneKind === 'decline-bench') {
    const benchY = (FLOOR_PY - (sceneKind === 'incline-bench' ? 192 : sceneKind === 'decline-bench' ? 185 : 188)) * SCALE;
    const pad = new THREE.Mesh(new THREE.BoxGeometry(1.22, 0.08, 0.30), padMat);
    pad.position.set(-0.06, benchY - 0.04, 0);
    if (sceneKind === 'incline-bench') {
      pad.rotation.z = 0.42;
      pad.position.set(-0.14, benchY + 0.08, 0);
    }
    pad.castShadow = true;
    pad.receiveShadow = true;
    env.add(pad);

    for (const lx of [-0.46, 0.36]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, benchY - 0.04, 12), metalMat);
      leg.position.set(lx, (benchY - 0.04) / 2, 0);
      leg.castShadow = true;
      env.add(leg);
      const foot = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.02, 0.36), darkMetal);
      foot.position.set(lx, 0.01, 0);
      env.add(foot);
    }
  }

  if (sceneKind === 'machine-seat' || sceneKind === 'preacher') {
    const seatY = (FLOOR_PY - 181) * SCALE;
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.08, 0.34), padMat);
    seat.position.set(-0.2, seatY, 0);
    seat.castShadow = true;
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.72, 0.32), padMat);
    back.position.set(-0.43, seatY + 0.36, 0);
    back.castShadow = true;
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, seatY, 12), metalMat);
    post.position.set(-0.2, seatY / 2, 0);
    env.add(seat, back, post);
    if (sceneKind === 'preacher') {
      const pPad = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.07, 0.34), accentMat);
      pPad.position.set(0.11, seatY + 0.34, 0);
      pPad.rotation.z = -0.45;
      env.add(pPad);
    }
  }

  if (sceneKind === 'pullup') {
    const barY = (FLOOR_PY - 16) * SCALE;
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 1.38, 16), darkMetal);
    bar.rotation.z = Math.PI / 2;
    bar.position.set(0, barY, 0);
    bar.castShadow = true;
    env.add(bar);
    for (const sx of [-0.62, 0.62]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, barY, 14), metalMat);
      post.position.set(sx, barY / 2, 0);
      post.castShadow = true;
      env.add(post);
    }
  }

  if (sceneKind === 'dip-bars') {
    const barY = (FLOOR_PY - 160) * SCALE;
    for (const sx of [-0.26, 0.26]) {
      const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.56, 12), metalMat);
      rail.rotation.x = Math.PI / 2;
      rail.position.set(sx, barY, 0);
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, barY, 12), metalMat);
      post.position.set(sx, barY / 2, -0.24);
      env.add(rail, post);
    }
  }

  if (sceneKind === 'cable' || sceneKind === 'high-cable') {
    const towerX = (289 - 160) * SCALE;
    const col = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.85, 0.20), darkMetal);
    col.position.set(towerX, 0.925, 0);
    col.castShadow = true;
    env.add(col);
    for (let i = 0; i < 8; i++) {
      const plate = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.07, 0.16), metalMat);
      plate.position.set(towerX, 0.22 + i * 0.11, 0);
      env.add(plate);
    }
    const pulleyY = (FLOOR_PY - (sceneKind === 'high-cable' ? 39 : 260)) * SCALE;
    const pulley = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.03, 18), accentMat);
    pulley.rotation.x = Math.PI / 2;
    pulley.position.set(towerX - 0.07, pulleyY, 0);
    env.add(pulley);
    if (exerciseId === 'lat-pulldown') {
      const seatY = (FLOOR_PY - 172) * SCALE;
      const seat = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.08, 0.34), padMat);
      seat.position.set(0, seatY, 0);
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, seatY, 12), metalMat);
      post.position.set(0, seatY / 2, 0);
      env.add(seat, post);
    }
  }

  if (sceneKind === 'roman-chair') {
    const padY = (FLOOR_PY - 170) * SCALE;
    const pad = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.10, 0.34), padMat);
    pad.position.set(-0.28, padY, 0);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, padY, 12), metalMat);
    post.position.set(-0.28, padY / 2, 0);
    env.add(pad, post);
  }

  if (sceneKind === 'leg-press') {
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.09, 0.36), padMat);
    back.position.set(-0.46, 0.72, 0);
    back.rotation.z = -0.68;
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.96, 0.22), metalMat);
    rail.position.set(0.52, 1.15, 0);
    rail.rotation.z = 0.56;
    const sled = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.62, 0.48), darkMetal);
    sled.position.set(0.50, 1.15, 0);
    sled.rotation.z = 0.56;
    env.add(back, rail, sled);
  }

  if (sceneKind === 'bike') {
    const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.026, 12, 28), metalMat);
    wheel.position.set(0.06, 0.34, 0);
    const seatPost = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.65, 10), darkMetal);
    seatPost.position.set(-0.18, 0.35, 0);
    const handlePost = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.85, 10), darkMetal);
    handlePost.position.set(0.28, 0.45, 0);
    handlePost.rotation.z = 0.25;
    env.add(wheel, seatPost, handlePost);
  }

  if (sceneKind === 'rower') {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.05, 0.14), metalMat);
    rail.position.set(0.04, 0.28, 0);
    const flywheel = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.08, 22), darkMetal);
    flywheel.rotation.x = Math.PI / 2;
    flywheel.position.set(0.76, 0.46, 0);
    env.add(rail, flywheel);
  }

  if (sceneKind === 'treadmill') {
    const deck = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.09, 0.54), darkMetal);
    deck.position.set(0.04, 0.09, 0);
    const mast = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.05, 0.48), metalMat);
    mast.position.set(0.68, 0.58, 0);
    mast.rotation.z = 0.12;
    env.add(deck, mast);
  }

  return env;
}

export function ExerciseStage3D({
  exerciseId,
  exerciseName,
  profile,
  primary,
  accent,
  paused,
  slow,
  resetSignal,
  onPhaseChange,
  onWebGLError,
}: Stage3DProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const pausedRef = useRef(paused);
  const slowRef = useRef(slow);
  const onPhaseRef = useRef(onPhaseChange);
  pausedRef.current = paused;
  slowRef.current = slow;
  onPhaseRef.current = onPhaseChange;

  const controlsRef = useRef<OrbitControls | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const defaultCamPos = useRef(new THREE.Vector3());
  const defaultTarget = useRef(new THREE.Vector3());

  useEffect(() => {
    if (resetSignal === 0) return;
    const cam = cameraRef.current;
    const ctrl = controlsRef.current;
    if (!cam || !ctrl) return;
    cam.position.copy(defaultCamPos.current);
    ctrl.target.copy(defaultTarget.current);
    ctrl.update();
  }, [resetSignal]);

  useEffect(() => {
    const container = hostRef.current;
    if (!container) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    } catch {
      onWebGLError?.();
      return;
    }

    const accentColor = new THREE.Color(accent);
    const scene = new THREE.Scene();
    const isDark = document.documentElement.classList.contains('dark');

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(container.clientWidth || 320, container.clientHeight || 300);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const camera = new THREE.PerspectiveCamera(
      36,
      (container.clientWidth || 320) / (container.clientHeight || 300),
      0.1,
      30,
    );
    const camPos =
      profile.view === 'front'
        ? new THREE.Vector3(0.42, 1.32, 3.05)
        : new THREE.Vector3(1.28, 1.32, 2.75);
    const camTarget = new THREE.Vector3(0, 0.88, 0);
    camera.position.copy(camPos);
    defaultCamPos.current.copy(camPos);
    defaultTarget.current.copy(camTarget);
    cameraRef.current = camera;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enablePan = false;
    controls.minDistance = 1.6;
    controls.maxDistance = 5.2;
    controls.minPolarAngle = 0.25;
    controls.maxPolarAngle = Math.PI / 2 - 0.03;
    controls.target.copy(camTarget);
    controls.update();
    controlsRef.current = controls;

    // Studio Lighting
    const hemi = new THREE.HemisphereLight(isDark ? 0xdbeafe : 0xffffff, isDark ? 0x0f172a : 0x94a3b8, isDark ? 0.95 : 1.15);
    scene.add(hemi);

    const key = new THREE.DirectionalLight(0xfff7ed, 2.0);
    key.position.set(2.4, 4.2, 2.8);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.near = 0.5;
    key.shadow.camera.far = 10;
    key.shadow.camera.left = -2;
    key.shadow.camera.right = 2;
    key.shadow.camera.top = 2.6;
    key.shadow.camera.bottom = -0.5;
    key.shadow.bias = -0.0005;
    scene.add(key);

    const rim = new THREE.DirectionalLight(0x93c5fd, 1.15);
    rim.position.set(-2.5, 2.4, -2.2);
    scene.add(rim);

    const accentFill = new THREE.PointLight(accentColor, 1.2, 4.5);
    accentFill.position.set(0, 1.1, 1.4);
    scene.add(accentFill);

    // Gym Floor Platform + Subtle Grid
    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(2.6, 48),
      new THREE.MeshStandardMaterial({
        color: isDark ? 0x0f172a : 0xe2e8f0,
        roughness: 0.88,
        metalness: 0.08,
      }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    const ring = new THREE.Mesh(
      new THREE.RingGeometry(1.18, 1.21, 64),
      new THREE.MeshBasicMaterial({ color: accentColor, transparent: true, opacity: 0.32, side: THREE.DoubleSide }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.002;
    scene.add(ring);

    const grid = new THREE.GridHelper(3.2, 16, isDark ? 0x334155 : 0xcbd5e1, isDark ? 0x1e293b : 0xdbe2ec);
    grid.position.y = 0.001;
    scene.add(grid);

    // Gym Environment (Bench, Rig, Cable Tower, Mat...)
    const envGroup = buildSceneEnvironment(profile.scene, exerciseId, accentColor);
    scene.add(envGroup);

    // Sculpted 3D Athletic Character
    const athlete = new THREE.Group();
    scene.add(athlete);

    const skinMat = new THREE.MeshStandardMaterial({ color: 0xe6ad86, roughness: 0.55, metalness: 0.04 });
    const hairMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.72, metalness: 0.08 });
    const tankMat = new THREE.MeshStandardMaterial({ color: 0x263449, roughness: 0.65, metalness: 0.12 });
    const shortsMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.78, metalness: 0.06 });
    const shoeMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.55, metalness: 0.1 });
    const soleMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.7, metalness: 0.02 });

    const glowMat = new THREE.MeshStandardMaterial({
      color: accentColor,
      emissive: accentColor,
      emissiveIntensity: 0.55,
      roughness: 0.42,
      metalness: 0.1,
    });

    const activeSet = new Set(primary);
    const armActive = activeSet.has('biceps') || activeSet.has('triceps');
    const forearmActive = activeSet.has('forearms');
    const shoulderActive = activeSet.has('frontDelts') || activeSet.has('sideDelts') || activeSet.has('rearDelts');
    const thighActive = activeSet.has('quads') || activeSet.has('hamstrings') || activeSet.has('adductors') || activeSet.has('hipFlexors');
    const calfActive = activeSet.has('calves');
    const gluteActive = activeSet.has('glutes');
    const pecActive = activeSet.has('pecs') || activeSet.has('upperPecs');
    const backActive = activeSet.has('lats') || activeSet.has('rhomboids') || activeSet.has('traps') || activeSet.has('lowerBack');
    const coreActive = activeSet.has('abs') || activeSet.has('obliques');

    // Lathe limb geometries
    const upperArmGeo = makeMuscleLathe(0.048, 0.058, 0.041, 0.44);
    const forearmGeo = makeMuscleLathe(0.041, 0.046, 0.029, 0.28);
    const thighGeo = makeMuscleLathe(0.078, 0.086, 0.056, 0.42);
    const calfGeo = makeMuscleLathe(0.054, 0.062, 0.036, 0.34);
    const neckGeo = makeMuscleLathe(0.044, 0.048, 0.056, 0.5);
    const shortLegGeo = makeMuscleLathe(0.084, 0.082, 0.075, 0.4);

    const makeMesh = (geo: THREE.BufferGeometry, mat: THREE.Material) => {
      const m = new THREE.Mesh(geo, mat);
      m.castShadow = true;
      m.receiveShadow = true;
      athlete.add(m);
      return m;
    };

    const upperArmL = makeMesh(upperArmGeo, armActive ? glowMat : skinMat);
    const upperArmR = makeMesh(upperArmGeo, armActive ? glowMat : skinMat);
    const forearmL = makeMesh(forearmGeo, forearmActive ? glowMat : skinMat);
    const forearmR = makeMesh(forearmGeo, forearmActive ? glowMat : skinMat);
    const thighL = makeMesh(thighGeo, thighActive ? glowMat : skinMat);
    const thighR = makeMesh(thighGeo, thighActive ? glowMat : skinMat);
    const calfL = makeMesh(calfGeo, calfActive ? glowMat : skinMat);
    const calfR = makeMesh(calfGeo, calfActive ? glowMat : skinMat);
    const neckMesh = makeMesh(neckGeo, skinMat);
    const shortL = makeMesh(shortLegGeo, shortsMat);
    const shortR = makeMesh(shortLegGeo, shortsMat);

    // Smooth joints (shoulders, elbows, knees, hands)
    const jointGeo = new THREE.SphereGeometry(1, 16, 14);
    const makeJoint = (r: number, mat: THREE.Material) => {
      const m = new THREE.Mesh(jointGeo, mat);
      m.scale.setScalar(r);
      m.castShadow = true;
      athlete.add(m);
      return m;
    };
    const shoulderCapL = makeJoint(0.064, shoulderActive ? glowMat : skinMat);
    const shoulderCapR = makeJoint(0.064, shoulderActive ? glowMat : skinMat);
    const elbowL = makeJoint(0.041, skinMat);
    const elbowR = makeJoint(0.041, skinMat);
    const kneeL = makeJoint(0.056, skinMat);
    const kneeR = makeJoint(0.056, skinMat);
    const handL = makeJoint(0.036, skinMat);
    const handR = makeJoint(0.036, skinMat);

    // Pelvis / Shorts Waistband
    const pelvis = new THREE.Mesh(new THREE.SphereGeometry(0.115, 20, 16), gluteActive ? glowMat : shortsMat);
    pelvis.scale.set(1.0, 0.85, 1.35);
    pelvis.castShadow = true;
    athlete.add(pelvis);

    // Sculpted Torso Group (V-taper tank + optional pec/back/core highlight plates)
    const torsoGroup = new THREE.Group();
    const chestGeo = makeMuscleLathe(0.105, 0.145, 0.158, 0.65);
    const chestMesh = new THREE.Mesh(chestGeo, tankMat);
    chestMesh.scale.set(0.68, 1, 1.12);
    chestMesh.castShadow = true;
    chestMesh.receiveShadow = true;
    torsoGroup.add(chestMesh);

    // Contoured 3D Muscle Highlight Plates inside Torso
    const pecPlates = new THREE.Group();
    for (const s of [-1, 1]) {
      const pec = new THREE.Mesh(new THREE.SphereGeometry(0.065, 16, 14), glowMat);
      pec.scale.set(0.58, 0.88, 1.05);
      pec.position.set(0.072, 0.72, s * 0.078);
      pecPlates.add(pec);
    }
    pecPlates.visible = pecActive;
    torsoGroup.add(pecPlates);

    const backPlates = new THREE.Group();
    for (const s of [-1, 1]) {
      const lat = new THREE.Mesh(new THREE.SphereGeometry(0.08, 16, 14), glowMat);
      lat.scale.set(0.45, 1.55, 0.95);
      lat.position.set(-0.075, 0.64, s * 0.075);
      lat.rotation.x = s * -0.18;
      backPlates.add(lat);
    }
    backPlates.visible = backActive;
    torsoGroup.add(backPlates);

    const corePlate = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.34, 0.13), glowMat);
    corePlate.position.set(0.078, 0.35, 0);
    corePlate.visible = coreActive;
    torsoGroup.add(corePlate);

    athlete.add(torsoGroup);

    // Sculpted Head & Hair Group
    const headGroup = new THREE.Group();
    const cranium = new THREE.Mesh(new THREE.SphereGeometry(0.095, 24, 20), skinMat);
    cranium.scale.set(0.95, 1.15, 0.86);
    cranium.castShadow = true;
    const jaw = new THREE.Mesh(new THREE.SphereGeometry(0.072, 18, 14), skinMat);
    jaw.scale.set(0.9, 0.85, 0.78);
    jaw.position.set(0.015, -0.042, 0);
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.099, 22, 16, 0, Math.PI * 2, 0, Math.PI * 0.56), hairMat);
    hair.scale.set(0.98, 1.12, 0.89);
    hair.position.set(-0.008, 0.014, 0);
    hair.rotation.z = 0.25;
    hair.castShadow = true;
    headGroup.add(cranium, jaw, hair);
    athlete.add(headGroup);

    // Sculpted 3D Athletic Shoes
    const makeShoe = () => {
      const g = new THREE.Group();
      const upper = new THREE.Mesh(new THREE.BoxGeometry(0.078, 0.046, 0.145), shoeMat);
      upper.position.y = 0.012;
      upper.castShadow = true;
      const sole = new THREE.Mesh(new THREE.BoxGeometry(0.082, 0.016, 0.152), soleMat);
      sole.position.y = -0.014;
      sole.castShadow = true;
      g.add(upper, sole);
      athlete.add(g);
      return g;
    };
    const shoeL = makeShoe();
    const shoeR = makeShoe();

    // 3D Equipment + Movement Path Trail
    const propObj = createPropMesh(profile.prop, accentColor);
    scene.add(propObj.group);

    const startPose = profile.frames[0].pose;
    const endPose = profile.frames[profile.frames.length - 1].pose;
    const start3D = poseTo3D(startPose, profile, exerciseId, 0);
    const end3D = poseTo3D(endPose, profile, exerciseId, 1);
    const startMid = new THREE.Vector3().addVectors(start3D.handL, start3D.handR).multiplyScalar(0.5);
    const endMid = new THREE.Vector3().addVectors(end3D.handL, end3D.handR).multiplyScalar(0.5);
    let trailLine: THREE.Line | null = null;
    if (startMid.distanceTo(endMid) > 0.12 && exerciseId !== 'farmers-walk') {
      const trailGeo = new THREE.BufferGeometry().setFromPoints([startMid, endMid]);
      const trailMat = new THREE.LineDashedMaterial({ color: accentColor, dashSize: 0.04, gapSize: 0.035, transparent: true, opacity: 0.45 });
      trailLine = new THREE.Line(trailGeo, trailMat);
      trailLine.computeLineDistances();
      scene.add(trailLine);
    }

    // Animation loop
    let raf = 0;
    let phase = 0;
    let lastTime = performance.now();
    let lastLabel = '';

    const updatePose = (t: number) => {
      const eased = wave(t);
      const rawPose = interpolatePose(startPose, endPose, eased);
      const p3 = poseTo3D(rawPose, profile, exerciseId, eased);

      const label = eased < 0.5 ? profile.frames[0].label : profile.frames[profile.frames.length - 1].label;
      if (label !== lastLabel || !pausedRef.current) {
        lastLabel = label;
        onPhaseRef.current?.(t, label);
      }

      // Pulse emissive highlight gently
      glowMat.emissiveIntensity = 0.42 + 0.35 * (0.5 + 0.5 * Math.sin(performance.now() * 0.005));

      const hipMid = new THREE.Vector3().addVectors(p3.hipL, p3.hipR).multiplyScalar(0.5);
      const shoulderMid = new THREE.Vector3().addVectors(p3.shoulderL, p3.shoulderR).multiplyScalar(0.5);

      // Torso basis: +Y = spine (hip -> shoulder), +Z = left-to-right shoulder vector, +X = anatomical front!
      const spine = new THREE.Vector3().subVectors(shoulderMid, hipMid);
      const spineLen = Math.max(0.15, spine.length());
      const spineUp = spine.clone().normalize();
      const lr = new THREE.Vector3().subVectors(p3.shoulderL, p3.shoulderR);
      if (lr.lengthSq() < 1e-4) lr.set(0, 0, 1);
      lr.normalize();
      let frontX = new THREE.Vector3().crossVectors(spineUp, lr).normalize();

      // Verify frontX aligns toward hands/toes in side view
      const handMid = new THREE.Vector3().addVectors(p3.handL, p3.handR).multiplyScalar(0.5);
      const toeMid = new THREE.Vector3().addVectors(p3.toeL, p3.toeR).multiplyScalar(0.5);
      const ankleMid = new THREE.Vector3().addVectors(p3.ankleL, p3.ankleR).multiplyScalar(0.5);
      const refDir = new THREE.Vector3().addVectors(handMid, toeMid).sub(shoulderMid).sub(ankleMid);
      if (profile.view === 'side' && frontX.dot(refDir) < 0) frontX.negate();
      // In front view, frontX should face camera (+Z)
      if (profile.view === 'front') {
        frontX.set(0, 0, 1);
        const sideZ = new THREE.Vector3().crossVectors(frontX, spineUp).normalize();
        const basis = new THREE.Matrix4().makeBasis(frontX, spineUp, sideZ);
        torsoGroup.position.copy(hipMid);
        torsoGroup.quaternion.setFromRotationMatrix(basis);
        torsoGroup.scale.set(1, spineLen, 1);
      } else {
        const sideZ = new THREE.Vector3().crossVectors(frontX, spineUp).normalize();
        const basis = new THREE.Matrix4().makeBasis(frontX, spineUp, sideZ);
        torsoGroup.position.copy(hipMid);
        torsoGroup.quaternion.setFromRotationMatrix(basis);
        torsoGroup.scale.set(1, spineLen, 1);
      }

      pelvis.position.copy(hipMid);
      pelvis.quaternion.copy(torsoGroup.quaternion);

      // Neck & Head
      placeBetween(neckMesh, shoulderMid, p3.head.clone().lerp(shoulderMid, 0.35));
      headGroup.position.copy(p3.head);
      const headUp = new THREE.Vector3().subVectors(p3.head, p3.neck).normalize();
      const headSide = new THREE.Vector3().crossVectors(frontX, headUp).normalize();
      const headFront = new THREE.Vector3().crossVectors(headUp, headSide).normalize();
      headGroup.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(headFront, headUp, headSide));

      // Arms & Shoulders
      shoulderCapL.position.copy(p3.shoulderL);
      shoulderCapR.position.copy(p3.shoulderR);
      placeBetween(upperArmL, p3.shoulderL, p3.elbowL);
      placeBetween(upperArmR, p3.shoulderR, p3.elbowR);
      elbowL.position.copy(p3.elbowL);
      elbowR.position.copy(p3.elbowR);
      placeBetween(forearmL, p3.elbowL, p3.handL);
      placeBetween(forearmR, p3.elbowR, p3.handR);
      handL.position.copy(p3.handL);
      handR.position.copy(p3.handR);

      // Legs & Shorts
      placeBetween(thighL, p3.hipL, p3.kneeL);
      placeBetween(thighR, p3.hipR, p3.kneeR);
      placeBetween(shortL, p3.hipL, p3.hipL.clone().lerp(p3.kneeL, 0.42));
      placeBetween(shortR, p3.hipR, p3.hipR.clone().lerp(p3.kneeR, 0.42));
      kneeL.position.copy(p3.kneeL);
      kneeR.position.copy(p3.kneeR);
      placeBetween(calfL, p3.kneeL, p3.ankleL);
      placeBetween(calfR, p3.kneeR, p3.ankleR);
      placeShoe(shoeL, p3.ankleL, p3.toeL, p3.kneeL);
      placeShoe(shoeR, p3.ankleR, p3.toeR, p3.kneeR);

      // Equipment transform
      if (profile.prop === 'barbell' || profile.prop === 'ez-bar') {
        const onBack = exerciseId === 'squat' || exerciseId === 'good-morning';
        const onHips = exerciseId === 'hip-thrust';
        const center = onBack ? shoulderMid : onHips ? hipMid : handMid;
        propObj.group.position.copy(center);
        if (profile.view === 'front') {
          const barDir = new THREE.Vector3().subVectors(p3.handR, p3.handL).normalize();
          propObj.group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), barDir);
        } else {
          propObj.group.rotation.set(0, 0, 0);
        }
      } else if (profile.prop === 'dumbbells') {
        const dbL = propObj.group.getObjectByName('dbL');
        const dbR = propObj.group.getObjectByName('dbR');
        if (dbL && dbR) {
          dbL.position.copy(p3.handL);
          dbR.position.copy(p3.handR);
          if (profile.view === 'front') {
            dbL.rotation.set(0, Math.PI / 2, 0.12);
            dbR.rotation.set(0, Math.PI / 2, -0.12);
          } else {
            dbL.rotation.set(0, 0, 0);
            dbR.rotation.set(0, 0, 0);
          }
        }
      } else if (profile.prop === 'kettlebell' || profile.prop === 'ab-wheel') {
        propObj.group.position.copy(handMid);
      } else if (profile.prop === 'cable-handle' || profile.prop === 'rope') {
        const anchor = toVec(
          { x: 289, y: profile.scene === 'high-cable' ? 39 : 260 },
          0,
        );
        if (exerciseId === 'cable-kickback') {
          propObj.group.children[0].position.copy(p3.ankleR);
          propObj.cableLine?.geometry.setFromPoints([anchor, p3.ankleR]);
        } else {
          propObj.group.children[0].position.copy(handMid);
          propObj.cableLine?.geometry.setFromPoints([anchor, handMid]);
          if (propObj.ropeL && propObj.ropeR) {
            const top = handMid.clone().add(new THREE.Vector3(0, 0.06, 0));
            propObj.ropeL.geometry.setFromPoints([top, p3.handL]);
            propObj.ropeR.geometry.setFromPoints([top, p3.handR]);
          }
        }
      }
    };

    const tick = (now: number) => {
      const dt = Math.min(64, now - lastTime);
      lastTime = now;
      const tempo = slowRef.current ? profile.tempoMs * 1.75 : profile.tempoMs;
      if (!pausedRef.current && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        phase = (phase + dt / tempo) % 1;
      }
      updatePose(phase);
      controls.update();
      renderer.render(scene, camera);
      raf = requestAnimationFrame(tick);
    };

    updatePose(0);
    renderer.render(scene, camera);
    raf = requestAnimationFrame(tick);

    const ro = new ResizeObserver(() => {
      const w = container.clientWidth || 320;
      const h = container.clientHeight || 300;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    });
    ro.observe(container);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      controls.dispose();
      scene.traverse((obj) => {
        if ((obj as THREE.Mesh).geometry) (obj as THREE.Mesh).geometry.dispose();
        const mat = (obj as THREE.Mesh).material;
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
        else if (mat) mat.dispose();
      });
      trailLine?.geometry.dispose();
      renderer.dispose();
    };
  }, [exerciseId, exerciseName, profile, primary, accent, onWebGLError]);

  return (
    <div
      ref={hostRef}
      className="h-full w-full cursor-grab touch-none active:cursor-grabbing"
      role="img"
      aria-label={`${exerciseName} 3D animated form demonstration`}
    />
  );
}
