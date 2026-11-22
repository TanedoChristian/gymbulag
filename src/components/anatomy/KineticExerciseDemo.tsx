import { lazy, Suspense, useCallback, useEffect, useId, useMemo, useState } from 'react';
import { Gauge, Move3d, Pause, Play, RotateCcw } from 'lucide-react';
import type { Equipment } from '../../types';
import type { DemoKind } from '../../lib/exerciseGuides';
import type { MusclePart } from '../../lib/anatomy';
import { MUSCLE_PART_META } from '../../lib/anatomy';
import {
  getMotionProfile,
  interpolatePose,
  type FigurePose,
  type Point,
  type PropKind,
  type SceneKind,
} from '../../lib/exerciseMotions';

const ExerciseStage3D = lazy(() => import('./ExerciseStage3D').then((m) => ({ default: m.ExerciseStage3D })));

interface Props {
  exerciseId: string;
  exerciseName: string;
  equipment: Equipment;
  demo: DemoKind;
  primary: MusclePart[];
  className?: string;
}

function useMotion(tempoMs: number, paused: boolean) {
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    if (paused || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let raf = 0;
    const started = performance.now() - phase * tempoMs;
    const tick = (now: number) => {
      setPhase(((now - started) % tempoMs) / tempoMs);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [paused, tempoMs]);
  return phase;
}

function wave(phase: number) {
  const triangle = phase < 0.5 ? phase * 2 : (1 - phase) * 2;
  const held = Math.min(1, Math.max(0, (triangle - 0.07) / 0.86));
  return held * held * held * (held * (held * 6 - 15) + 10);
}

function mid(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function distance(a: Point, b: Point) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function axis(a: Point, b: Point) {
  const len = Math.max(1, distance(a, b));
  const ux = (b.x - a.x) / len;
  const uy = (b.y - a.y) / len;
  return { len, ux, uy, nx: -uy, ny: ux };
}

function at(a: Point, b: Point, t: number): Point {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

const fmt = (p: Point) => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`;

function taperLimbPath(a: Point, b: Point, startR: number, endR: number, belly = 1.15, bias = 0.44) {
  const { len, ux, uy, nx, ny } = axis(a, b);
  const steps = 10;
  const left: Point[] = [];
  const right: Point[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const curve = Math.sin(Math.PI * Math.pow(t, bias));
    const r = (startR + (endR - startR) * t) * (1 + (belly - 1) * curve);
    const x = a.x + ux * len * t;
    const y = a.y + uy * len * t;
    left.push({ x: x + nx * r, y: y + ny * r });
    right.push({ x: x - nx * r, y: y - ny * r });
  }
  return [
    `M ${fmt(left[0])}`,
    ...left.slice(1).map((p) => `L ${fmt(p)}`),
    `Q ${fmt({ x: b.x + ux * endR * 0.92, y: b.y + uy * endR * 0.92 })} ${fmt(right[right.length - 1])}`,
    ...right.slice(0, -1).reverse().map((p) => `L ${fmt(p)}`),
    `Q ${fmt({ x: a.x - ux * startR * 0.92, y: a.y - uy * startR * 0.92 })} ${fmt(left[0])}`,
    'Z',
  ].join(' ');
}

function shoePath(ankle: Point, toe: Point, knee: Point, scale = 1) {
  const { len, ux, uy, nx, ny } = axis(ankle, toe);
  const shin = { x: knee.x - ankle.x, y: knee.y - ankle.y };
  // Top of the shoe (cuff/laces) always faces toward the shin!
  const sign = nx * shin.x + ny * shin.y >= 0 ? 1 : -1;
  const upX = nx * sign;
  const upY = ny * sign;
  const heel = { x: ankle.x - ux * 4.5 * scale + upX * 2.2 * scale, y: ankle.y - uy * 4.5 * scale + upY * 2.2 * scale };
  const cuff = { x: ankle.x + upX * 5.2 * scale, y: ankle.y + upY * 5.2 * scale };
  const vamp = { x: ankle.x + ux * len * 0.56 + upX * 4.2 * scale, y: ankle.y + uy * len * 0.56 + upY * 4.2 * scale };
  const tip = { x: toe.x + ux * 3 * scale + upX * 0.4 * scale, y: toe.y + uy * 3 * scale + upY * 0.4 * scale };
  const ball = { x: toe.x - upX * 2.4 * scale, y: toe.y - upY * 2.4 * scale };
  const heelBase = { x: ankle.x - ux * 4.5 * scale - upX * 2.8 * scale, y: ankle.y - uy * 4.5 * scale - upY * 2.8 * scale };
  const body = `M ${fmt(heel)} Q ${fmt(cuff)} ${fmt(vamp)} Q ${fmt(tip)} ${fmt(ball)} L ${fmt(heelBase)} Z`;
  const sole = `M ${fmt(heelBase)} L ${fmt(ball)} L ${fmt({ x: ball.x + upX * 2 * scale, y: ball.y + upY * 2 * scale })} L ${fmt({ x: heelBase.x + upX * 2 * scale, y: heelBase.y + upY * 2 * scale })} Z`;
  return { body, sole };
}

function handPath(elbow: Point, hand: Point, scale = 1) {
  const { ux, uy, nx, ny } = axis(elbow, hand);
  const p0 = { x: hand.x - ux * 2 * scale + nx * 4.2 * scale, y: hand.y - uy * 2 * scale + ny * 4.2 * scale };
  const p1 = { x: hand.x + ux * 6.5 * scale + nx * 3.5 * scale, y: hand.y + uy * 6.5 * scale + ny * 3.5 * scale };
  const p2 = { x: hand.x + ux * 7.5 * scale, y: hand.y + uy * 7.5 * scale };
  const p3 = { x: hand.x + ux * 6.5 * scale - nx * 3.5 * scale, y: hand.y + uy * 6.5 * scale - ny * 3.5 * scale };
  const p4 = { x: hand.x - ux * 2 * scale - nx * 4.2 * scale, y: hand.y - uy * 2 * scale - ny * 4.2 * scale };
  return `M ${fmt(p0)} L ${fmt(p1)} Q ${fmt(p2)} ${fmt(p3)} L ${fmt(p4)} Z`;
}

/**
 * Seamless 2-pass limb renderer: strokes the combined upper + lower limb chain
 * behind the fills so elbows and knees blend cleanly without puppet cut lines.
 */
function LimbPair({
  a,
  joint,
  b,
  rA,
  rJoint,
  rB,
  bellyA = 1.15,
  bellyB = 1.16,
  fill,
  outline,
  upperGlow,
  lowerGlow,
  glowColor,
  endCap,
}: {
  a: Point;
  joint: Point;
  b: Point;
  rA: number;
  rJoint: number;
  rB: number;
  bellyA?: number;
  bellyB?: number;
  fill: string;
  outline: string;
  upperGlow?: boolean;
  lowerGlow?: boolean;
  glowColor: string;
  endCap?: string;
}) {
  const upper = taperLimbPath(a, joint, rA, rJoint, bellyA);
  const lower = taperLimbPath(joint, b, rJoint * 0.98, rB, bellyB);
  const upperG = upperGlow ? taperLimbPath(at(a, joint, 0.14), at(a, joint, 0.84), rA * 0.56, rJoint * 0.5, 1.24) : undefined;
  const lowerG = lowerGlow ? taperLimbPath(at(joint, b, 0.14), at(joint, b, 0.84), rJoint * 0.54, rB * 0.48, 1.22) : undefined;

  return (
    <g>
      {/* Pass 1: continuous outer outline */}
      <path d={upper} fill={outline} stroke={outline} strokeWidth="2.1" strokeLinejoin="round" />
      <path d={lower} fill={outline} stroke={outline} strokeWidth="2.1" strokeLinejoin="round" />
      {endCap && <path d={endCap} fill={outline} stroke={outline} strokeWidth="2.1" strokeLinejoin="round" />}
      {/* Pass 2: seamless interior fills */}
      <path d={upper} fill={fill} />
      <path d={lower} fill={fill} />
      {endCap && <path d={endCap} fill={fill} />}
      {upperG && <path d={upperG} fill={glowColor} opacity="0.68" className="motion-muscle-pulse" />}
      {lowerG && <path d={lowerG} fill={glowColor} opacity="0.68" className="motion-muscle-pulse" />}
    </g>
  );
}

const MAT_EXERCISES = new Set(['plank', 'push-up', 'ab-wheel', 'glute-bridge', 'russian-twist']);

function Scene({ exerciseId, kind, pose, accent }: { exerciseId: string; kind: SceneKind; pose: FigurePose; accent: string }) {
  const benchY = kind === 'incline-bench' ? 192 : kind === 'decline-bench' ? 185 : 188;
  const footCenterX = mid(pose.ankleL, pose.ankleR).x;
  const showMat = kind === 'floor' && MAT_EXERCISES.has(exerciseId);
  return (
    <g aria-hidden>
      <path d="M18 284 H302" stroke="var(--demo-floor)" strokeWidth="1.5" strokeLinecap="round" />
      <ellipse cx={showMat ? 155 : footCenterX} cy="285" rx={showMat ? 115 : 48} ry="5.5" fill="var(--demo-shadow)" />
      {showMat && (
        <g>
          <rect x="28" y="279" width="252" height="5" rx="2.5" fill="#1e293b" stroke="#0f172a" strokeWidth="1" />
          <line x1="32" y1="280.5" x2="276" y2="280.5" stroke="#475569" strokeWidth="1" strokeLinecap="round" />
        </g>
      )}

      {kind === 'treadmill' && (
        <g>
          <rect x="68" y="264" width="198" height="14" rx="7" fill="#334155" stroke="#0f172a" strokeWidth="1.5" />
          <rect x="76" y="268" width="182" height="4" rx="2" fill="#475569" />
          <circle cx="86" cy="279" r="6" fill="#0f172a" />
          <circle cx="248" cy="279" r="6" fill="#0f172a" />
          <path d="M244 264 L265 118 M263 118 H286" stroke="#475569" strokeWidth="5.5" strokeLinecap="round" />
        </g>
      )}
      {(kind === 'bench' || kind === 'incline-bench' || kind === 'decline-bench') && (
        <g>
          <path d="M102 196 L92 278 M210 196 L222 278" stroke="#475569" strokeWidth="6.5" strokeLinecap="round" />
          <path d="M84 278 H102 M212 278 H232" stroke="#334155" strokeWidth="4" strokeLinecap="round" />
          <line
            x1={kind === 'incline-bench' ? 82 : 66}
            y1={kind === 'incline-bench' ? 205 : benchY}
            x2={kind === 'incline-bench' ? 196 : 237}
            y2={kind === 'incline-bench' ? 151 : benchY}
            stroke="#1e293b"
            strokeWidth="14"
            strokeLinecap="round"
          />
          <line
            x1={kind === 'incline-bench' ? 85 : 69}
            y1={kind === 'incline-bench' ? 200 : benchY - 4}
            x2={kind === 'incline-bench' ? 193 : 234}
            y2={kind === 'incline-bench' ? 147 : benchY - 4}
            stroke="#334155"
            strokeWidth="3"
            strokeLinecap="round"
          />
        </g>
      )}
      {(kind === 'machine-seat' || kind === 'preacher') && (
        <g>
          <path d="M112 195 L102 278 M164 195 L174 278" stroke="#475569" strokeWidth="6.5" strokeLinecap="round" />
          <rect x="88" y="181" width="89" height="14" rx="7" fill="#1e293b" stroke="#0f172a" strokeWidth="1.5" />
          <rect x="95" y="88" width="13" height="102" rx="6" fill="#334155" stroke="#0f172a" strokeWidth="1.5" />
          {kind === 'preacher' && <path d="M146 121 L205 150" stroke={accent} strokeOpacity={0.65} strokeWidth="13" strokeLinecap="round" />}
        </g>
      )}
      {kind === 'leg-press' && (
        <g>
          <path d="M64 237 L132 153" stroke="#1e293b" strokeWidth="17" strokeLinecap="round" />
          <path d="M198 70 L263 169" stroke="#475569" strokeWidth="8.5" strokeLinecap="round" />
          <rect x="218" y="78" width="15" height="108" rx="6" fill="#334155" transform="rotate(-33 226 132)" />
        </g>
      )}
      {kind === 'roman-chair' && (
        <g>
          <path d="M104 179 L84 278 M137 180 L151 278" stroke="#475569" strokeWidth="7" strokeLinecap="round" />
          <rect x="94" y="165" width="55" height="16" rx="8" fill="#1e293b" stroke="#0f172a" strokeWidth="1.5" />
        </g>
      )}
      {kind === 'pullup' && (
        <g>
          <path d="M84 16 V282 M236 16 V282" stroke="#475569" strokeOpacity={0.5} strokeWidth="5" strokeLinecap="round" />
          <path d="M70 16 H250" stroke="#1e293b" strokeWidth="8" strokeLinecap="round" />
          <path d="M74 14 H246" stroke="#64748b" strokeWidth="2" strokeLinecap="round" />
        </g>
      )}
      {kind === 'dip-bars' && (
        <g stroke="#475569" strokeWidth="6.5" strokeLinecap="round">
          <path d="M89 160 H134 V280" fill="none" />
          <path d="M231 160 H186 V280" fill="none" />
        </g>
      )}
      {(kind === 'cable' || kind === 'high-cable') && (
        <g>
          <rect x="279" y="24" width="20" height="252" rx="7" fill="#1e293b" stroke="#0f172a" strokeWidth="1.5" />
          {[55, 78, 101, 124, 147, 170, 193, 216, 239].map((y) => (
            <rect key={y} x="283" y={y} width="12" height="14" rx="2" fill="#475569" />
          ))}
          <circle cx="289" cy={kind === 'high-cable' ? 39 : 260} r="6.5" fill={accent} stroke="#0f172a" strokeWidth="1.5" />
          {exerciseId === 'lat-pulldown' && (
            <>
              <rect x="124" y="166" width="72" height="13" rx="6" fill="#1e293b" />
              <rect x="112" y="181" width="96" height="12" rx="6" fill="#475569" />
              <path d="M137 179 L128 280 M183 179 L192 280" stroke="#334155" strokeWidth="6.5" strokeLinecap="round" />
            </>
          )}
        </g>
      )}
      {kind === 'bike' && (
        <g>
          <circle cx="167" cy="236" r="34" fill="none" stroke="#475569" strokeWidth="7" />
          <circle cx="167" cy="236" r="5" fill={accent} />
          <path
            d="M167 236 L142 178 H190 L167 236 M190 178 L211 136 M201 136 H225 M142 178 L122 144 H101"
            stroke="#334155"
            strokeWidth="6.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </g>
      )}
      {kind === 'rower' && (
        <g>
          <path d="M58 245 H272" stroke="#475569" strokeWidth="7.5" strokeLinecap="round" />
          <rect x="105" y="226" width="45" height="14" rx="7" fill="#1e293b" />
          <path d="M258 245 L275 108 H290" stroke="#334155" strokeWidth="6.5" fill="none" strokeLinecap="round" />
        </g>
      )}
    </g>
  );
}

function EquipmentLayer({
  exerciseId,
  kind,
  scene,
  pose,
  accent,
  sideView,
}: {
  exerciseId: string;
  kind: PropKind;
  scene: SceneKind;
  pose: FigurePose;
  accent: string;
  sideView: boolean;
}) {
  const handMid = mid(pose.handL, pose.handR);
  const shoulderMid = mid(pose.shoulderL, pose.shoulderR);
  const hipMid = mid(pose.hipL, pose.hipR);
  if (kind === 'none') return null;

  if (kind === 'dumbbells') {
    return (
      <g>
        {[pose.handL, pose.handR].map((h, i) => (
          <g key={i} transform={`translate(${h.x} ${h.y}) rotate(${i ? -6 : 6})`}>
            <rect x="-12" y="-3" width="24" height="6" rx="3" fill="#475569" stroke="#0f172a" strokeWidth="1.2" />
            <rect x="-16" y="-8" width="6.5" height="16" rx="2.5" fill="#1e293b" stroke="#0f172a" strokeWidth="1.2" />
            <rect x="9.5" y="-8" width="6.5" height="16" rx="2.5" fill="#1e293b" stroke="#0f172a" strokeWidth="1.2" />
            <rect x="-14.5" y="-6" width="2.5" height="12" rx="1" fill={accent} />
            <rect x="12" y="-6" width="2.5" height="12" rx="1" fill={accent} />
          </g>
        ))}
      </g>
    );
  }
  if (kind === 'barbell' || kind === 'ez-bar') {
    const onBack = exerciseId === 'squat' || exerciseId === 'good-morning';
    const onHips = exerciseId === 'hip-thrust';
    const center = onBack ? shoulderMid : onHips ? hipMid : handMid;
    const handAngle = (Math.atan2(pose.handR.y - pose.handL.y, pose.handR.x - pose.handL.x) * 180) / Math.PI;
    const angle = onBack || onHips || sideView ? 0 : handAngle;
    const length = onBack ? 108 : sideView ? 70 : Math.max(92, distance(pose.handL, pose.handR) + 42);
    return (
      <g>
        {exerciseId === 'lat-pulldown' && <line x1="289" y1="39" x2={center.x} y2={center.y} stroke="#94a3b8" strokeWidth="2" />}
        <g transform={`translate(${center.x} ${center.y}) rotate(${angle})`}>
          <line x1={-length / 2} x2={length / 2} stroke="#cbd5e1" strokeWidth="4.5" strokeLinecap="round" />
          <rect x={-length / 2 - 6} y="-14" width="9" height="28" rx="3" fill="#1e293b" stroke="#0f172a" strokeWidth="1.3" />
          <rect x={length / 2 - 3} y="-14" width="9" height="28" rx="3" fill="#1e293b" stroke="#0f172a" strokeWidth="1.3" />
          <rect x={-length / 2 + 5} y="-10" width="5" height="20" rx="2" fill={accent} />
          <rect x={length / 2 - 10} y="-10" width="5" height="20" rx="2" fill={accent} />
        </g>
      </g>
    );
  }
  if (kind === 'kettlebell') {
    return (
      <g transform={`translate(${handMid.x} ${handMid.y + 10})`}>
        <path d="M-9 -4 C-9 -17 9 -17 9 -4" fill="none" stroke="#cbd5e1" strokeWidth="4.5" />
        <path d="M-13 1 Q0 -8 13 1 L11 18 Q0 26 -11 18 Z" fill="#1e293b" stroke={accent} strokeWidth="2.4" />
      </g>
    );
  }
  if (kind === 'ab-wheel') {
    return (
      <g transform={`translate(${handMid.x} ${handMid.y})`}>
        <circle r="13" fill="#1e293b" stroke={accent} strokeWidth="3.5" />
        <line x1="-22" x2="22" stroke="#cbd5e1" strokeWidth="4.5" strokeLinecap="round" />
      </g>
    );
  }
  if (exerciseId === 'cable-kickback') {
    const ankle = pose.ankleR;
    return (
      <g>
        <line x1="289" y1="260" x2={ankle.x} y2={ankle.y} stroke="#94a3b8" strokeWidth="2" />
        <rect x={ankle.x - 8} y={ankle.y - 5} width="16" height="10" rx="5" fill={accent} stroke="#0f172a" strokeWidth="1.5" />
      </g>
    );
  }
  const anchor = scene === 'high-cable' ? { x: 289, y: 39 } : { x: 289, y: 260 };
  return (
    <g>
      <line x1={anchor.x} y1={anchor.y} x2={handMid.x} y2={handMid.y} stroke="#94a3b8" strokeWidth="2" />
      {kind === 'rope' ? (
        <>
          <line x1={handMid.x} y1={handMid.y - 10} x2={pose.handL.x} y2={pose.handL.y} stroke="#334155" strokeWidth="4.5" strokeLinecap="round" />
          <line x1={handMid.x} y1={handMid.y - 10} x2={pose.handR.x} y2={pose.handR.y} stroke="#334155" strokeWidth="4.5" strokeLinecap="round" />
        </>
      ) : (
        <circle cx={handMid.x} cy={handMid.y} r="6.5" fill={accent} stroke="#0f172a" strokeWidth="2" />
      )}
    </g>
  );
}

/**
 * Seamless athletic character with two-pass limb outlines (zero joint cut rings),
 * coordinate-frame side-profile orientation (works upright, hinged, supine, or prone),
 * fitted athletic gear, and anatomically contoured muscle highlights.
 */
function Athlete({
  pose,
  primary,
  accent,
  uid,
  sideView,
}: {
  pose: FigurePose;
  primary: MusclePart[];
  accent: string;
  uid: string;
  sideView: boolean;
}) {
  const active = new Set(primary);
  const armGlow = active.has('biceps') || active.has('triceps');
  const forearmGlow = active.has('forearms');
  const shoulderGlow = active.has('sideDelts') || active.has('frontDelts') || active.has('rearDelts');
  const thighGlow = active.has('quads') || active.has('hamstrings') || active.has('adductors') || active.has('hipFlexors');
  const gluteGlow = active.has('glutes');
  const calfGlow = active.has('calves');
  const pecGlow = active.has('pecs') || active.has('upperPecs');
  const backGlow = active.has('lats') || active.has('rhomboids') || active.has('traps') || active.has('lowerBack');
  const coreGlow = active.has('abs') || active.has('obliques');

  const shoulderMid = mid(pose.shoulderL, pose.shoulderR);
  const hipMid = mid(pose.hipL, pose.hipR);
  const handMid = mid(pose.handL, pose.handR);
  const toeMid = mid(pose.toeL, pose.toeR);
  const ankleMid = mid(pose.ankleL, pose.ankleR);
  const { ux, uy, nx, ny } = axis(shoulderMid, hipMid);

  // True anatomical front normal (nx, ny) aligned toward hands/toes so lying/bent/standing poses always face properly
  const refX = handMid.x + toeMid.x - shoulderMid.x - ankleMid.x;
  const refY = handMid.y + toeMid.y - shoulderMid.y - ankleMid.y;
  const flip = nx * refX + ny * refY >= 0 ? 1 : -1;
  const fNx = nx * flip;
  const fNy = ny * flip;

  const shoulderGap = distance(pose.shoulderL, pose.shoulderR);
  const isProfile = sideView || shoulderGap < 34;

  // Torso shape
  const torsoShape = isProfile
    ? (() => {
        const chestPt = at(shoulderMid, hipMid, 0.28);
        const waistPt = at(shoulderMid, hipMid, 0.72);
        const sf = { x: shoulderMid.x + fNx * 13.5, y: shoulderMid.y + fNy * 13.5 };
        const sb = { x: shoulderMid.x - fNx * 12.5, y: shoulderMid.y - fNy * 12.5 };
        const cf = { x: chestPt.x + fNx * 15.5, y: chestPt.y + fNy * 15.5 };
        const cb = { x: chestPt.x - fNx * 13.5, y: chestPt.y - fNy * 13.5 };
        const wf = { x: waistPt.x + fNx * 11.5, y: waistPt.y + fNy * 11.5 };
        const wb = { x: waistPt.x - fNx * 11.5, y: waistPt.y - fNy * 11.5 };
        const hf = { x: hipMid.x + fNx * 12.5, y: hipMid.y + fNy * 12.5 };
        const hb = { x: hipMid.x - fNx * 12.5, y: hipMid.y - fNy * 12.5 };
        return `M ${fmt(sf)} C ${fmt(cf)} ${fmt(wf)} ${fmt(hf)} L ${fmt(hb)} C ${fmt(wb)} ${fmt(cb)} ${fmt(sb)} Z`;
      })()
    : (() => {
        const neckL = { x: shoulderMid.x - 13, y: shoulderMid.y - 8 };
        const neckR = { x: shoulderMid.x + 13, y: shoulderMid.y - 8 };
        const strapL = { x: pose.shoulderL.x + 6, y: pose.shoulderL.y - 3 };
        const strapR = { x: pose.shoulderR.x - 6, y: pose.shoulderR.y - 3 };
        const armL = { x: pose.shoulderL.x + 10, y: pose.shoulderL.y + 18 };
        const armR = { x: pose.shoulderR.x - 10, y: pose.shoulderR.y + 18 };
        const wL = { x: pose.hipL.x - 10, y: (shoulderMid.y + hipMid.y * 2) / 3 };
        const wR = { x: pose.hipR.x + 10, y: (shoulderMid.y + hipMid.y * 2) / 3 };
        const hL = { x: pose.hipL.x - 12, y: pose.hipL.y + 3 };
        const hR = { x: pose.hipR.x + 12, y: pose.hipR.y + 3 };
        return `M ${fmt(neckL)} Q ${fmt({ x: shoulderMid.x, y: shoulderMid.y + 4 })} ${fmt(neckR)} L ${fmt(strapR)} Q ${fmt(armR)} ${fmt(wR)} L ${fmt(hR)} Q ${fmt({ x: hipMid.x, y: hipMid.y + 5 })} ${fmt(hL)} L ${fmt(wL)} Q ${fmt(armL)} ${fmt(strapL)} Z`;
      })();

  // Shorts: clean front-view tailored shorts OR seamless side-view thigh sleeves
  const legShortR = taperLimbPath(pose.hipR, at(pose.hipR, pose.kneeR, 0.42), isProfile ? 11 : 12.5, isProfile ? 9.5 : 10, 1.03);
  const legShortL = taperLimbPath(pose.hipL, at(pose.hipL, pose.kneeL, 0.42), isProfile ? 12.5 : 12.5, isProfile ? 10.2 : 10, 1.03);
  const hipBand = isProfile
    ? taperLimbPath(
        { x: hipMid.x - ux * 2, y: hipMid.y - uy * 2 },
        { x: hipMid.x + ux * 11, y: hipMid.y + uy * 11 },
        12.5,
        12,
        1.0,
      )
    : (() => {
        const wL = { x: pose.hipL.x - 13, y: pose.hipL.y - 3 };
        const wR = { x: pose.hipR.x + 13, y: pose.hipR.y - 3 };
        const outL = at(pose.hipL, pose.kneeL, 0.42);
        const outR = at(pose.hipR, pose.kneeR, 0.42);
        const hemL = { x: outL.x - 12, y: outL.y };
        const inL = { x: outL.x + 10, y: outL.y };
        const crotch = { x: hipMid.x, y: hipMid.y + 18 };
        const inR = { x: outR.x - 10, y: outR.y };
        const hemR = { x: outR.x + 12, y: outR.y };
        return `M ${fmt(wL)} L ${fmt(wR)} L ${fmt(hemR)} L ${fmt(inR)} Q ${fmt(crotch)} ${fmt(inL)} L ${fmt(hemL)} Z`;
      })();

  // Neck starts inside the lower head and shares a 2-pass outline so head+neck blend seamlessly
  const neckTop = at(pose.head, shoulderMid, 0.14);
  const neckPath = taperLimbPath(neckTop, { x: shoulderMid.x + ux * 5, y: shoulderMid.y + uy * 5 }, 6.2, 8.2, 1.02);
  const { ux: hUpX, uy: hUpY } = axis(at(pose.head, shoulderMid, 0.42), pose.head);

  const headShape = isProfile
    ? (() => {
        const c = pose.head;
        const top = { x: c.x + hUpX * 14.5, y: c.y + hUpY * 14.5 };
        const backTop = { x: c.x + hUpX * 11.5 - fNx * 10.5, y: c.y + hUpY * 11.5 - fNy * 10.5 };
        const back = { x: c.x - fNx * 11.5, y: c.y - fNy * 11.5 };
        const jawBack = { x: c.x - hUpX * 10.5 - fNx * 7.5, y: c.y - hUpY * 10.5 - fNy * 7.5 };
        const chin = { x: c.x - hUpX * 12.5 + fNx * 7.5, y: c.y - hUpY * 12.5 + fNy * 7.5 };
        const nose = { x: c.x - hUpX * 1.5 + fNx * 13.5, y: c.y - hUpY * 1.5 + fNy * 13.5 };
        const brow = { x: c.x + hUpX * 5.5 + fNx * 11.5, y: c.y + hUpY * 5.5 + fNy * 11.5 };
        const frontTop = { x: c.x + hUpX * 13.5 + fNx * 8.5, y: c.y + hUpY * 13.5 + fNy * 8.5 };
        const hairCrest = { x: c.x + hUpX * 16.5 + fNx * 4, y: c.y + hUpY * 16.5 + fNy * 4 };
        const hairTemple = { x: c.x + hUpX * 4 + fNx * 2.5, y: c.y + hUpY * 4 + fNy * 2.5 };
        const nape = { x: c.x - hUpX * 4 - fNx * 10.5, y: c.y - hUpY * 4 - fNy * 10.5 };
        return {
          headD: `M ${fmt(top)} Q ${fmt(frontTop)} ${fmt(brow)} Q ${fmt(nose)} ${fmt(chin)} Q ${fmt(jawBack)} ${fmt(back)} Q ${fmt(backTop)} ${fmt(top)} Z`,
          hairD: `M ${fmt(hairCrest)} Q ${fmt({ x: c.x + hUpX * 12 + fNx * 11, y: c.y + hUpY * 12 + fNy * 11 })} ${fmt({ x: c.x + hUpX * 8 + fNx * 9.5, y: c.y + hUpY * 8 + fNy * 9.5 })} Q ${fmt(hairTemple)} ${fmt(nape)} Q ${fmt({ x: c.x + hUpX * 13 - fNx * 13, y: c.y + hUpY * 13 - fNy * 13 })} ${fmt(hairCrest)} Z`,
        };
      })()
    : {
        headD: `M ${pose.head.x} ${pose.head.y - 14.5} C ${pose.head.x + 8.5} ${pose.head.y - 14.5} ${pose.head.x + 12} ${pose.head.y - 8} ${pose.head.x + 12} ${pose.head.y - 1} C ${pose.head.x + 12} ${pose.head.y + 7.5} ${pose.head.x + 7} ${pose.head.y + 13.5} ${pose.head.x} ${pose.head.y + 14.5} C ${pose.head.x - 7} ${pose.head.y + 13.5} ${pose.head.x - 12} ${pose.head.y + 7.5} ${pose.head.x - 12} ${pose.head.y - 1} C ${pose.head.x - 12} ${pose.head.y - 8} ${pose.head.x - 8.5} ${pose.head.y - 14.5} ${pose.head.x} ${pose.head.y - 14.5} Z`,
        hairD: `M ${pose.head.x - 12} ${pose.head.y - 2} C ${pose.head.x - 13} ${pose.head.y - 12.5} ${pose.head.x - 7} ${pose.head.y - 16.5} ${pose.head.x} ${pose.head.y - 16.5} C ${pose.head.x + 7} ${pose.head.y - 16.5} ${pose.head.x + 13} ${pose.head.y - 12.5} ${pose.head.x + 12} ${pose.head.y - 2} C ${pose.head.x + 9} ${pose.head.y - 8} ${pose.head.x + 3} ${pose.head.y - 9.5} ${pose.head.x} ${pose.head.y - 8.5} C ${pose.head.x - 3} ${pose.head.y - 9.5} ${pose.head.x - 9} ${pose.head.y - 8} ${pose.head.x - 12} ${pose.head.y - 2} Z`,
      };

  const skinNear = `url(#skin-${uid})`;
  const skinFar = `url(#skin-deep-${uid})`;
  const topFill = `url(#top-${uid})`;
  const shortsFill = `url(#shorts-${uid})`;
  const line = 'var(--demo-line)';
  const farScale = isProfile ? 0.88 : 1;

  const shoeR = shoePath(pose.ankleR, pose.toeR, pose.kneeR, farScale);
  const shoeL = shoePath(pose.ankleL, pose.toeL, pose.kneeL, 1);

  // Contoured torso muscle overlays
  const pecFrontL = at(shoulderMid, hipMid, 0.24);
  const pecOverlay = isProfile
    ? `M ${fmt({ x: shoulderMid.x + ux * 9 + fNx * 9, y: shoulderMid.y + uy * 9 + fNy * 9 })} Q ${fmt({ x: pecFrontL.x + fNx * 16, y: pecFrontL.y + fNy * 16 })} ${fmt({ x: shoulderMid.x + ux * 29 + fNx * 11, y: shoulderMid.y + uy * 29 + fNy * 11 })} L ${fmt({ x: shoulderMid.x + ux * 24 + fNx * 3, y: shoulderMid.y + uy * 24 + fNy * 3 })} Z`
    : (() => {
        const c = at(shoulderMid, hipMid, 0.22);
        const b = at(shoulderMid, hipMid, 0.36);
        return `M ${fmt({ x: c.x - 18, y: c.y })} Q ${fmt({ x: c.x - 9, y: c.y - 6 })} ${fmt({ x: c.x - 1.5, y: c.y })} L ${fmt({ x: b.x - 1.5, y: b.y })} Q ${fmt({ x: b.x - 11, y: b.y + 4 })} ${fmt({ x: c.x - 18, y: c.y })} Z M ${fmt({ x: c.x + 18, y: c.y })} Q ${fmt({ x: c.x + 9, y: c.y - 6 })} ${fmt({ x: c.x + 1.5, y: c.y })} L ${fmt({ x: b.x + 1.5, y: b.y })} Q ${fmt({ x: b.x + 11, y: b.y + 4 })} ${fmt({ x: c.x + 18, y: c.y })} Z`;
      })();

  const backOverlay = isProfile
    ? `M ${fmt({ x: shoulderMid.x + ux * 10 - fNx * 7, y: shoulderMid.y + uy * 10 - fNy * 7 })} Q ${fmt({ x: shoulderMid.x + ux * 24 - fNx * 11, y: shoulderMid.y + uy * 24 - fNy * 11 })} ${fmt({ x: shoulderMid.x + ux * 42 - fNx * 7, y: shoulderMid.y + uy * 42 - fNy * 7 })} L ${fmt({ x: shoulderMid.x + ux * 36 - fNx * 2, y: shoulderMid.y + uy * 36 - fNy * 2 })} Z`
    : (() => {
        const t = at(shoulderMid, hipMid, 0.18);
        const m = at(shoulderMid, hipMid, 0.48);
        return `M ${fmt({ x: t.x - 16, y: t.y })} L ${fmt({ x: t.x - 2, y: t.y + 5 })} L ${fmt({ x: m.x - 6, y: m.y })} Q ${fmt({ x: m.x - 13, y: m.y - 6 })} ${fmt({ x: t.x - 16, y: t.y })} Z M ${fmt({ x: t.x + 16, y: t.y })} L ${fmt({ x: t.x + 2, y: t.y + 5 })} L ${fmt({ x: m.x + 6, y: m.y })} Q ${fmt({ x: m.x + 13, y: m.y - 6 })} ${fmt({ x: t.x + 16, y: t.y })} Z`;
      })();

  const coreOverlay = isProfile
    ? `M ${fmt({ x: shoulderMid.x + ux * 34 + fNx * 8, y: shoulderMid.y + uy * 34 + fNy * 8 })} Q ${fmt({ x: shoulderMid.x + ux * 48 + fNx * 11, y: shoulderMid.y + uy * 48 + fNy * 11 })} ${fmt({ x: hipMid.x - ux * 6 + fNx * 9, y: hipMid.y - uy * 6 + fNy * 9 })} L ${fmt({ x: hipMid.x - ux * 6 + fNx * 2, y: hipMid.y - uy * 6 + fNy * 2 })} L ${fmt({ x: shoulderMid.x + ux * 34 + fNx * 2, y: shoulderMid.y + uy * 34 + fNy * 2 })} Z`
    : (() => {
        const t = at(shoulderMid, hipMid, 0.42);
        const b = at(shoulderMid, hipMid, 0.84);
        return `M ${fmt({ x: t.x - 9, y: t.y })} L ${fmt({ x: t.x + 9, y: t.y })} L ${fmt({ x: b.x + 7, y: b.y })} Q ${fmt({ x: b.x, y: b.y + 5 })} ${fmt({ x: b.x - 7, y: b.y })} Z`;
      })();

  return (
    <g>
      {/* 1. Far-side limbs (seamless joints; matching tone in front view) */}
      <LimbPair
        a={pose.hipR}
        joint={pose.kneeR}
        b={pose.ankleR}
        rA={11.8 * farScale}
        rJoint={8 * farScale}
        rB={5.3 * farScale}
        bellyA={1.16}
        bellyB={1.26}
        fill={isProfile ? skinFar : skinNear}
        outline={line}
        upperGlow={thighGlow}
        lowerGlow={calfGlow}
        glowColor={accent}
      />
      <path d={shoeR.body} fill="#1e293b" stroke={line} strokeWidth="1.4" strokeLinejoin="round" />
      <path d={shoeR.sole} fill={isProfile ? '#cbd5e1' : '#f8fafc'} />

      <LimbPair
        a={pose.shoulderR}
        joint={pose.elbowR}
        b={pose.handR}
        rA={8.8 * farScale}
        rJoint={6.5 * farScale}
        rB={4.6 * farScale}
        fill={isProfile ? skinFar : skinNear}
        outline={line}
        upperGlow={armGlow}
        lowerGlow={forearmGlow}
        glowColor={accent}
        endCap={handPath(pose.elbowR, pose.handR, farScale)}
      />

      {/* 2. Seamless Head + Neck (2-pass outline so chin blends cleanly into neck) */}
      <path d={neckPath} fill={line} stroke={line} strokeWidth="2.1" strokeLinejoin="round" />
      <path d={headShape.headD} fill={line} stroke={line} strokeWidth="2.1" strokeLinejoin="round" />
      <path d={neckPath} fill={skinNear} />

      {/* Fitted Athletic Tank Top */}
      <path d={torsoShape} fill={topFill} stroke={line} strokeWidth="1.2" strokeLinejoin="round" />
      {pecGlow && <path d={pecOverlay} fill={accent} opacity="0.72" className="motion-muscle-pulse" />}
      {backGlow && <path d={backOverlay} fill={accent} opacity="0.72" className="motion-muscle-pulse" />}
      {coreGlow && <path d={coreOverlay} fill={accent} opacity="0.72" className="motion-muscle-pulse" />}
      {shoulderGlow && <circle cx={pose.shoulderR.x} cy={pose.shoulderR.y} r={7.5 * farScale} fill={accent} opacity="0.7" className="motion-muscle-pulse" />}

      {/* Head interior fill + hair (sits cleanly over neck with no cut line) */}
      <path d={headShape.headD} fill={skinNear} />
      <path d={headShape.hairD} fill="#1e293b" />

      {/* 3. Athletic Shorts */}
      {isProfile ? (
        <>
          <path d={legShortR} fill={line} stroke={line} strokeWidth="2.1" strokeLinejoin="round" />
          <path d={hipBand} fill={line} stroke={line} strokeWidth="2.1" strokeLinejoin="round" />
          <path d={legShortR} fill={shortsFill} />
          <path d={hipBand} fill={shortsFill} />
        </>
      ) : (
        <path d={hipBand} fill={shortsFill} stroke={line} strokeWidth="1.2" strokeLinejoin="round" />
      )}
      {gluteGlow && (
        <circle
          cx={hipMid.x - fNx * (isProfile ? 6 : 0)}
          cy={hipMid.y - fNy * (isProfile ? 6 : 0) + 4}
          r={isProfile ? 8.5 : 10}
          fill={accent}
          opacity="0.72"
          className="motion-muscle-pulse"
        />
      )}

      {/* 4. Near-side leg + short sleeve in profile */}
      <LimbPair
        a={pose.hipL}
        joint={pose.kneeL}
        b={pose.ankleL}
        rA={11.8}
        rJoint={8}
        rB={5.3}
        bellyA={1.16}
        bellyB={1.26}
        fill={skinNear}
        outline={line}
        upperGlow={thighGlow}
        lowerGlow={calfGlow}
        glowColor={accent}
      />
      {isProfile ? (
        <path d={legShortL} fill={shortsFill} stroke={line} strokeWidth="1.2" strokeLinejoin="round" />
      ) : (
        <path d={hipBand} fill={shortsFill} stroke={line} strokeWidth="1.2" strokeLinejoin="round" />
      )}
      <path d={shoeL.body} fill="#1e293b" stroke={line} strokeWidth="1.2" strokeLinejoin="round" />
      <path d={shoeL.sole} fill="#f8fafc" />

      {/* 5. Near-side arm + shoulder cap */}
      <LimbPair
        a={pose.shoulderL}
        joint={pose.elbowL}
        b={pose.handL}
        rA={8.8}
        rJoint={6.5}
        rB={4.6}
        fill={skinNear}
        outline={line}
        upperGlow={armGlow}
        lowerGlow={forearmGlow}
        glowColor={accent}
        endCap={handPath(pose.elbowL, pose.handL, 1)}
      />
      {shoulderGlow && <circle cx={pose.shoulderL.x} cy={pose.shoulderL.y} r="7.5" fill={accent} opacity="0.72" className="motion-muscle-pulse" />}

    </g>
  );
}

export function KineticExerciseDemo({ exerciseId, exerciseName, equipment, demo, primary, className = '' }: Props) {
  const profile = useMemo(() => getMotionProfile(exerciseId, demo, equipment), [exerciseId, demo, equipment]);
  const [paused, setPaused] = useState(false);
  const [slow, setSlow] = useState(false);
  const [resetSignal, setResetSignal] = useState(0);
  const [webglFailed, setWebglFailed] = useState(false);
  const [livePhase, setLivePhase] = useState(0);
  const [liveLabel, setLiveLabel] = useState(profile.frames[0].label);

  const tempoMs = slow ? Math.round(profile.tempoMs * 1.75) : profile.tempoMs;
  const fallbackPhase = useMotion(tempoMs, paused || !webglFailed);
  const phase = webglFailed ? fallbackPhase : livePhase;
  const eased = wave(phase);
  const start = profile.frames[0].pose;
  const end = profile.frames[profile.frames.length - 1].pose;
  const pose = interpolatePose(start, end, eased);
  const accent = MUSCLE_PART_META[primary[0] ?? 'sideDelts']?.hot ?? '#ef4444';
  const rawId = useId();
  const uid = rawId.replace(/:/g, '');
  const currentLabel = webglFailed
    ? eased < 0.5
      ? profile.frames[0].label
      : profile.frames[profile.frames.length - 1].label
    : liveLabel;
  const repProgress = `${Math.round(phase * 100)}%`;
  const equipmentBehind = exerciseId === 'squat' || exerciseId === 'good-morning';
  const sideView = profile.view === 'side';
  const startHand = mid(start.handL, start.handR);
  const endHand = mid(end.handL, end.handR);
  const showPath = distance(startHand, endHand) > 14 && exerciseId !== 'farmers-walk';

  const handlePhaseChange = useCallback((p: number, lbl: string) => {
    setLivePhase(p);
    setLiveLabel(lbl);
  }, []);

  const handleWebGLError = useCallback(() => {
    setWebglFailed(true);
  }, []);

  return (
    <div
      className={`demo-stage flex flex-col overflow-hidden rounded-[22px] border border-slate-200/90 bg-gradient-to-b from-slate-50 via-slate-100/70 to-slate-200/70 shadow-[0_14px_34px_-22px_rgba(15,23,42,0.28)] dark:border-white/10 dark:from-[#161c28] dark:via-[#111620] dark:to-[#0c1018] ${className}`}
    >
      <div className="flex items-center justify-between gap-2 border-b border-slate-200/70 bg-white/70 px-3.5 py-2.5 backdrop-blur dark:border-white/[0.07] dark:bg-white/[0.03]">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-200/80 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.12em] text-slate-600 dark:bg-white/10 dark:text-slate-300">
            <Move3d size={11} />
            {webglFailed ? `${profile.view} view` : '3D'}
          </span>
          <span
            className="rounded-full px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.12em] text-white shadow-sm"
            style={{ background: accent }}
          >
            {currentLabel}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {!webglFailed && (
            <button
              type="button"
              onClick={() => setResetSignal((n) => n + 1)}
              className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-200/70 text-slate-600 transition hover:bg-slate-300/80 dark:bg-white/10 dark:text-slate-300"
              aria-label="Reset 3D camera angle"
              title="Reset camera"
            >
              <RotateCcw size={12} />
            </button>
          )}
          <button
            type="button"
            onClick={() => setSlow((v) => !v)}
            className={`inline-flex h-7 items-center gap-1 rounded-full px-2 text-[10px] font-extrabold uppercase tracking-wider transition ${
              slow
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                : 'bg-slate-200/70 text-slate-600 hover:bg-slate-300/70 dark:bg-white/10 dark:text-slate-300'
            }`}
            aria-label={slow ? 'Normal demo speed' : 'Slow motion demo'}
          >
            <Gauge size={12} />
            {slow ? '0.5×' : '1×'}
          </button>
          <button
            type="button"
            onClick={() => setPaused((v) => !v)}
            className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-200/70 text-slate-700 transition hover:bg-slate-300/80 dark:bg-white/10 dark:text-slate-200"
            aria-label={paused ? 'Play exercise demo' : 'Pause exercise demo'}
          >
            {paused ? <Play size={13} fill="currentColor" /> : <Pause size={13} fill="currentColor" />}
          </button>
        </div>
      </div>

      <div className="relative min-h-0 flex-1">
        {!webglFailed ? (
          <Suspense
            fallback={
              <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-slate-400">
                Loading 3D studio…
              </div>
            }
          >
            <ExerciseStage3D
              exerciseId={exerciseId}
              exerciseName={exerciseName}
              profile={profile}
              primary={primary}
              accent={accent}
              paused={paused}
              slow={slow}
              resetSignal={resetSignal}
              onPhaseChange={handlePhaseChange}
              onWebGLError={handleWebGLError}
            />
            <div className="pointer-events-none absolute bottom-2 right-3 rounded-full bg-black/25 px-2 py-0.5 text-[9px] font-semibold text-white/80 backdrop-blur-sm">
              Drag to rotate · Scroll to zoom
            </div>
          </Suspense>
        ) : (
          <svg viewBox="0 -6 320 302" className="block h-full w-full" role="img" aria-label={`${exerciseName} animated form demonstration`}>
            <defs>
              <linearGradient id={`skin-${uid}`} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="var(--demo-skin-hi)" />
                <stop offset="1" stopColor="var(--demo-skin-lo)" />
              </linearGradient>
              <linearGradient id={`skin-deep-${uid}`} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="var(--demo-skin-deep-hi)" />
                <stop offset="1" stopColor="var(--demo-skin-deep-lo)" />
              </linearGradient>
              <linearGradient id={`top-${uid}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#3b485e" />
                <stop offset="1" stopColor="#1e293b" />
              </linearGradient>
              <linearGradient id={`shorts-${uid}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#1e293b" />
                <stop offset="1" stopColor="#0f172a" />
              </linearGradient>
              <radialGradient id={`stage-${uid}`} cx="50%" cy="42%" r="62%">
                <stop offset="0" stopColor={accent} stopOpacity="0.10" />
                <stop offset="1" stopColor={accent} stopOpacity="0" />
              </radialGradient>
              <pattern id={`grid-${uid}`} width="24" height="24" patternUnits="userSpaceOnUse">
                <path d="M 24 0 L 0 0 0 24" fill="none" stroke="var(--demo-grid)" strokeWidth="1" />
              </pattern>
            </defs>
            <rect x="0" y="-6" width="320" height="302" fill={`url(#grid-${uid})`} />
            <rect x="0" y="-6" width="320" height="302" fill={`url(#stage-${uid})`} />

            <Scene exerciseId={exerciseId} kind={profile.scene} pose={pose} accent={accent} />
            {showPath && (
              <line
                x1={startHand.x}
                y1={startHand.y}
                x2={endHand.x}
                y2={endHand.y}
                stroke={accent}
                strokeOpacity="0.26"
                strokeWidth="2"
                strokeDasharray="3 4"
                strokeLinecap="round"
              />
            )}
            {equipmentBehind && (
              <EquipmentLayer
                exerciseId={exerciseId}
                kind={profile.prop}
                scene={profile.scene}
                pose={pose}
                accent={accent}
                sideView={sideView}
              />
            )}
            <Athlete pose={pose} primary={primary} accent={accent} uid={uid} sideView={sideView} />
            {!equipmentBehind && (
              <EquipmentLayer
                exerciseId={exerciseId}
                kind={profile.prop}
                scene={profile.scene}
                pose={pose}
                accent={accent}
                sideView={sideView}
              />
            )}
          </svg>
        )}
      </div>

      <div className="border-t border-slate-200/70 bg-white/80 px-3.5 py-2.5 backdrop-blur dark:border-white/[0.07] dark:bg-white/[0.03]">
        <div className="mb-2 h-1 overflow-hidden rounded-full bg-slate-200/80 dark:bg-white/10" aria-hidden>
          <div className="h-full rounded-full transition-[width] duration-75" style={{ width: repProgress, background: accent }} />
        </div>
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 shrink-0 rounded-full motion-muscle-pulse" style={{ background: accent, boxShadow: `0 0 8px ${accent}` }} />
          <p className="min-w-0 flex-1 text-[11px] font-semibold leading-snug text-slate-600 dark:text-slate-300">{profile.instruction}</p>
        </div>
      </div>
    </div>
  );
}
