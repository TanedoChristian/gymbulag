import { useId, useMemo } from 'react';
import { MUSCLE_PART_META, type BodyView, type MusclePart } from '../../lib/anatomy';

interface Props {
  view: BodyView;
  primary: MusclePart[];
  secondary: MusclePart[];
  focus?: MusclePart | null;
  onSelectPart?: (part: MusclePart) => void;
  className?: string;
}

type Role = 'idle' | 'primary' | 'secondary' | 'focus';

/**
 * Mirrors an SVG path across the center axis (cx = 150).
 * Supports absolute M, L, C, Q, Z commands so every left/right muscle pair is exact.
 */
function mirrorPath(d: string, cx = 150): string {
  const tokens = d.trim().split(/\s+/);
  const out: string[] = [];
  let isX = true;
  for (const t of tokens) {
    if (/^[A-Za-z]$/.test(t)) {
      out.push(t);
      isX = true;
    } else {
      const n = Number(t);
      out.push(isX ? String(Number((cx * 2 - n).toFixed(2))) : t);
      isX = !isX;
    }
  }
  return out.join(' ');
}

function sym(leftPath: string): string {
  return `${leftPath} ${mirrorPath(leftPath)}`;
}

const LEFT_SILHOUETTE = [
  'M 150 20',
  'C 138 20 130 29 130 42',
  'C 127 45 126 55 129 59',
  'C 130 66 133 72 138 77',
  'L 136 93',
  'C 132 100 116 105 97 109',
  'C 81 113 73 127 72 146',
  'C 72 156 75 164 76 168',
  'C 70 183 68 200 68 214',
  'C 60 230 55 256 55 284',
  'C 48 296 44 310 47 322',
  'C 50 328 56 329 59 322',
  'C 62 316 64 310 66 304',
  'C 69 308 73 306 72 299',
  'C 69 292 67 287 67 283',
  'C 73 262 79 240 83 220',
  'C 89 201 94 182 97 166',
  'C 100 182 104 202 109 224',
  'C 110 242 107 262 103 280',
  'C 95 314 95 358 103 406',
  'C 103 416 103 424 104 432',
  'C 98 456 97 488 103 518',
  'C 106 534 108 548 108 562',
  'C 102 574 99 586 103 593',
  'C 107 598 122 598 129 593',
  'C 133 589 132 576 129 562',
  'C 129 548 131 534 134 516',
  'C 138 488 138 456 132 432',
  'C 134 422 136 410 137 396',
  'C 141 368 145 338 148 312',
  'L 150 310',
].join(' ');

function buildBodyOutline(): string {
  const rightTokens = mirrorPath(LEFT_SILHOUETTE).split(/\s+/);
  // Reverse segment order on the right side? Better: build explicit full closed outline cleanly.
  void rightTokens;
  return [
    'M 150 20',
    'C 138 20 130 29 130 42',
    'C 127 45 126 55 129 59',
    'C 130 66 133 72 138 77',
    'L 136 93',
    'C 132 100 116 105 97 109',
    'C 81 113 73 127 72 146',
    'C 72 156 75 164 76 168',
    'C 70 183 68 200 68 214',
    'C 60 230 55 256 55 284',
    'C 48 296 44 310 47 322',
    'C 50 328 56 329 59 322',
    'C 62 316 64 310 66 304',
    'C 69 308 73 306 72 299',
    'C 69 292 67 287 67 283',
    'C 73 262 79 240 83 220',
    'C 89 201 94 182 97 166',
    'C 100 182 104 202 109 224',
    'C 110 242 107 262 103 280',
    'C 95 314 95 358 103 406',
    'C 103 416 103 424 104 432',
    'C 98 456 97 488 103 518',
    'C 106 534 108 548 108 562',
    'C 102 574 99 586 103 593',
    'C 107 598 122 598 129 593',
    'C 133 589 132 576 129 562',
    'C 129 548 131 534 134 516',
    'C 138 488 138 456 132 432',
    'C 134 422 136 410 137 396',
    'C 141 368 145 338 148 312',
    'L 150 310',
    'L 152 312',
    'C 155 338 159 368 163 396',
    'C 164 410 166 422 168 432',
    'C 162 456 162 488 166 516',
    'C 169 534 171 548 171 562',
    'C 168 576 167 589 171 593',
    'C 178 598 193 598 197 593',
    'C 201 586 198 574 192 562',
    'C 192 548 194 534 197 518',
    'C 203 488 202 456 196 432',
    'C 197 424 197 416 197 406',
    'C 205 358 205 314 197 280',
    'C 193 262 190 242 191 224',
    'C 196 202 200 182 203 166',
    'C 206 182 211 201 217 220',
    'C 221 240 227 262 233 283',
    'C 233 287 231 292 228 299',
    'C 227 306 231 308 234 304',
    'C 236 310 238 316 241 322',
    'C 244 329 250 328 253 322',
    'C 256 310 252 296 245 284',
    'C 245 256 240 230 232 214',
    'C 232 200 230 183 224 168',
    'C 225 164 228 156 228 146',
    'C 227 127 219 113 203 109',
    'C 184 105 168 100 164 93',
    'L 162 77',
    'C 167 72 170 66 171 59',
    'C 174 55 173 45 170 42',
    'C 170 29 162 20 150 20',
    'Z',
  ].join(' ');
}

