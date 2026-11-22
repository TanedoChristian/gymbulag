import type { MuscleGroup } from '../types';
import type { MusclePart } from './anatomy';

/** Motion family used by the SVG demo figure. */
export type DemoKind =
  | 'lateralRaise'
  | 'frontRaise'
  | 'overheadPress'
  | 'shrug'
  | 'benchPress'
  | 'fly'
  | 'pushup'
  | 'dip'
  | 'row'
  | 'pulldown'
  | 'pullup'
  | 'deadlift'
  | 'curl'
  | 'hammerCurl'
  | 'pushdown'
  | 'skullCrusher'
  | 'squat'
  | 'lunge'
  | 'legExtension'
  | 'legCurl'
  | 'hipThrust'
  | 'calfRaise'
  | 'plank'
  | 'crunch'
  | 'legRaise'
  | 'twist'
  | 'swing'
  | 'cardio'
  | 'farmersWalk'
  | 'generic';

export interface ExerciseGuide {
  steps: string[];
  cues: string[];
  mistakes: string[];
  primary: MusclePart[];
  secondary: MusclePart[];
  demo: DemoKind;
}

type GuideSeed = Omit<ExerciseGuide, 'mistakes'> & { mistakes?: string[] };

const DEFAULT_BY_MUSCLE: Record<MuscleGroup, Pick<ExerciseGuide, 'primary' | 'secondary' | 'demo'>> = {
  chest: { primary: ['pecs'], secondary: ['frontDelts', 'triceps'], demo: 'benchPress' },
  back: { primary: ['lats'], secondary: ['rhomboids', 'biceps', 'rearDelts'], demo: 'row' },
  shoulders: { primary: ['sideDelts', 'frontDelts'], secondary: ['traps', 'triceps'], demo: 'overheadPress' },
  biceps: { primary: ['biceps'], secondary: ['forearms'], demo: 'curl' },
  triceps: { primary: ['triceps'], secondary: ['frontDelts'], demo: 'pushdown' },
  forearms: { primary: ['forearms'], secondary: ['biceps'], demo: 'curl' },
  core: { primary: ['abs'], secondary: ['obliques'], demo: 'crunch' },
  quads: { primary: ['quads'], secondary: ['glutes', 'adductors'], demo: 'squat' },
  hamstrings: { primary: ['hamstrings'], secondary: ['glutes', 'lowerBack'], demo: 'deadlift' },
  glutes: { primary: ['glutes'], secondary: ['hamstrings'], demo: 'hipThrust' },
  calves: { primary: ['calves'], secondary: [], demo: 'calfRaise' },
  'full body': { primary: ['quads', 'glutes', 'lats'], secondary: ['hamstrings', 'abs'], demo: 'swing' },
  cardio: { primary: ['quads', 'calves'], secondary: ['glutes'], demo: 'cardio' },
};

