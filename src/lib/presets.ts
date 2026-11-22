import type { Template, TemplateSet } from '../types';

/** Ready-made templates shipped with the app. Fixed ids so they're only ever added once. */
const PRESETS: { id: string; name: string; exerciseIds: string[] }[] = [
  {
    id: 'preset-upper-a',
    name: 'Upper A',
    exerciseIds: [
      'incline-bench-press',
      'lat-pulldown',
      'shoulder-press',
      'cable-fly',
      'close-grip-row',
      'upper-back-row',
      'lateral-raise',
      'single-arm-cuff-tricep-extension',
      'tricep-pushdown',
      'recline-curl',
      'preacher-curl',
      'reverse-curl',
    ],
  },
  {
    id: 'preset-lower-b',
    name: 'Lower B',
    exerciseIds: ['leg-press', 'romanian-deadlift', 'leg-extension', 'seated-leg-curl', 'cable-curl', 'standing-calf-raise'],
  },
];

const threeSets = (): TemplateSet[] => Array.from({ length: 3 }, () => ({ type: 'normal' as const, reps: null, weight: null }));

/** Build preset templates; `alias` remaps an exercise id (e.g. to a custom exercise the user already had with that name). */
export function presetTemplates(alias: Map<string, string> = new Map(), now = Date.now()): Template[] {
  return PRESETS.map((p) => ({
    id: p.id,
    name: p.name,
    exercises: p.exerciseIds.map((id) => ({ exerciseId: alias.get(id) ?? id, sets: threeSets() })),
    createdAt: now,
    // 0 = untouched preset, so an edited copy on another device always wins a sync.
    updatedAt: 0,
  }));
}