const BODY_OUTLINE = buildBodyOutline();

/** Symmetric muscle fiber striation guides per muscle id. */
const FIBER_LINES: Partial<Record<MusclePart, Record<BodyView, string | undefined>>> = {
  pecs: {
    front: sym('M 145 139 Q 124 140 103 142 M 145 148 Q 124 148 103 149 M 143 157 Q 125 156 106 154'),
    back: undefined,
  },
  upperPecs: {
    front: sym('M 144 120 Q 125 121 107 119'),
    back: undefined,
  },
  frontDelts: {
    front: sym('M 98 118 Q 92 134 88 152 M 102 122 Q 97 136 93 150'),
    back: undefined,
  },
  sideDelts: {
    front: sym('M 88 118 Q 80 136 80 156 M 82 126 Q 76 140 77 154'),
    back: sym('M 88 118 Q 80 136 80 156 M 82 126 Q 76 140 77 154'),
  },
  rearDelts: {
    front: undefined,
    back: sym('M 96 120 Q 100 134 92 152 M 102 126 Q 105 138 98 150'),
  },
  traps: {
    front: sym('M 134 96 Q 122 103 110 107'),
    back: sym('M 145 96 L 122 110 M 146 112 L 122 124 M 147 130 L 134 140'),
  },
  lats: {
    front: undefined,
    back: sym('M 144 198 Q 126 190 106 178 M 139 218 Q 123 210 108 198 M 132 238 Q 120 230 112 220'),
  },
  rhomboids: {
    front: undefined,
    back: sym('M 134 146 L 110 156 M 134 160 L 106 164'),
  },
  lowerBack: {
    front: undefined,
    back: sym('M 141 214 L 140 272'),
  },
  biceps: {
    front: sym('M 85 168 Q 82 186 80 204'),
    back: undefined,
  },
  triceps: {
    front: undefined,
    back: sym('M 89 166 Q 86 184 82 198 M 79 174 Q 76 188 74 200'),
  },
  quads: {
    front: sym('M 103 310 Q 104 344 108 384 M 120 304 L 121 378 M 131 374 Q 130 392 126 404'),
    back: undefined,
  },
  hamstrings: {
    front: undefined,
    back: sym('M 108 352 L 109 412 M 126 352 L 124 412'),
  },
  glutes: {
    front: undefined,
    back: sym('M 142 292 Q 124 298 110 310 M 142 310 Q 126 318 114 328'),
  },
  calves: {
    front: sym('M 103 448 Q 102 474 106 498'),
    back: sym('M 111 446 Q 109 472 112 496 M 126 446 Q 128 472 124 496'),
  },
};