const GUIDES: Record<string, GuideSeed> = {
  /* --------------------------------- Chest -------------------------------- */
  'bench-press': {
    demo: 'benchPress',
    primary: ['pecs'],
    secondary: ['frontDelts', 'triceps'],
    steps: [
      'Lie on a flat bench with feet planted and eyes under the bar.',
      'Grip slightly wider than shoulder width; unrack and hold the bar above mid-chest.',
      'Lower the bar to mid-chest with elbows about 45° from your torso.',
      'Press up until arms are nearly locked, keeping shoulder blades pinned.',
    ],
    cues: ['Drive feet into the floor', 'Bar path slightly diagonal toward the rack', 'Keep wrists stacked over elbows'],
    mistakes: ['Flaring elbows to 90°', 'Bouncing the bar off the chest', 'Lifting hips off the bench'],
  },
  'incline-bench-press': {
    demo: 'benchPress',
    primary: ['upperPecs', 'pecs'],
    secondary: ['frontDelts', 'triceps'],
    steps: [
      'Set the bench to about 30–45° and plant your feet.',
      'Unrack with a grip slightly wider than shoulders.',
      'Lower to the upper chest / collarbone line.',
      'Press up without shrugging the shoulders toward your ears.',
    ],
    cues: ['Think “up and slightly back”', 'Don’t go steeper than 45°', 'Keep glutes on the pad'],
  },
  'decline-bench-press': {
    demo: 'benchPress',
    primary: ['pecs'],
    secondary: ['triceps', 'frontDelts'],
    steps: [
      'Secure your legs on a decline bench and unrack above the lower chest.',
      'Lower with control to the lower pec line.',
      'Press to lockout without bouncing.',
    ],
    cues: ['Keep shoulder blades tucked', 'Don’t over-arch the low back'],
  },
  'db-bench-press': {
    demo: 'benchPress',
    primary: ['pecs'],
    secondary: ['frontDelts', 'triceps'],
    steps: [
      'Sit, kick the dumbbells up, and lie back with weights above your chest.',
      'Lower until elbows are roughly level with the bench.',
      'Press up and slightly together without clanking the bells.',
    ],
    cues: ['Palms face forward or slightly in', 'Soft bend in elbows at the top'],
  },
  'incline-db-press': {
    demo: 'benchPress',
    primary: ['upperPecs', 'pecs'],
    secondary: ['frontDelts', 'triceps'],
    steps: [
      'On a 30–45° incline, press dumbbells from upper-chest height to lockout.',
      'Lower with a slow eccentric; stop before the shoulders dump forward.',
    ],
    cues: ['Lead with the elbows under the wrists', 'Keep ribs down'],
  },
  'db-fly': {
    demo: 'fly',
    primary: ['pecs'],
    secondary: ['frontDelts'],
    steps: [
      'Lie flat holding dumbbells above the chest with a soft elbow bend.',
      'Open the arms in a wide arc until you feel a stretch across the chest.',
      'Squeeze the pecs to bring the weights back together over the chest.',
    ],
    cues: ['Keep the same elbow angle the whole way', 'Think hug a barrel', 'Don’t go so deep the shoulders hurt'],
    mistakes: ['Turning it into a press', 'Locking the elbows straight'],
  },
  'cable-fly': {
    demo: 'fly',
    primary: ['pecs'],
    secondary: ['frontDelts'],
    steps: [
      'Stand centered between high or mid cables with a soft forward lean.',
      'Bring the handles together in front of the chest in a hugging arc.',
      'Control the return until you feel a stretch, then repeat.',
    ],
    cues: ['Elbows slightly bent and fixed', 'Finish with hands meeting at sternum height'],
  },
  'chest-press-machine': {
    demo: 'benchPress',
    primary: ['pecs'],
    secondary: ['frontDelts', 'triceps'],
    steps: [
      'Adjust the seat so handles are at mid-chest.',
      'Press out to nearly locked elbows, then return with control.',
    ],
    cues: ['Keep back flat on the pad', 'Don’t shrug'],
  },
  'pec-deck': {
    demo: 'fly',
    primary: ['pecs'],
    secondary: ['frontDelts'],
    steps: [
      'Sit tall with elbows on the pads (or hands on grips) at chest height.',
      'Bring the pads together in front, squeeze, then open slowly.',
    ],
    cues: ['Avoid leaning forward', 'Stop before the stretch hurts the front of the shoulder'],
  },
  'push-up': {
    demo: 'pushup',
    primary: ['pecs'],
    secondary: ['triceps', 'frontDelts', 'abs'],
    steps: [
      'Hands under shoulders, body in a straight line from head to heels.',
      'Lower until chest nearly touches the floor.',
      'Press up without letting hips sag or pike.',
    ],
    cues: ['Screw hands into the floor', 'Squeeze glutes and abs'],
  },
  dips: {
    demo: 'dip',
    primary: ['pecs', 'triceps'],
    secondary: ['frontDelts'],
    steps: [
      'Support yourself on parallel bars with locked elbows.',
      'Lean slightly forward and lower until upper arms are about parallel to the floor.',
      'Press back up without shrugging.',
    ],
    cues: ['More forward lean = more chest', 'Upright torso = more triceps'],
  },

  /* ---------------------------------- Back -------------------------------- */
  deadlift: {
    demo: 'deadlift',
    primary: ['hamstrings', 'glutes', 'lowerBack'],
    secondary: ['traps', 'lats', 'forearms', 'quads'],
    steps: [
      'Stand with mid-foot under the bar, shins close, hinge and grip just outside the legs.',
      'Brace, set the back flat, and push the floor away.',
      'Stand tall with hips and shoulders rising together, then reverse to the floor.',
    ],
    cues: ['Bar stays over mid-foot', 'Lats “armpit tight”', 'Don’t yank with the arms'],
    mistakes: ['Rounding the low back', 'Hips shooting up first', 'Bar drifting forward'],
  },
  'barbell-row': {
    demo: 'row',
    primary: ['lats', 'rhomboids'],
    secondary: ['rearDelts', 'biceps', 'lowerBack'],
    steps: [
      'Hinge to about 45°, bar hanging at arm’s length.',
      'Row the bar to the lower ribs / upper abs.',
      'Lower under control without bouncing the torso.',
    ],
    cues: ['Pull elbows back, not up', 'Keep neck long', 'Brace like a plank'],
  },
  'pendlay-row': {
    demo: 'row',
    primary: ['lats', 'rhomboids'],
    secondary: ['rearDelts', 'biceps'],
    steps: [
      'From a dead-stop on the floor each rep, row explosively to the torso.',
      'Lower fully to the floor and reset your brace every rep.',
    ],
    cues: ['Chest parallel to the floor', 'No bounce off the plates'],
  },
  'db-row': {
    demo: 'row',
    primary: ['lats'],
    secondary: ['rhomboids', 'rearDelts', 'biceps'],
    steps: [
      'One knee and hand on a bench, opposite foot on the floor, dumbbell hanging.',
      'Row the weight to the hip, pause, then lower until the shoulder stretches.',
    ],
    cues: ['Pull to the back pocket', 'Don’t twist the torso for momentum'],
  },
  'pull-up': {
    demo: 'pullup',
    primary: ['lats'],
    secondary: ['biceps', 'rearDelts', 'traps'],
    steps: [
      'Hang from a bar with a pronated grip slightly wider than shoulders.',
      'Pull until chin clears the bar, driving elbows down.',
      'Lower to a full hang with control.',
    ],
    cues: ['Think “ribs to bar”', 'Avoid kipping unless intentional'],
  },
  'chin-up': {
    demo: 'pullup',
    primary: ['lats', 'biceps'],
    secondary: ['rearDelts'],
    steps: [
      'Hang with palms facing you, shoulder-width grip.',
      'Pull until chin clears, then lower fully.',
    ],
    cues: ['Keep shoulders packed down', 'Squeeze at the top'],
  },
  'lat-pulldown': {
    demo: 'pulldown',
    primary: ['lats'],
    secondary: ['biceps', 'rearDelts'],
    steps: [
      'Sit tall, thighs locked under the pad, grip the bar wide.',
      'Pull the bar to the upper chest, elbows tracking down and slightly back.',
      'Return until arms are long without losing torso angle.',
    ],
    cues: ['Lean back only a little', 'Don’t pull behind the neck'],
  },
  'seated-cable-row': {
    demo: 'row',
    primary: ['lats', 'rhomboids'],
    secondary: ['rearDelts', 'biceps'],
    steps: [
      'Sit with soft knees, torso upright, arms extended.',
      'Row the handle to the belly, squeeze the shoulder blades.',
      'Reach forward for a stretch without rounding hard.',
    ],
    cues: ['Chest proud', 'Pull with the elbows'],
  },
  't-bar-row': {
    demo: 'row',
    primary: ['lats', 'rhomboids'],
    secondary: ['rearDelts', 'biceps'],
    steps: [
      'Straddle the bar, hinge, and row the plates toward the chest.',
      'Lower until arms are long, keeping the back flat.',
    ],
    cues: ['Drive elbows back', 'Brace the core'],
  },
  'machine-row': {
    demo: 'row',
    primary: ['lats', 'rhomboids'],
    secondary: ['rearDelts', 'biceps'],
    steps: [
      'Set the chest pad so you can reach full stretch.',
      'Row handles to the ribs, pause, return slowly.',
    ],
    cues: ['Keep chest on the pad', 'No jerking'],
  },
  'straight-arm-pulldown': {
    demo: 'pulldown',
    primary: ['lats'],
    secondary: ['triceps', 'rearDelts'],
    steps: [
      'Stand facing a high cable with a straight bar or rope, soft elbows.',
      'Sweep the bar down to the thighs using the lats.',
      'Raise back to about shoulder height without shrugging.',
    ],
    cues: ['Hinge slightly', 'Think “push the floor away with the bar”'],
  },
  'back-extension': {
    demo: 'deadlift',
    primary: ['lowerBack', 'glutes'],
    secondary: ['hamstrings'],
    steps: [
      'On a hyperextension bench, cross arms or hold a plate at the chest.',
      'Hinge down with a flat back, then extend until the body is in line.',
    ],
    cues: ['Don’t hyperextend past neutral', 'Squeeze glutes at the top'],
  },
  'close-grip-row': {
    demo: 'row',
    primary: ['lats', 'rhomboids'],
    secondary: ['biceps', 'rearDelts'],
    steps: [
      'Use a close/neutral grip on a cable or machine row.',
      'Pull to the midsection, elbows close to the body.',
      'Reach long on the way out.',
    ],
    cues: ['Keep wrists neutral', 'Pause at the squeeze'],
  },
  'upper-back-row': {
    demo: 'row',
    primary: ['rhomboids', 'rearDelts', 'traps'],
    secondary: ['lats', 'biceps'],
    steps: [
      'Row with elbows flared more toward 45–60° to bias the upper back.',
      'Squeeze the shoulder blades together at the peak.',
    ],
    cues: ['Chest tall', 'Think “pinch a pencil” between the blades'],
  },

  /* ------------------------------- Shoulders ------------------------------ */
  'overhead-press': {
    demo: 'overheadPress',
    primary: ['frontDelts', 'sideDelts'],
    secondary: ['triceps', 'traps', 'abs'],
    steps: [
      'Stand with the bar at collarbone height, elbows slightly in front of the bar.',
      'Press up and slightly back so the bar finishes over mid-foot.',
      'Lower to the shoulders with control.',
    ],
    cues: ['Glutes and abs tight', 'Head moves back then through', 'Don’t lean back hard'],
  },
  'db-shoulder-press': {
    demo: 'overheadPress',
    primary: ['frontDelts', 'sideDelts'],
    secondary: ['triceps', 'traps'],
    steps: [
      'Seated or standing, start with dumbbells at ear height, palms forward.',
      'Press overhead until arms are long but not slammed locked.',
      'Lower until elbows are about 90° or slightly deeper.',
    ],
    cues: ['Ribs down', 'Don’t bang the bells together'],
  },
  'shoulder-press': {
    demo: 'overheadPress',
    primary: ['frontDelts', 'sideDelts'],
    secondary: ['triceps', 'traps'],
    steps: [
      'Adjust the seat so handles start near shoulder height.',
      'Press to near lockout, then lower slowly.',
    ],
    cues: ['Head against the pad', 'Don’t shrug into the ears'],
  },
  'arnold-press': {
    demo: 'overheadPress',
    primary: ['frontDelts', 'sideDelts'],
    secondary: ['triceps'],
    steps: [
      'Start with palms facing you at shoulder height.',
      'As you press, rotate so palms face forward at the top.',
      'Reverse the rotation on the way down.',
    ],
    cues: ['Smooth rotation', 'Don’t over-arch'],
  },
  'lateral-raise': {
    demo: 'lateralRaise',
    primary: ['sideDelts'],
    secondary: ['frontDelts', 'traps'],
    steps: [
      'Stand tall holding dumbbells at your sides, soft bend in the elbows, palms facing in.',
      'Raise both arms out to the sides until hands are about shoulder height.',
      'Pause briefly at the top with palms neutral or thumbs very slightly higher than pinkies.',
      'Lower slowly (2–3 seconds) back to your sides without resting the weights on your thighs.',
    ],
    cues: [
      'Lead with the elbows, not the hands',
      'Stop at shoulder height — higher recruits more traps',
      'Keep a micro-bend in the elbows the whole set',
      'Lean torso slightly forward if you want less front-delt bias',
    ],
    mistakes: [
      'Swinging with momentum from the hips',
      'Shrugging the shoulders up into the ears',
      'Going above the head',
      'Turning the thumbs down and forcing internal rotation',
    ],
  },
  'cable-lateral-raise': {
    demo: 'lateralRaise',
    primary: ['sideDelts'],
    secondary: ['frontDelts', 'traps'],
    steps: [
      'Stand side-on to a low cable, handle in the far hand across the body.',
      'Raise the arm out to the side to shoulder height against the cable.',
      'Lower under tension — the cable keeps load on the delt at the bottom.',
    ],
    cues: ['Stay tall', 'Keep the palm neutral or slightly thumbs-up', 'Use a light stack and feel the side delt'],
  },
  'rear-delt-fly': {
    demo: 'fly',
    primary: ['rearDelts'],
    secondary: ['rhomboids', 'traps'],
    steps: [
      'Hinge forward with dumbbells hanging under the chest.',
      'Raise the arms out to the sides with soft elbows until in line with the shoulders.',
      'Squeeze the rear delts, then lower.',
    ],
    cues: ['Think “reach wide”', 'Don’t row with the biceps', 'Neck stays long'],
  },
  'face-pull': {
    demo: 'row',
    primary: ['rearDelts', 'traps'],
    secondary: ['rhomboids'],
    steps: [
      'Set a rope at face height. Pull toward the face, splitting the rope to the ears.',
      'Externally rotate so knuckles point back at the finish.',
      'Return with control.',
    ],
    cues: ['Elbows high', 'Think “show your armpits”', 'Light enough to feel rear delts'],
  },
  shrug: {
    demo: 'shrug',
    primary: ['traps'],
    secondary: ['forearms'],
    steps: [
      'Hold heavy dumbbells or a bar at your sides.',
      'Shrug the shoulders straight up toward the ears.',
      'Pause, then lower fully.',
    ],
    cues: ['No rolling the shoulders', 'Arms stay long'],
  },
  'upright-row': {
    demo: 'shrug',
    primary: ['sideDelts', 'traps'],
    secondary: ['biceps', 'frontDelts'],
    steps: [
      'Hold a bar or EZ bar at the thighs with a narrow-to-moderate grip.',
      'Pull elbows up and out until the bar reaches about chest height.',
      'Lower slowly.',
    ],
    cues: ['Lead with elbows', 'Stop if the front of the shoulder pinches', 'Prefer a wider grip if shoulders feel cranky'],
  },

  /* -------------------------------- Biceps -------------------------------- */
  'barbell-curl': {
    demo: 'curl',
    primary: ['biceps'],
    secondary: ['forearms'],
    steps: [
      'Stand with the bar at the thighs, elbows pinned near the sides.',
      'Curl up without swinging, squeeze at the top, lower fully.',
    ],
    cues: ['Elbows stay put', 'Wrists neutral', 'Control the eccentric'],
  },
  'db-curl': {
    demo: 'curl',
    primary: ['biceps'],
    secondary: ['forearms'],
    steps: [
      'Curl dumbbells together or alternating, palms up.',
      'Lower until arms are long without slamming into the thighs.',
    ],
    cues: ['Supinate hard at the top', 'No torso rock'],
  },
  'hammer-curl': {
    demo: 'hammerCurl',
    primary: ['biceps', 'forearms'],
    secondary: [],
    steps: [
      'Hold dumbbells with a neutral (thumbs-up) grip.',
      'Curl without rotating the wrists.',
      'Lower under control.',
    ],
    cues: ['Great for brachialis and grip', 'Elbows glued to the ribs'],
  },
  'preacher-curl': {
    demo: 'curl',
    primary: ['biceps'],
    secondary: ['forearms'],
    steps: [
      'Sit or stand with the upper arms on the preacher pad.',
      'Curl up short of locking hard at the bottom on the way down — keep tension.',
    ],
    cues: ['Don’t hyperextend the elbows at the bottom', 'Full stretch without dumping the weight'],
  },
  'incline-db-curl': {
    demo: 'curl',
    primary: ['biceps'],
    secondary: ['forearms'],
    steps: [
      'On a 45–60° incline, let the arms hang behind the torso.',
      'Curl without letting the elbows drift forward.',
    ],
    cues: ['Big stretch at the bottom', 'Slow negatives'],
  },
  'cable-curl': {
    demo: 'curl',
    primary: ['biceps'],
    secondary: ['forearms'],
    steps: [
      'Face a low cable, curl the bar or handle to the shoulders.',
      'Keep constant tension — no rest at the bottom.',
    ],
    cues: ['Elbows fixed', 'Squeeze hard at peak'],
  },
  'recline-curl': {
    demo: 'curl',
    primary: ['biceps'],
    secondary: ['forearms'],
    steps: [
      'On a cable with a slight recline or leaning back, curl with constant tension.',
      'Control both directions.',
    ],
    cues: ['Don’t use the hips', 'Full range'],
  },
  'reverse-curl': {
    demo: 'curl',
    primary: ['forearms', 'biceps'],
    secondary: [],
    steps: [
      'Grip a bar overhand (palms down) and curl to the chest.',
      'Lower slowly — this biases the brachioradialis.',
    ],
    cues: ['Use less weight than a normal curl', 'Wrists stay flat'],
  },

  /* -------------------------------- Triceps ------------------------------- */
  'close-grip-bench': {
    demo: 'benchPress',
    primary: ['triceps'],
    secondary: ['pecs', 'frontDelts'],
    steps: [
      'Bench with a grip about shoulder-width (not ultra-narrow).',
      'Lower to the lower chest with elbows tucked.',
      'Press up focusing on the triceps.',
    ],
    cues: ['Wrists over elbows', 'Don’t flare hard'],
  },
  'tricep-pushdown': {
    demo: 'pushdown',
    primary: ['triceps'],
    secondary: [],
    steps: [
      'Stand at a high cable with a bar or rope, elbows pinned to the ribs.',
      'Extend the elbows until arms are straight, squeeze, then return.',
    ],
    cues: ['Only the forearms move', 'Slight lean forward is fine'],
  },
  'overhead-tricep-extension': {
    demo: 'skullCrusher',
    primary: ['triceps'],
    secondary: [],
    steps: [
      'Hold a cable or dumbbell overhead with elbows pointing up.',
      'Bend at the elbows to lower behind the head, then extend.',
    ],
    cues: ['Upper arms stay still', 'Big stretch on the long head'],
  },
  'skull-crusher': {
    demo: 'skullCrusher',
    primary: ['triceps'],
    secondary: [],
    steps: [
      'Lie on a bench holding an EZ bar above the chest.',
      'Bend elbows to lower the bar toward the forehead or just behind.',
      'Extend back to the start.',
    ],
    cues: ['Elbows point at the ceiling', 'Don’t flare wide'],
  },
  'tricep-dip-machine': {
    demo: 'dip',
    primary: ['triceps'],
    secondary: ['pecs', 'frontDelts'],
    steps: [
      'Sit or kneel on the dip machine with pads on the elbows or hands on levers.',
      'Extend the elbows fully, then bend to about 90°.',
    ],
    cues: ['Stay upright for more triceps', 'Controlled tempo'],
  },
  'single-arm-cuff-tricep-extension': {
    demo: 'pushdown',
    primary: ['triceps'],
    secondary: [],
    steps: [
      'Attach a cuff to a cable, elbow high or at the side depending on setup.',
      'Extend the elbow against the cable, then return with control.',
    ],
    cues: ['Isolate one arm', 'No torso twist'],
  },

  /* ------------------------------- Forearms ------------------------------- */
  'wrist-curl': {
    demo: 'curl',
    primary: ['forearms'],
    secondary: [],
    steps: [
      'Forearms on a bench, wrists hanging off the edge, palms up.',
      'Curl the weight up using only the wrists, then lower.',
    ],
    cues: ['Full stretch at the bottom', 'Light weight, high control'],
  },
  'farmers-walk': {
    demo: 'farmersWalk',
    primary: ['forearms', 'traps'],
    secondary: ['abs', 'glutes', 'calves'],
    steps: [
      'Pick up heavy dumbbells or farmer handles at your sides.',
      'Walk tall with short, quick steps for distance or time.',
      'Set down under control.',
    ],
    cues: ['Ribs down, shoulders packed', 'Don’t lean to one side'],
  },

  /* --------------------------------- Core --------------------------------- */
  plank: {
    demo: 'plank',
    primary: ['abs'],
    secondary: ['obliques', 'frontDelts', 'glutes'],
    steps: [
      'Forearms and toes on the floor, body in a straight line.',
      'Hold without letting hips sag or pike.',
    ],
    cues: ['Squeeze glutes', 'Push the floor away', 'Breathe steadily'],
  },
  'hanging-leg-raise': {
    demo: 'legRaise',
    primary: ['abs', 'hipFlexors'],
    secondary: ['obliques', 'forearms'],
    steps: [
      'Hang from a bar with a hollow body.',
      'Raise legs (bent or straight) until hips roll slightly under.',
      'Lower without swinging.',
    ],
    cues: ['Posterior tilt at the top', 'Minimize kip'],
  },
  'cable-crunch': {
    demo: 'crunch',
    primary: ['abs'],
    secondary: ['obliques'],
    steps: [
      'Kneel under a high cable with a rope at the shoulders.',
      'Crunch the ribs toward the pelvis, then return.',
    ],
    cues: ['Move the spine, not the hips', 'Exhale on the crunch'],
  },
  'ab-wheel': {
    demo: 'plank',
    primary: ['abs'],
    secondary: ['lats', 'hipFlexors', 'triceps'],
    steps: [
      'From knees (or standing), roll the wheel forward until you feel abs working hard.',
      'Pull back to the start without sagging the low back.',
    ],
    cues: ['Brace like a plank', 'Don’t go farther than you can control'],
  },
  'russian-twist': {
    demo: 'twist',
    primary: ['obliques', 'abs'],
    secondary: [],
    steps: [
      'Sit with a slight lean back, feet up or down, hold a weight at the chest.',
      'Rotate the torso side to side with control.',
    ],
    cues: ['Rotate from the ribs', 'Don’t just swing the arms'],
  },

  /* --------------------------------- Legs --------------------------------- */
  squat: {
    demo: 'squat',
    primary: ['quads', 'glutes'],
    secondary: ['hamstrings', 'abs', 'adductors'],
    steps: [
      'Bar on the upper back, feet about shoulder-width, toes slightly out.',
      'Break at hips and knees, sit between the heels to depth you own.',
      'Drive up while keeping the chest tall.',
    ],
    cues: ['Knees track over toes', 'Brace before every rep', 'Full foot pressure'],
  },
  'front-squat': {
    demo: 'squat',
    primary: ['quads'],
    secondary: ['glutes', 'abs', 'upperPecs'],
    steps: [
      'Bar in the front rack, elbows high.',
      'Squat between the heels keeping the torso upright.',
      'Stand without letting elbows drop.',
    ],
    cues: ['Elbows up = chest up', 'More knee travel than back squat'],
  },
  'leg-press': {
    demo: 'squat',
    primary: ['quads', 'glutes'],
    secondary: ['hamstrings'],
    steps: [
      'Feet mid-platform, lower the sled until knees are deep but hips stay down.',
      'Press without locking violently or letting the low back round.',
    ],
    cues: ['Full foot on the platform', 'Don’t let knees cave'],
  },
  'hack-squat': {
    demo: 'squat',
    primary: ['quads'],
    secondary: ['glutes'],
    steps: [
      'Shoulders under the pads, feet forward on the platform.',
      'Descend until thighs are deep, then drive up.',
    ],
    cues: ['Keep heels down', 'Controlled depth'],
  },
  'leg-extension': {
    demo: 'legExtension',
    primary: ['quads'],
    secondary: [],
    steps: [
      'Sit with the pad on the lower shins, knees aligned with the machine axis.',
      'Extend until legs are straight, squeeze, lower slowly.',
    ],
    cues: ['Don’t slam the stack', 'Toes can point slightly out'],
  },
  'bulgarian-split-squat': {
    demo: 'lunge',
    primary: ['quads', 'glutes'],
    secondary: ['hamstrings', 'adductors'],
    steps: [
      'Back foot elevated, front foot far enough to lunge comfortably.',
      'Drop the back knee toward the floor, then drive through the front heel.',
    ],
    cues: ['Torso slight forward lean is fine', 'Front knee tracks the toes'],
  },
  lunge: {
    demo: 'lunge',
    primary: ['quads', 'glutes'],
    secondary: ['hamstrings', 'calves'],
    steps: [
      'Step forward into a long stride and lower until both knees are about 90°.',
      'Push off to bring the feet together and alternate, or walk forward.',
    ],
    cues: ['Front shin mostly vertical', 'Stay tall'],
  },
  'goblet-squat': {
    demo: 'squat',
    primary: ['quads', 'glutes'],
    secondary: ['abs', 'adductors'],
    steps: [
      'Hold a dumbbell or kettlebell at the chest.',
      'Squat deep between the knees, elbows inside the thighs if mobility allows.',
      'Stand while keeping the weight close to the body.',
    ],
    cues: ['Elbows point down', 'Great teaching squat'],
  },
  'romanian-deadlift': {
    demo: 'deadlift',
    primary: ['hamstrings', 'glutes'],
    secondary: ['lowerBack', 'forearms'],
    steps: [
      'From standing, soft knees, push hips back as the bar slides down the thighs.',
      'Stop when you feel a strong hamstring stretch with a flat back.',
      'Drive hips forward to stand.',
    ],
    cues: ['Bar stays on the legs', 'Hips back, not knees forward', 'Feel the stretch'],
  },
  'lying-leg-curl': {
    demo: 'legCurl',
    primary: ['hamstrings'],
    secondary: ['calves'],
    steps: [
      'Lie face down with the pad just above the heels.',
      'Curl toward the glutes, squeeze, lower slowly.',
    ],
    cues: ['Hips stay glued to the pad', 'Full stretch at the bottom'],
  },
  'seated-leg-curl': {
    demo: 'legCurl',
    primary: ['hamstrings'],
    secondary: [],
    steps: [
      'Sit with the thigh pad locked and ankle pad on the back of the lower legs.',
      'Curl down against the machine, then return.',
    ],
    cues: ['Control the stretch', 'Don’t use momentum'],
  },
  'good-morning': {
    demo: 'deadlift',
    primary: ['hamstrings', 'lowerBack'],
    secondary: ['glutes'],
    steps: [
      'Bar on the back, soft knees, hinge until the torso is near parallel.',
      'Drive hips forward to stand.',
    ],
    cues: ['Light weight first', 'Back stays flat'],
  },
  'hip-thrust': {
    demo: 'hipThrust',
    primary: ['glutes'],
    secondary: ['hamstrings', 'quads'],
    steps: [
      'Upper back on a bench, bar over the hips with a pad.',
      'Drive through the heels to full hip extension, squeeze the glutes.',
      'Lower until hips are deep, then repeat.',
    ],
    cues: ['Chin tucked slightly', 'Don’t overextend the lumbar spine', 'Pause at the top'],
  },
  'glute-bridge': {
    demo: 'hipThrust',
    primary: ['glutes'],
    secondary: ['hamstrings'],
    steps: [
      'Lie on your back, knees bent, feet flat.',
      'Bridge the hips up, squeeze, lower.',
    ],
    cues: ['Push through heels', 'Ribs down'],
  },
  'cable-kickback': {
    demo: 'hipThrust',
    primary: ['glutes'],
    secondary: ['hamstrings'],
    steps: [
      'Ankle cuff on a low cable. Kick the leg back without arching hard.',
      'Return with control.',
    ],
    cues: ['Squeeze at full extension', 'Keep hips square'],
  },
  'hip-abduction': {
    demo: 'hipThrust',
    primary: ['glutes'],
    secondary: [],
    steps: [
      'Sit in the abductor machine and drive the knees outward against the pads.',
      'Return slowly.',
    ],
    cues: ['Sit tall', 'Control both directions'],
  },
  'standing-calf-raise': {
    demo: 'calfRaise',
    primary: ['calves'],
    secondary: [],
    steps: [
      'Stand on the block with the balls of the feet, hang the heels for a stretch.',
      'Rise as high as you can on the toes, pause, lower slowly.',
    ],
    cues: ['Full stretch, full squeeze', 'Knees soft but not bent for momentum'],
  },
  'seated-calf-raise': {
    demo: 'calfRaise',
    primary: ['calves'],
    secondary: [],
    steps: [
      'Sit with the pad on the thighs, balls of feet on the platform.',
      'Raise the heels high, then lower into a deep stretch.',
    ],
    cues: ['Biases soleus more than standing', 'Pause at the top'],
  },

  /* ------------------------------- Full body ------------------------------ */
  'power-clean': {
    demo: 'deadlift',
    primary: ['quads', 'glutes', 'traps'],
    secondary: ['hamstrings', 'forearms', 'abs'],
    steps: [
      'From the floor, explode through the hips and catch the bar in a front rack.',
      'Stand to finish, then reset.',
    ],
    cues: ['Jump the bar up, don’t curl it', 'Learn with a coach if new'],
  },
  'kb-swing': {
    demo: 'swing',
    primary: ['glutes', 'hamstrings'],
    secondary: ['abs', 'lats', 'forearms'],
    steps: [
      'Hinge, hike the kettlebell back between the legs.',
      'Snap the hips to swing the bell to about chest height.',
      'Let it fall back into the next hinge.',
    ],
    cues: ['Power from the hips, not the arms', 'Pack the shoulders'],
  },
  burpee: {
    demo: 'pushup',
    primary: ['quads', 'pecs', 'abs'],
    secondary: ['triceps', 'glutes', 'calves'],
    steps: [
      'Squat hands to floor, jump or step feet back to a plank.',
      'Optional push-up, jump feet in, then jump up.',
    ],
    cues: ['Keep the plank honest', 'Land soft'],
  },

  /* -------------------------------- Cardio -------------------------------- */
  treadmill: {
    demo: 'cardio',
    primary: ['quads', 'calves'],
    secondary: ['glutes', 'hamstrings'],
    steps: [
      'Start with a walk, then set speed/incline for your goal.',
      'Stay upright, don’t hold the rails unless needed for balance.',
    ],
    cues: ['Warm up first', 'Use incline for more glute work'],
  },
  'rowing-machine': {
    demo: 'row',
    primary: ['lats', 'quads'],
    secondary: ['hamstrings', 'biceps', 'abs'],
    steps: [
      'Catch → drive with the legs → open the hips → pull the handle to the ribs.',
      'Recover in reverse: arms, hips, then knees.',
    ],
    cues: ['Legs do most of the work', 'Don’t yank with the arms first'],
  },
  'stationary-bike': {
    demo: 'cardio',
    primary: ['quads'],
    secondary: ['hamstrings', 'calves', 'glutes'],
    steps: [
      'Set seat height so the knee is soft at the bottom of the stroke.',
      'Pedal smoothly at your target effort.',
    ],
    cues: ['Cadence steady', 'Don’t bounce in the saddle'],
  },
  'jump-rope': {
    demo: 'cardio',
    primary: ['calves'],
    secondary: ['quads', 'forearms', 'abs'],
    steps: [
      'Light bounces on the balls of the feet, wrists turning the rope.',
      'Stay relaxed in the shoulders.',
    ],
    cues: ['Small jumps', 'Look ahead, not down'],
  },
};

function fallbackGuide(muscle: MuscleGroup, name: string): ExerciseGuide {
  const base = DEFAULT_BY_MUSCLE[muscle] ?? DEFAULT_BY_MUSCLE['full body'];
  return {
    demo: base.demo,
    primary: base.primary,
    secondary: base.secondary,
    steps: [
      `Set up for ${name} with stable footing and a braced core.`,
      'Move through a full, controlled range that feels strong in the target muscle.',
      'Return to the start under control and repeat for the planned reps.',
    ],
    cues: ['Quality over load', 'Stop if a joint feels sharp pain', 'Breathe out on the effort'],
    mistakes: ['Using momentum instead of the muscle', 'Cutting the range short', 'Rushing every rep'],
  };
}

export function getExerciseGuide(exerciseId: string, muscle: MuscleGroup, name: string): ExerciseGuide {
  const g = GUIDES[exerciseId];
  if (!g) return fallbackGuide(muscle, name);
  return {
    ...g,
    mistakes: g.mistakes ?? ['Using momentum instead of the muscle', 'Cutting the range short'],
  };
}

export function hasCustomGuide(exerciseId: string): boolean {
  return exerciseId in GUIDES;
}
