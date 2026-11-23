/** Finer muscle parts for the body map and exercise guides (beyond the coarse MuscleGroup). */

export const MUSCLE_PARTS = [
  'pecs',
  'upperPecs',
  'frontDelts',
  'sideDelts',
  'rearDelts',
  'traps',
  'lats',
  'rhomboids',
  'lowerBack',
  'biceps',
  'triceps',
  'forearms',
  'abs',
  'obliques',
  'glutes',
  'quads',
  'hamstrings',
  'calves',
  'hipFlexors',
  'adductors',
] as const;

export type MusclePart = (typeof MUSCLE_PARTS)[number];

export type BodyView = 'front' | 'back';

export interface MusclePartMeta {
  id: MusclePart;
  label: string;
  scientific: string;
  short: string;
  view: BodyView | 'both';
  /** Biomechanical summary of what this muscle does under load */
  functionCue: string;
  /** Soft fill when idle on the map */
  idle: string;
  /** Highlight when this part is primary */
  hot: string;
  /** Highlight when secondary */
  warm: string;
}

export const MUSCLE_PART_META: Record<MusclePart, MusclePartMeta> = {
  pecs: {
    id: 'pecs',
    label: 'Mid & Lower Chest',
    scientific: 'Pectoralis major (sternocostal)',
    short: 'Chest',
    view: 'front',
    functionCue: 'Horizontally adducts and presses the upper arms across the midline of the ribcage.',
    idle: '#fca5a5',
    hot: '#ef4444',
    warm: '#f87171',
  },
  upperPecs: {
    id: 'upperPecs',
    label: 'Upper Pecs',
    scientific: 'Pectoralis major (clavicular)',
    short: 'Upper chest',
    view: 'front',
    functionCue: 'Drives upward-angled pressing and flexes the humerus toward the collarbone.',
    idle: '#fda4af',
    hot: '#f43f5e',
    warm: '#fb7185',
  },
  frontDelts: {
    id: 'frontDelts',
    label: 'Front Delts',
    scientific: 'Anterior deltoid',
    short: 'Front delts',
    view: 'front',
    functionCue: 'Flexes the shoulder joint forward and assists overhead and horizontal pressing.',
    idle: '#fcd34d',
    hot: '#f59e0b',
    warm: '#fbbf24',
  },
  sideDelts: {
    id: 'sideDelts',
    label: 'Side Delts',
    scientific: 'Lateral deltoid',
    short: 'Side delts',
    view: 'both',
    functionCue: 'Abducts the upper arm out to the side, creating broad athletic shoulder width.',
    idle: '#fde68a',
    hot: '#f59e0b',
    warm: '#fbbf24',
  },
  rearDelts: {
    id: 'rearDelts',
    label: 'Rear Delts',
    scientific: 'Posterior deltoid',
    short: 'Rear delts',
    view: 'back',
    functionCue: 'Draws the upper arm backward and stabilizes the back of the shoulder capsule.',
    idle: '#fcd34d',
    hot: '#d97706',
    warm: '#f59e0b',
  },
  traps: {
    id: 'traps',
    label: 'Trapezius',
    scientific: 'Upper, middle & lower trapezius',
    short: 'Traps',
    view: 'both',
    functionCue: 'Elevates, retracts, and upwardly rotates the shoulder blades under heavy load.',
    idle: '#93c5fd',
    hot: '#3b82f6',
    warm: '#60a5fa',
  },
  lats: {
    id: 'lats',
    label: 'Latissimus Dorsi',
    scientific: 'Latissimus dorsi & teres major',
    short: 'Lats',
    view: 'back',
    functionCue: 'Pulls the upper arms down and back toward the hips while bracing the spine.',
    idle: '#7dd3fc',
    hot: '#0ea5e9',
    warm: '#38bdf8',
  },
  rhomboids: {
    id: 'rhomboids',
    label: 'Mid-Back & Rhomboids',
    scientific: 'Rhomboid major/minor & infraspinatus',
    short: 'Mid-back',
    view: 'back',
    functionCue: 'Pinches the shoulder blades together and locks upper-back posture.',
    idle: '#67e8f9',
    hot: '#06b6d4',
    warm: '#22d3ee',
  },
  lowerBack: {
    id: 'lowerBack',
    label: 'Spinal Erectors',
    scientific: 'Erector spinae',
    short: 'Lower back',
    view: 'back',
    functionCue: 'Extends the lumbar spine and resists spinal rounding during hinges and pulls.',
    idle: '#a5b4fc',
    hot: '#ff4d1a',
    warm: '#c6f000',
  },
  biceps: {
    id: 'biceps',
    label: 'Biceps & Brachialis',
    scientific: 'Biceps brachii (long & short head)',
    short: 'Biceps',
    view: 'front',
    functionCue: 'Flexes the elbow joint and supinates the forearm under pulling tension.',
    idle: '#c4b5fd',
    hot: '#8b5cf6',
    warm: '#a78bfa',
  },
  triceps: {
    id: 'triceps',
    label: 'Triceps',
    scientific: 'Triceps brachii (long, lateral & medial)',
    short: 'Triceps',
    view: 'back',
    functionCue: 'Extends the elbow to lock out presses and isolated arm extensions.',
    idle: '#e9d5ff',
    hot: '#d946ef',
    warm: '#e879f9',
  },
  forearms: {
    id: 'forearms',
    label: 'Forearms & Grip',
    scientific: 'Brachioradialis & wrist flexors/extensors',
    short: 'Forearms',
    view: 'both',
    functionCue: 'Generates crushing grip strength, stabilizes the wrist, and assists elbow flexion.',
    idle: '#d6d3d1',
    hot: '#a16207',
    warm: '#ca8a04',
  },
  abs: {
    id: 'abs',
    label: 'Six-Pack Abs',
    scientific: 'Rectus abdominis & transverse core',
    short: 'Abs',
    view: 'front',
    functionCue: 'Flexes the ribcage toward the pelvis and resists lumbar hyperextension.',
    idle: '#5eead4',
    hot: '#14b8a6',
    warm: '#2dd4bf',
  },
  obliques: {
    id: 'obliques',
    label: 'Obliques & Serratus',
    scientific: 'External/internal obliques & serratus',
    short: 'Obliques',
    view: 'front',
    functionCue: 'Rotates the torso, resists lateral tilt, and locks down ribcage stability.',
    idle: '#2dd4bf',
    hot: '#0d9488',
    warm: '#14b8a6',
  },
  glutes: {
    id: 'glutes',
    label: 'Glutes',
    scientific: 'Gluteus maximus & medius',
    short: 'Glutes',
    view: 'back',
    functionCue: 'Powerfully extends and externally rotates the hips out of deep flexion.',
    idle: '#f9a8d4',
    hot: '#ec4899',
    warm: '#f472b6',
  },
  quads: {
    id: 'quads',
    label: 'Quadriceps',
    scientific: 'Rectus femoris, vastus lateralis & medialis',
    short: 'Quads',
    view: 'front',
    functionCue: 'Extends the knee joint and drives upward force out of squats and lunges.',
    idle: '#86efac',
    hot: '#22c55e',
    warm: '#4ade80',
  },
  hamstrings: {
    id: 'hamstrings',
    label: 'Hamstrings',
    scientific: 'Biceps femoris & semitendinosus',
    short: 'Hamstrings',
    view: 'back',
    functionCue: 'Flexes the knee and extends the hip through posterior-chain hinges.',
    idle: '#bef264',
    hot: '#84cc16',
    warm: '#a3e635',
  },
  calves: {
    id: 'calves',
    label: 'Calves',
    scientific: 'Gastrocnemius & soleus',
    short: 'Calves',
    view: 'both',
    functionCue: 'Plantarflexes the ankle to drive through the ball of the foot and stabilize stance.',
    idle: '#67e8f9',
    hot: '#06b6d4',
    warm: '#22d3ee',
  },
  hipFlexors: {
    id: 'hipFlexors',
    label: 'Hip Flexors',
    scientific: 'Iliopsoas & tensor fasciae latae',
    short: 'Hip flexors',
    view: 'front',
    functionCue: 'Draws the thighs upward toward the torso during leg raises and stride recovery.',
    idle: '#6ee7b7',
    hot: '#10b981',
    warm: '#34d399',
  },
  adductors: {
    id: 'adductors',
    label: 'Inner Thigh Adductors',
    scientific: 'Adductor magnus, longus & gracilis',
    short: 'Adductors',
    view: 'front',
    functionCue: 'Stabilizes the pelvis and assists hip extension out of the bottom of squats.',
    idle: '#a7f3d0',
    hot: '#059669',
    warm: '#10b981',
  },
};

/** Which body view to open first for a set of highlighted parts. */
export function preferredView(primary: MusclePart[], secondary: MusclePart[] = []): BodyView {
  const parts = [...primary, ...secondary];
  const frontScore = parts.filter((p) => {
    const v = MUSCLE_PART_META[p].view;
    return v === 'front' || v === 'both';
  }).length;
  const backScore = parts.filter((p) => {
    const v = MUSCLE_PART_META[p].view;
    return v === 'back' || v === 'both';
  }).length;
  // Prefer the view where primary muscles are most unique (back-only or front-only).
  const primaryBack = primary.filter((p) => MUSCLE_PART_META[p].view === 'back').length;
  const primaryFront = primary.filter((p) => MUSCLE_PART_META[p].view === 'front').length;
  if (primaryBack > primaryFront) return 'back';
  if (primaryFront > primaryBack) return 'front';
  return backScore > frontScore ? 'back' : 'front';
}