/**
 * Detailed, symmetrical anatomical body map.
 * Every muscle group is cleanly separated, outlined, shaded, and striated.
 */
export function BodyMap({ view, primary, secondary, focus = null, onSelectPart, className = '' }: Props) {
  const prim = useMemo(() => new Set(primary), [primary]);
  const sec = useMemo(() => new Set(secondary), [secondary]);
  const rawId = useId();
  const uid = rawId.replace(/:/g, '');

  const roleFor = (part: MusclePart): Role => {
    if (focus === part && (prim.has(part) || sec.has(part))) return 'focus';
    if (prim.has(part)) return 'primary';
    if (sec.has(part)) return 'secondary';
    return 'idle';
  };

  const fillFor = (role: Role) => {
    if (role === 'focus') return `url(#focus-${uid})`;
    if (role === 'primary') return `url(#primary-${uid})`;
    if (role === 'secondary') return `url(#secondary-${uid})`;
    return `url(#idle-${uid})`;
  };

  const Region = ({ id, d }: { id: MusclePart; d: string }) => {
    const role = roleFor(id);
    const active = role !== 'idle';
    const selectable = !!onSelectPart && active;
    const fibers = FIBER_LINES[id]?.[view];

    return (
      <g
        onClick={() => selectable && onSelectPart(id)}
        role={selectable ? 'button' : undefined}
        tabIndex={selectable ? 0 : undefined}
        onKeyDown={(e) => {
          if (!selectable) return;
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSelectPart(id);
          }
        }}
        aria-label={MUSCLE_PART_META[id].label}
        className={selectable ? 'cursor-pointer' : undefined}
      >
        <path
          d={d}
          fill={fillFor(role)}
          stroke={
            role === 'focus'
              ? '#ffffff'
              : active
                ? 'rgba(255,255,255,0.62)'
                : 'var(--anat-line)'
          }
          strokeWidth={role === 'focus' ? 2 : active ? 1.15 : 0.95}
          strokeLinejoin="round"
          className={`transition-all duration-200 ${selectable ? 'hover:brightness-110' : ''}`}
          style={
            role === 'focus'
              ? { filter: 'drop-shadow(0 0 6px rgba(239,68,68,0.65))' }
              : active
                ? { filter: 'drop-shadow(0 1px 2px rgba(15,23,42,0.22))' }
                : undefined
          }
        />
        {fibers && (
          <path
            d={fibers}
            fill="none"
            stroke={active ? 'rgba(255,255,255,0.38)' : 'var(--anat-fiber)'}
            strokeWidth={active ? 0.95 : 0.75}
            strokeLinecap="round"
            pointerEvents="none"
          />
        )}
      </g>
    );
  };

  return (
    <svg
      viewBox="0 0 300 620"
      className={`anatomy-figure h-full w-full ${className}`}
      role="img"
      aria-label={`${view} anatomical muscle map`}
    >
      <defs>
        <linearGradient id={`skin-${uid}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--anat-base-hi)" />
          <stop offset="55%" stopColor="var(--anat-base)" />
          <stop offset="100%" stopColor="var(--anat-base-lo)" />
        </linearGradient>
        <linearGradient id={`idle-${uid}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--anat-muscle-hi)" />
          <stop offset="100%" stopColor="var(--anat-muscle-lo)" />
        </linearGradient>
        <linearGradient id={`primary-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ff6357" />
          <stop offset="52%" stopColor="#ef3430" />
          <stop offset="100%" stopColor="#b91c1c" />
        </linearGradient>
        <linearGradient id={`secondary-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fbbf24" />
          <stop offset="55%" stopColor="#f59e0b" />
          <stop offset="100%" stopColor="#c2630a" />
        </linearGradient>
        <radialGradient id={`focus-${uid}`} cx="50%" cy="40%" r="72%">
          <stop offset="0%" stopColor="#ff8a65" />
          <stop offset="45%" stopColor="#ef233c" />
          <stop offset="100%" stopColor="#991b1b" />
        </radialGradient>
        <clipPath id={`bodyclip-${uid}`}>
          <path d={BODY_OUTLINE} />
        </clipPath>
      </defs>

      {/* Subtle studio floor shadow */}
      <ellipse cx="116" cy="597" rx="22" ry="5" fill="var(--anat-shadow)" />
      <ellipse cx="184" cy="597" rx="22" ry="5" fill="var(--anat-shadow)" />

      {/* Base body shell */}
      <path d={BODY_OUTLINE} fill={`url(#skin-${uid})`} />

      <g clipPath={`url(#bodyclip-${uid})`}>
        {/* Subtle torso / limb core shadow */}
        <path
          d="M 150 96 L 150 314"
          stroke="var(--anat-line)"
          strokeOpacity={0.35}
          strokeWidth={1}
          pointerEvents="none"
        />

        {/* Sculpted head & neck anatomical landmarks (no cartoon face) */}
        <g pointerEvents="none">
          <path
            d="M 150 22 C 138 22 131 31 131 44 C 131 59 138 74 150 77 C 162 74 169 59 169 44 C 169 31 162 22 150 22 Z"
            fill={`url(#skin-${uid})`}
            stroke="var(--anat-line)"
            strokeWidth={0.95}
          />
          {view === 'front' ? (
            <>
              {/* Clean sculpted brow, cheekbone, jawline & neck SCM tendons */}
              <path
                d="M 136 45 Q 143 43 149 45 M 164 45 Q 157 43 151 45 M 147 59 Q 150 61 153 59 M 136 62 Q 150 73 164 62"
                fill="none"
                stroke="var(--anat-line)"
                strokeWidth={0.85}
                strokeLinecap="round"
                opacity={0.75}
              />
              <path
                d="M 136 74 L 148 107 M 164 74 L 152 107 M 102 108 Q 126 112 148 110 M 198 108 Q 174 112 152 110"
                fill="none"
                stroke="var(--anat-line)"
                strokeWidth={1.05}
                strokeLinecap="round"
              />
            </>
          ) : (
            <>
              {/* Occipital skull contour & cervical spine */}
              <path
                d="M 136 60 Q 150 66 164 60 M 150 66 L 150 96"
                fill="none"
                stroke="var(--anat-line)"
                strokeWidth={0.9}
                strokeLinecap="round"
                opacity={0.75}
              />
            </>
          )}
        </g>

        {view === 'front' ? (
          <g>
            {/* Traps */}
            <Region id="traps" d={sym('M 135 89 C 127 98 114 104 99 109 C 111 111 126 110 138 108 L 142 95 Z')} />

            {/* Shoulders: Front & Side Delts */}
            <Region id="sideDelts" d={sym('M 98 109 C 82 114 73 128 73 146 C 73 156 76 162 81 166 C 85 154 86 142 84 130 C 86 120 91 113 98 109 Z')} />
            <Region id="frontDelts" d={sym('M 99 109 C 91 113 86 120 84 130 C 86 142 85 154 82 164 C 91 158 97 148 100 135 C 103 123 104 115 104 111 Z')} />

            {/* Chest: Upper Pecs & Main Pecs */}
            <Region id="upperPecs" d={sym('M 148 113 C 134 112 116 111 105 112 C 104 120 102 128 100 134 C 115 129 133 128 148 130 Z')} />
            <Region id="pecs" d={sym('M 148 132 C 133 130 115 131 100 136 C 97 146 98 156 102 164 C 116 172 135 171 147 163 C 149 154 149 143 148 132 Z')} />

            {/* Arms: Biceps/Brachialis & Dual-Belly Forearms */}
            <Region
              id="biceps"
              d={sym(
                'M 82 165 C 76 177 73 195 76 212 C 81 214 87 210 90 201 C 94 186 95 170 92 160 C 89 162 85 164 82 165 Z M 76 168 C 70 183 68 198 69 212 L 75 212 C 73 196 76 179 81 166 Z',
              )}
            />
            <Region
              id="forearms"
              d={sym(
                'M 70 214 C 61 231 56 255 56 280 L 62 282 C 66 258 72 238 76 220 Z M 77 220 C 73 240 67 260 63 282 L 66 283 C 72 262 78 242 82 222 Z',
              )}
            />

            {/* Core: 8-pack Abs + Serratus/Obliques + Hip Flexors */}
            <Region
              id="abs"
              d={sym(
                'M 131 171 C 136 169 144 169 148 171 L 148 194 C 143 196 135 196 130 193 Z M 130 197 C 135 199 143 199 148 197 L 148 220 C 143 222 135 222 130 219 Z M 130 223 C 135 225 143 225 148 223 L 148 246 C 143 248 135 247 131 244 Z M 131 248 C 135 250 143 250 148 249 L 148 292 C 144 294 139 292 136 284 C 133 272 132 260 131 248 Z',
              )}
            />
            <Region
              id="obliques"
              d={sym(
                'M 101 166 C 110 172 121 173 128 174 C 127 204 128 238 131 274 C 124 282 115 280 106 274 C 107 256 111 236 110 218 C 107 198 101 180 101 166 Z',
              )}
            />
            <Region id="hipFlexors" d={sym('M 106 276 C 114 282 123 284 132 282 C 128 296 122 310 116 322 C 108 312 103 296 106 276 Z')} />

            {/* Legs: 3-Head Quads (Vastus Lateralis + Rectus Femoris + VMO Teardrop), Adductors, Calves */}
            <Region
              id="quads"
              d={sym(
                'M 103 284 C 95 316 95 358 104 402 C 110 403 114 394 115 374 C 114 340 112 310 109 286 Z M 111 288 C 114 314 116 350 116 390 C 120 395 125 389 127 368 C 129 336 127 306 122 290 Z M 128 362 C 125 378 122 394 124 407 C 130 409 135 398 136 380 C 135 370 132 364 128 362 Z',
              )}
            />
            <Region id="adductors" d={sym('M 124 292 C 132 296 141 303 147 312 C 143 335 138 355 135 368 C 129 356 127 328 124 292 Z')} />
            <Region
              id="calves"
              d={sym(
                'M 104 434 C 98 456 98 486 104 514 L 109 504 C 107 478 107 456 108 436 Z M 129 438 C 135 458 135 486 128 508 L 124 496 C 126 474 126 454 124 440 Z',
              )}
            />

            {/* Unhighlighted anatomical joint & bone detail (knees, shins, pelvis, hands, feet) */}
            <g pointerEvents="none" fill="none" stroke="var(--anat-line)" strokeWidth={0.95} strokeLinecap="round" opacity={0.8}>
              {/* Pelvis / inguinal crease */}
              <path d={sym('M 105 278 Q 126 294 148 307')} opacity={0.75} />
              {/* Kneecaps (patellae) */}
              <path d={sym('M 111 410 C 115 405 122 405 125 412 C 124 422 119 426 113 423 C 110 420 110 414 111 410 Z')} fill="var(--anat-base)" />
              {/* Shin tibia ridge */}
              <path d={sym('M 118 432 Q 116 488 117 550')} opacity={0.55} />
              {/* Ankle malleoli & foot arch */}
              <path d={sym('M 110 562 Q 118 566 127 560 M 106 584 Q 118 588 129 584')} opacity={0.6} />
              {/* Wrist, elbow creases & finger contours */}
              <path d={sym('M 56 283 L 66 284 M 69 213 Q 76 216 82 213 M 52 303 L 50 321 M 57 305 L 55 322')} opacity={0.65} />
            </g>
          </g>
        ) : (
          <g>
            {/* Back: Traps */}
            <Region
              id="traps"
              d={sym('M 149 76 C 141 82 135 92 129 100 C 117 104 105 107 98 110 C 107 120 121 131 134 142 C 141 156 146 174 149 194 Z')}
            />

            {/* Back Shoulders: Side Delts & Rear Delts */}
            <Region id="sideDelts" d={sym('M 97 110 C 81 114 73 128 73 146 C 73 156 76 162 81 166 C 85 154 86 142 84 130 C 86 120 91 114 97 110 Z')} />
            <Region id="rearDelts" d={sym('M 98 110 C 91 114 86 120 84 130 C 86 142 85 154 83 163 C 93 159 103 148 112 132 C 106 122 102 115 98 110 Z')} />

            {/* Mid-Back (Rhomboids / Infraspinatus / Teres) */}
            <Region id="rhomboids" d={sym('M 113 132 C 105 147 97 157 90 164 C 103 171 120 175 137 177 C 141 165 142 153 136 144 C 128 137 120 134 113 132 Z')} />

            {/* Lats */}
            <Region id="lats" d={sym('M 94 164 C 105 171 122 176 138 178 C 143 184 147 192 148 202 C 144 222 136 244 126 260 C 116 254 108 242 104 224 C 100 200 95 180 94 164 Z')} />

            {/* Lower Back (Erector Spinae) */}
            <Region id="lowerBack" d={sym('M 148 204 C 141 206 135 212 131 222 C 130 242 130 260 129 275 C 135 277 143 277 149 275 Z')} />

            {/* Arms: 2-Head Triceps Horseshoe & Forearms */}
            <Region
              id="triceps"
              d={sym(
                'M 82 165 C 74 176 70 192 72 208 C 78 204 82 195 84 182 C 84 174 83 168 82 165 Z M 84 166 C 85 178 83 193 78 207 C 84 207 90 196 93 182 C 95 170 93 162 88 160 Z',
              )}
            />
            <Region
              id="forearms"
              d={sym(
                'M 70 214 C 61 231 56 255 56 280 L 62 282 C 66 258 72 238 76 220 Z M 77 220 C 73 240 67 260 63 282 L 66 283 C 72 262 78 242 82 222 Z',
              )}
            />

            {/* Glutes */}
            <Region
              id="glutes"
              d={sym('M 149 277 C 136 275 119 278 105 286 C 101 304 102 324 109 338 C 123 346 139 343 149 330 Z')}
            />

            {/* Hamstrings (Biceps Femoris + Semitendinosus) */}
            <Region
              id="hamstrings"
              d={sym(
                'M 106 340 C 98 362 98 394 104 424 L 114 420 C 115 392 116 364 116 344 Z M 118 344 C 118 368 117 396 117 422 L 128 422 C 132 394 135 366 136 339 C 128 343 122 344 118 344 Z',
              )}
            />

            {/* Calves (Medial & Lateral Gastrocnemius + Soleus) */}
            <Region
              id="calves"
              d={sym(
                'M 104 436 C 98 456 99 484 107 506 C 112 502 115 488 116 468 C 116 452 114 440 109 434 Z M 120 436 C 118 454 118 476 119 502 C 125 504 131 496 134 476 C 136 458 134 442 128 436 Z M 108 506 C 114 510 122 510 128 504 L 124 532 C 120 536 115 536 111 532 Z',
              )}
            />

            {/* Unhighlighted back anatomical detail (elbows, back of knees, Achilles tendon, hands) */}
            <g pointerEvents="none" fill="none" stroke="var(--anat-line)" strokeWidth={0.95} strokeLinecap="round" opacity={0.8}>
              <path d={sym('M 71 212 Q 77 215 82 210 M 106 428 Q 118 432 130 426 M 115 534 L 116 566 M 121 534 L 120 566')} opacity={0.65} />
              <path d={sym('M 110 568 Q 118 574 127 568 M 52 303 L 50 321 M 57 305 L 55 322')} opacity={0.6} />
            </g>
          </g>
        )}
      </g>

      {/* Outer crisp contour of the entire body */}
      <path d={BODY_OUTLINE} fill="none" stroke="var(--anat-outline)" strokeWidth={1.35} strokeLinejoin="round" pointerEvents="none" />
    </svg>
  );
}
