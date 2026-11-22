import type { Equipment } from '../types';
import type { DemoKind } from './exerciseGuides';

export type Point = { x: number; y: number };
export type MotionView = 'front' | 'side';
export type SceneKind = 'floor' | 'bench' | 'incline-bench' | 'decline-bench' | 'cable' | 'high-cable' | 'pullup' | 'dip-bars' | 'machine-seat' | 'leg-press' | 'preacher' | 'roman-chair' | 'bike' | 'rower' | 'treadmill';
export type PropKind = 'none' | 'dumbbells' | 'barbell' | 'ez-bar' | 'kettlebell' | 'rope' | 'cable-handle' | 'ab-wheel';

export interface FigurePose {
  head: Point; neck: Point;
  shoulderL: Point; shoulderR: Point;
  elbowL: Point; elbowR: Point;
  handL: Point; handR: Point;
  hipL: Point; hipR: Point;
  kneeL: Point; kneeR: Point;
  ankleL: Point; ankleR: Point;
  toeL: Point; toeR: Point;
}

export interface MotionFrame { label: string; pose: FigurePose }
export interface MotionProfile {
  view: MotionView;
  scene: SceneKind;
  prop: PropKind;
  frames: MotionFrame[];
  tempoMs: number;
  instruction: string;
}

const FRONT: FigurePose = {
  head:{x:160,y:39}, neck:{x:160,y:62},
  shoulderL:{x:132,y:76}, shoulderR:{x:188,y:76},
  elbowL:{x:122,y:121}, elbowR:{x:198,y:121},
  handL:{x:120,y:166}, handR:{x:200,y:166},
  hipL:{x:145,y:159}, hipR:{x:175,y:159},
  kneeL:{x:143,y:216}, kneeR:{x:177,y:216},
  ankleL:{x:140,y:271}, ankleR:{x:180,y:271},
  toeL:{x:132,y:281}, toeR:{x:188,y:281},
};

const SIDE: FigurePose = {
  head:{x:163,y:39}, neck:{x:158,y:62},
  shoulderL:{x:154,y:77}, shoulderR:{x:166,y:80},
  elbowL:{x:151,y:124}, elbowR:{x:171,y:126},
  handL:{x:151,y:169}, handR:{x:173,y:171},
  hipL:{x:153,y:159}, hipR:{x:169,y:160},
  kneeL:{x:151,y:217}, kneeR:{x:173,y:219},
  ankleL:{x:149,y:271}, ankleR:{x:175,y:272},
  toeL:{x:166,y:279}, toeR:{x:192,y:280},
};

const p = (base: FigurePose, patch: Partial<FigurePose>): FigurePose => ({ ...base, ...patch });
const f = (label: string, pose: FigurePose): MotionFrame => ({ label, pose });
const make = (view: MotionView, scene: SceneKind, prop: PropKind, instruction: string, frames: MotionFrame[], tempoMs = 2700): MotionProfile =>
  ({ view, scene, prop, instruction, frames, tempoMs });

function press(prop: PropKind, scene: SceneKind = 'floor') {
  return make('front', scene, prop, 'Press vertically and stack the wrists over the shoulders.', [
    f('Rack', p(FRONT, { elbowL:{x:125,y:99}, elbowR:{x:195,y:99}, handL:{x:140,y:79}, handR:{x:180,y:79} })),
    f('Lockout', p(FRONT, { elbowL:{x:136,y:43}, elbowR:{x:184,y:43}, handL:{x:145,y:17}, handR:{x:175,y:17} })),
  ]);
}

function seatedPress(prop: PropKind, overhead: boolean) {
  const seated = p(FRONT, {
    head:{x:160,y:48}, neck:{x:160,y:71},
    shoulderL:{x:132,y:85}, shoulderR:{x:188,y:85},
    hipL:{x:145,y:174}, hipR:{x:175,y:174},
    kneeL:{x:119,y:220}, kneeR:{x:201,y:220},
    ankleL:{x:117,y:273}, ankleR:{x:203,y:273},
    toeL:{x:105,y:282}, toeR:{x:215,y:282},
  });
  if (overhead) {
    return make('front', 'machine-seat', prop, 'Keep the back on the pad and press overhead without shrugging.', [
      f('Rack', p(seated, { elbowL:{x:121,y:108}, elbowR:{x:199,y:108}, handL:{x:140,y:88}, handR:{x:180,y:88} })),
      f('Lockout', p(seated, { elbowL:{x:136,y:49}, elbowR:{x:184,y:49}, handL:{x:145,y:20}, handR:{x:175,y:20} })),
    ]);
  }
  const side = p(SIDE, {
    head:{x:129,y:56}, neck:{x:129,y:79},
    shoulderL:{x:126,y:94}, shoulderR:{x:138,y:97},
    elbowL:{x:152,y:112}, elbowR:{x:158,y:121},
    handL:{x:177,y:119}, handR:{x:184,y:128},
    hipL:{x:128,y:177}, hipR:{x:144,y:179},
    kneeL:{x:187,y:182}, kneeR:{x:195,y:189},
    ankleL:{x:185,y:248}, ankleR:{x:198,y:251},
    toeL:{x:204,y:255}, toeR:{x:217,y:258},
  });
  return make('side', 'machine-seat', prop, 'Keep the shoulder blades on the pad and press straight forward.', [
    f('Lower', side),
    f('Press', p(side, {
      elbowL:{x:190,y:113}, elbowR:{x:196,y:121},
      handL:{x:229,y:116}, handR:{x:235,y:124},
    })),
  ]);
}

function bench(prop: PropKind, scene: SceneKind = 'bench') {
  const down = p(SIDE, {
    head:{x:87,y:160}, neck:{x:105,y:164}, shoulderL:{x:119,y:159}, shoulderR:{x:122,y:166},
    elbowL:{x:139,y:126}, elbowR:{x:143,y:178}, handL:{x:164,y:142}, handR:{x:166,y:160},
    hipL:{x:188,y:164}, hipR:{x:193,y:171}, kneeL:{x:225,y:196}, kneeR:{x:221,y:202},
    ankleL:{x:229,y:247}, ankleR:{x:217,y:248}, toeL:{x:246,y:254}, toeR:{x:235,y:255},
  });
  return make('side', scene, prop, 'Lower to the chest, then press until the arms are long.', [
    f('Lower', down),
    f('Press', p(down, { elbowL:{x:156,y:108}, elbowR:{x:160,y:115}, handL:{x:171,y:78}, handR:{x:176,y:84} })),
  ]);
}

function fly(prop: PropKind, scene: SceneKind) {
  const base = bench(prop, scene).frames[0].pose;
  return make('side', scene, prop, 'Keep a soft elbow bend and close the arms in a wide arc.', [
    f('Stretch', p(base, { elbowL:{x:139,y:130}, elbowR:{x:139,y:194}, handL:{x:172,y:138}, handR:{x:172,y:201} })),
    f('Squeeze', p(base, { elbowL:{x:155,y:110}, elbowR:{x:160,y:116}, handL:{x:170,y:84}, handR:{x:175,y:89} })),
  ]);
}

function lateral(prop: PropKind) {
  return make('front', prop === 'cable-handle' ? 'cable' : 'floor', prop, 'Lead with the elbows and stop at shoulder height.', [
    f('Lower', FRONT),
    f('Raise', p(FRONT, { elbowL:{x:91,y:81}, elbowR:{x:229,y:81}, handL:{x:52,y:86}, handR:{x:268,y:86} })),
  ]);
}

function cableLateral() {
  return make('front', 'cable', 'cable-handle', 'Keep the torso still and raise the working arm to shoulder height.', [
    f('Across body', p(FRONT, {
      elbowR:{x:178,y:125}, handR:{x:146,y:161},
    })),
    f('Raise', p(FRONT, {
      elbowR:{x:229,y:81}, handR:{x:268,y:86},
    })),
  ], 2800);
}

function row(prop: PropKind, scene: SceneKind = 'floor') {
  const start = p(SIDE, {
    head:{x:196,y:85}, neck:{x:181,y:101}, shoulderL:{x:163,y:111}, shoulderR:{x:171,y:116},
    elbowL:{x:173,y:153}, elbowR:{x:181,y:156}, handL:{x:184,y:196}, handR:{x:192,y:198},
    hipL:{x:127,y:154}, hipR:{x:138,y:160}, kneeL:{x:135,y:213}, kneeR:{x:151,y:216},
    ankleL:{x:129,y:270}, ankleR:{x:156,y:271}, toeL:{x:147,y:279}, toeR:{x:174,y:280},
  });
  return make('side', scene, prop, 'Brace the torso and drive the elbows toward the hips.', [
    f('Reach', start),
    f('Row', p(start, { elbowL:{x:137,y:132}, elbowR:{x:144,y:138}, handL:{x:148,y:153}, handR:{x:154,y:158} })),
  ]);
}

function pulldown(prop: PropKind, scene: SceneKind = 'high-cable') {
  return make('front', scene, prop, 'Keep the chest tall and drive the elbows down.', [
    f('Stretch', p(FRONT, { elbowL:{x:130,y:42}, elbowR:{x:190,y:42}, handL:{x:115,y:14}, handR:{x:205,y:14} })),
    f('Pull', p(FRONT, { elbowL:{x:116,y:104}, elbowR:{x:204,y:104}, handL:{x:138,y:78}, handR:{x:182,y:78} })),
  ]);
}

function latPulldown() {
  const seated = p(FRONT, {
    hipL:{x:145,y:165}, hipR:{x:175,y:165},
    kneeL:{x:119,y:216}, kneeR:{x:201,y:216},
    ankleL:{x:118,y:271}, ankleR:{x:202,y:271},
    toeL:{x:107,y:281}, toeR:{x:213,y:281},
  });
  return make('front', 'high-cable', 'barbell', 'Sit tall and drive the elbows down toward the ribs.', [
    f('Stretch', p(seated, {
      elbowL:{x:130,y:42}, elbowR:{x:190,y:42},
      handL:{x:115,y:14}, handR:{x:205,y:14},
    })),
    f('Pull', p(seated, {
      elbowL:{x:116,y:104}, elbowR:{x:204,y:104},
      handL:{x:138,y:78}, handR:{x:182,y:78},
    })),
  ]);
}

function curl(prop: PropKind, scene: SceneKind = 'floor') {
  return make('front', scene, prop, 'Keep the upper arms quiet and bend only at the elbows.', [
    f('Extend', FRONT),
    f('Curl', p(FRONT, { elbowL:{x:126,y:122}, elbowR:{x:194,y:122}, handL:{x:139,y:85}, handR:{x:181,y:85} })),
  ]);
}

function pushdown(prop: PropKind) {
  return make('side', 'high-cable', prop, 'Pin the elbows beside the ribs and straighten the forearms.', [
    f('Bend', p(SIDE, { elbowL:{x:157,y:117}, elbowR:{x:169,y:120}, handL:{x:184,y:93}, handR:{x:191,y:98} })),
    f('Extend', p(SIDE, { elbowL:{x:157,y:117}, elbowR:{x:169,y:120}, handL:{x:158,y:160}, handR:{x:173,y:162} })),
  ]);
}

function squat(prop: PropKind, scene: SceneKind = 'floor') {
  return make('side', scene, prop, 'Sit between the heels and track the knees over the toes.', [
    f('Stand', SIDE),
    f('Depth', p(SIDE, {
      head:{x:170,y:77}, neck:{x:164,y:99}, shoulderL:{x:156,y:113}, shoulderR:{x:170,y:115},
      elbowL:{x:145,y:147}, elbowR:{x:175,y:147}, handL:{x:154,y:126}, handR:{x:181,y:130},
      hipL:{x:125,y:184}, hipR:{x:141,y:187}, kneeL:{x:174,y:218}, kneeR:{x:190,y:221},
      ankleL:{x:151,y:271}, ankleR:{x:175,y:272}, toeL:{x:173,y:280}, toeR:{x:199,y:281},
    })),
  ], 3100);
}

function legPress() {
  const bottom = p(SIDE, {
    head:{x:91,y:116}, neck:{x:108,y:130},
    shoulderL:{x:126,y:144}, shoulderR:{x:132,y:152},
    elbowL:{x:112,y:178}, elbowR:{x:124,y:183},
    handL:{x:94,y:207}, handR:{x:108,y:213},
    hipL:{x:164,y:184}, hipR:{x:174,y:192},
    kneeL:{x:213,y:154}, kneeR:{x:224,y:161},
    ankleL:{x:244,y:111}, ankleR:{x:255,y:119},
    toeL:{x:254,y:96}, toeR:{x:265,y:104},
  });
  return make('side', 'leg-press', 'none', 'Keep the pelvis on the pad and press through the whole foot without snapping the knees.', [
    f('Depth', bottom),
    f('Press', p(bottom, {
      kneeL:{x:235,y:130}, kneeR:{x:245,y:138},
      ankleL:{x:270,y:86}, ankleR:{x:280,y:94},
      toeL:{x:280,y:72}, toeR:{x:290,y:80},
    })),
  ], 3000);
}

function hinge(prop: PropKind) {
  return make('side', 'floor', prop, 'Push the hips back while the load stays close to the legs.', [
    f('Stand', SIDE),
    f('Hinge', p(SIDE, {
      head:{x:218,y:105}, neck:{x:198,y:115}, shoulderL:{x:174,y:126}, shoulderR:{x:182,y:132},
      elbowL:{x:180,y:169}, elbowR:{x:190,y:172}, handL:{x:184,y:211}, handR:{x:195,y:214},
      hipL:{x:119,y:157}, hipR:{x:134,y:163}, kneeL:{x:143,y:216}, kneeR:{x:160,y:219},
    })),
  ], 3100);
}

function lunge() {
  return make('side', 'floor', 'dumbbells', 'Drop straight down with the front foot planted.', [
    f('Split stance', p(SIDE, {
      kneeL:{x:122,y:219}, ankleL:{x:100,y:270}, toeL:{x:120,y:280},
      kneeR:{x:210,y:219}, ankleR:{x:230,y:270}, toeR:{x:250,y:280},
    })),
    f('Lower', p(SIDE, {
      head:{x:163,y:71}, neck:{x:158,y:94}, shoulderL:{x:154,y:108}, shoulderR:{x:166,y:111},
      elbowL:{x:151,y:153}, elbowR:{x:171,y:155}, handL:{x:151,y:198}, handR:{x:173,y:200},
      hipL:{x:153,y:190}, hipR:{x:169,y:191}, kneeL:{x:112,y:223}, ankleL:{x:99,y:271},
      toeL:{x:121,y:280}, kneeR:{x:207,y:225}, ankleR:{x:229,y:271}, toeR:{x:251,y:280},
    })),
  ], 3100);
}

function plank(prop: PropKind = 'none') {
  const hold = p(SIDE, {
    head:{x:248,y:196}, neck:{x:227,y:203}, shoulderL:{x:205,y:209}, shoulderR:{x:211,y:215},
    elbowL:{x:208,y:276}, elbowR:{x:218,y:277}, handL:{x:244,y:278}, handR:{x:254,y:279},
    hipL:{x:143,y:222}, hipR:{x:150,y:227}, kneeL:{x:93,y:244}, kneeR:{x:100,y:248},
    ankleL:{x:49,y:264}, ankleR:{x:57,y:267}, toeL:{x:38,y:280}, toeR:{x:46,y:281},
  });
  return make('side', 'floor', prop, 'Keep ribs tucked and the body in one long line.', [f('Brace', hold)]);
}

function seatedLeg(extension: boolean, lying = false) {
  if (lying) {
    const base = p(SIDE, {
      head:{x:245,y:153}, neck:{x:222,y:162}, shoulderL:{x:199,y:168}, shoulderR:{x:202,y:176},
      elbowL:{x:224,y:197}, elbowR:{x:228,y:204}, handL:{x:249,y:217}, handR:{x:253,y:223},
      hipL:{x:130,y:177}, hipR:{x:136,y:185}, kneeL:{x:79,y:183}, kneeR:{x:85,y:191},
      ankleL:{x:35,y:190}, ankleR:{x:41,y:198}, toeL:{x:22,y:196}, toeR:{x:28,y:204},
    });
    return make('side', 'bench', 'none', 'Keep the hips pinned and curl the heels toward the glutes.', [
      f('Extend', base),
      f('Curl', p(base, { ankleL:{x:91,y:124}, ankleR:{x:98,y:130}, toeL:{x:81,y:110}, toeR:{x:88,y:116} })),
    ]);
  }
  const bent = p(SIDE, {
    head:{x:126,y:56}, neck:{x:126,y:79}, shoulderL:{x:123,y:94}, shoulderR:{x:135,y:96},
    elbowL:{x:119,y:138}, elbowR:{x:141,y:139}, handL:{x:108,y:174}, handR:{x:150,y:175},
    hipL:{x:126,y:177}, hipR:{x:142,y:178}, kneeL:{x:187,y:180}, kneeR:{x:194,y:187},
    ankleL:{x:187,y:246}, ankleR:{x:197,y:249}, toeL:{x:205,y:252}, toeR:{x:215,y:255},
  });
  const straight = p(bent, { ankleL:{x:249,y:184}, ankleR:{x:255,y:192}, toeL:{x:267,y:187}, toeR:{x:273,y:195} });
  return make('side', 'machine-seat', 'none',
    extension ? 'Align the knee with the pivot and extend smoothly.' : 'Pin the thighs and curl the pad under the seat.',
    extension ? [f('Bend', bent), f('Extend', straight)] : [f('Extend', straight), f('Curl', bent)]);
}

function calf(seated: boolean) {
  if (seated) {
    const base = seatedLeg(true).frames[0].pose;
    return make('side', 'machine-seat', 'none', 'Keep the toes planted and lift the heels fully.', [
      f('Stretch', base), f('Raise', p(base, { ankleL:{x:187,y:238}, ankleR:{x:197,y:241} })),
    ]);
  }
  return make('side', 'floor', 'none', 'Rise onto the balls of the feet, pause, then lower.', [
    f('Stretch', SIDE),
    f('Raise', p(SIDE, {
      head:{x:163,y:31}, neck:{x:158,y:54}, shoulderL:{x:154,y:69}, shoulderR:{x:166,y:72},
      elbowL:{x:151,y:116}, elbowR:{x:171,y:118}, handL:{x:151,y:161}, handR:{x:173,y:163},
      hipL:{x:153,y:151}, hipR:{x:169,y:152}, kneeL:{x:151,y:209}, kneeR:{x:173,y:211},
      ankleL:{x:149,y:263}, ankleR:{x:175,y:264},
    })),
  ]);
}

function shrug() {
  return make('front', 'floor', 'dumbbells', 'Lift the shoulders straight up—do not roll them.', [
    f('Relax', FRONT),
    f('Shrug', p(FRONT, {
      shoulderL:{x:135,y:65}, shoulderR:{x:185,y:65},
      elbowL:{x:124,y:115}, elbowR:{x:196,y:115},
      handL:{x:122,y:160}, handR:{x:198,y:160},
    })),
  ], 2300);
}

function uprightRow() {
  return make('front', 'floor', 'barbell', 'Lead with the elbows and stop around lower-chest height.', [
    f('Lower', FRONT),
    f('Pull', p(FRONT, {
      elbowL:{x:105,y:92}, elbowR:{x:215,y:92},
      handL:{x:140,y:111}, handR:{x:180,y:111},
    })),
  ]);
}

function dip(machine = false) {
  return make('front', machine ? 'machine-seat' : 'dip-bars', 'none', 'Lower under control, then press the bars away.', [
    f('Top', FRONT),
    f('Lower', p(FRONT, {
      head:{x:160,y:66}, neck:{x:160,y:89},
      shoulderL:{x:132,y:103}, shoulderR:{x:188,y:103},
      elbowL:{x:116,y:139}, elbowR:{x:204,y:139},
      handL:{x:126,y:163}, handR:{x:194,y:163},
      hipL:{x:145,y:186}, hipR:{x:175,y:186},
      kneeL:{x:143,y:238}, kneeR:{x:177,y:238},
      ankleL:{x:149,y:274}, ankleR:{x:171,y:274},
    })),
  ]);
}

function pushup() {
  const top = p(SIDE, {
    head:{x:248,y:176}, neck:{x:227,y:186},
    shoulderL:{x:205,y:194}, shoulderR:{x:211,y:200},
    elbowL:{x:218,y:236}, elbowR:{x:226,y:240},
    handL:{x:232,y:278}, handR:{x:242,y:279},
    hipL:{x:143,y:222}, hipR:{x:150,y:227},
    kneeL:{x:93,y:248}, kneeR:{x:100,y:252},
    ankleL:{x:49,y:267}, ankleR:{x:57,y:270},
    toeL:{x:38,y:280}, toeR:{x:46,y:281},
  });
  return make('side', 'floor', 'none', 'Keep the body rigid while the chest moves toward the floor.', [
    f('Top', top),
    f('Lower', p(top, {
      head:{x:250,y:222}, neck:{x:228,y:229},
      shoulderL:{x:205,y:234}, shoulderR:{x:211,y:239},
      elbowL:{x:224,y:250}, elbowR:{x:232,y:253},
      handL:{x:232,y:278}, handR:{x:242,y:279},
      hipL:{x:143,y:245}, hipR:{x:150,y:249},
      kneeL:{x:93,y:260}, kneeR:{x:100,y:263},
      ankleL:{x:49,y:271}, ankleR:{x:57,y:273},
      toeL:{x:38,y:280}, toeR:{x:46,y:281},
    })),
  ], 2400);
}

function hangingLegRaise() {
  const hang = pulldown('none', 'pullup').frames[0].pose;
  return make('front', 'pullup', 'none', 'Keep the torso quiet and curl the pelvis as the legs rise.', [
    f('Hang', hang),
    f('Raise', p(hang, {
      kneeL:{x:126,y:194}, kneeR:{x:194,y:194},
      ankleL:{x:96,y:157}, ankleR:{x:224,y:157},
      toeL:{x:83,y:151}, toeR:{x:237,y:151},
    })),
  ], 3000);
}

function cableCrunch() {
  const tall = p(SIDE, {
    ...SIDE,
    kneeL:{x:145,y:229}, kneeR:{x:169,y:231},
    ankleL:{x:131,y:269}, ankleR:{x:178,y:271},
    handL:{x:174,y:70}, handR:{x:182,y:76},
    elbowL:{x:153,y:91}, elbowR:{x:166,y:94},
  });
  return make('side', 'high-cable', 'rope', 'Round the ribs toward the pelvis without sitting the hips back.', [
    f('Tall', tall),
    f('Crunch', p(tall, {
      head:{x:202,y:111}, neck:{x:184,y:120},
      shoulderL:{x:164,y:132}, shoulderR:{x:174,y:138},
      handL:{x:188,y:110}, handR:{x:197,y:116},
      elbowL:{x:169,y:119}, elbowR:{x:180,y:124},
    })),
  ], 2700);
}

function russianTwist() {
  const seated = p(FRONT, {
    head:{x:160,y:132}, neck:{x:160,y:153},
    shoulderL:{x:134,y:166}, shoulderR:{x:186,y:166},
    elbowL:{x:138,y:196}, elbowR:{x:182,y:196},
    handL:{x:150,y:204}, handR:{x:170,y:204},
    hipL:{x:146,y:240}, hipR:{x:174,y:240},
    kneeL:{x:120,y:228}, kneeR:{x:200,y:228},
    ankleL:{x:136,y:270}, ankleR:{x:184,y:270},
    toeL:{x:146,y:280}, toeR:{x:174,y:280},
  });
  return make('front', 'floor', 'none', 'Rotate the ribcage—not just the hands—from side to side.', [
    f('Left', p(seated, { handL:{x:108,y:204}, handR:{x:128,y:206}, elbowL:{x:120,y:190}, elbowR:{x:151,y:194} })),
    f('Right', p(seated, { handL:{x:192,y:206}, handR:{x:212,y:204}, elbowL:{x:169,y:194}, elbowR:{x:200,y:190} })),
  ], 2500);
}

function rearDeltFly() {
  const base = row('dumbbells').frames[0].pose;
  return make('side', 'floor', 'dumbbells', 'Hold the hinge and sweep the arms wide without shrugging.', [
    f('Lower', base),
    f('Open', p(base, {
      elbowL:{x:151,y:101}, elbowR:{x:173,y:110},
      handL:{x:118,y:88}, handR:{x:205,y:96},
    })),
  ], 2800);
}

function rowingErgometer() {
  const catchPose = p(SIDE, {
    head:{x:198,y:101}, neck:{x:181,y:115},
    shoulderL:{x:161,y:127}, shoulderR:{x:169,y:134},
    elbowL:{x:195,y:143}, elbowR:{x:202,y:150},
    handL:{x:232,y:151}, handR:{x:239,y:157},
    hipL:{x:132,y:183}, hipR:{x:144,y:190},
    kneeL:{x:188,y:212}, kneeR:{x:198,y:219},
    ankleL:{x:221,y:246}, ankleR:{x:231,y:252},
    toeL:{x:238,y:249}, toeR:{x:248,y:255},
  });
  return make('side', 'rower', 'cable-handle', 'Drive legs first, open the hips, then pull; recover arms, hips, then knees.', [
    f('Catch', catchPose),
    f('Finish', p(SIDE, {
      head:{x:137,y:75}, neck:{x:140,y:98},
      shoulderL:{x:143,y:113}, shoulderR:{x:155,y:116},
      elbowL:{x:171,y:132}, elbowR:{x:179,y:138},
      handL:{x:157,y:150}, handR:{x:165,y:156},
      hipL:{x:132,y:183}, hipR:{x:146,y:188},
      kneeL:{x:192,y:196}, kneeR:{x:202,y:203},
      ankleL:{x:238,y:235}, ankleR:{x:248,y:242},
      toeL:{x:255,y:239}, toeR:{x:265,y:246},
    })),
  ], 2800);
}

function wristCurl() {
  const base = p(SIDE, {
    head:{x:120,y:71}, neck:{x:124,y:94}, shoulderL:{x:128,y:108}, shoulderR:{x:140,y:111},
    elbowL:{x:151,y:145}, elbowR:{x:162,y:149}, handL:{x:198,y:148}, handR:{x:208,y:153},
    hipL:{x:128,y:180}, hipR:{x:144,y:181}, kneeL:{x:188,y:183}, kneeR:{x:196,y:190},
    ankleL:{x:186,y:247}, ankleR:{x:198,y:250}, toeL:{x:204,y:254}, toeR:{x:216,y:257},
  });
  return make('side', 'machine-seat', 'dumbbells', 'Keep the forearms planted and move only at the wrists.', [
    f('Stretch', p(base, { handL:{x:201,y:158}, handR:{x:211,y:163} })),
    f('Curl', p(base, { handL:{x:198,y:139}, handR:{x:208,y:144} })),
  ], 2200);
}

function powerClean() {
  const floor = hinge('barbell').frames[1].pose;
  return make('side', 'floor', 'barbell', 'Drive with the legs and hips, then receive the bar on the shoulders.', [
    f('Floor', p(floor, { handL:{x:181,y:228}, handR:{x:192,y:231} })),
    f('Catch', p(SIDE, {
      head:{x:165,y:61}, neck:{x:160,y:84}, shoulderL:{x:155,y:98}, shoulderR:{x:168,y:101},
      elbowL:{x:194,y:111}, elbowR:{x:202,y:118}, handL:{x:168,y:94}, handR:{x:176,y:101},
      hipL:{x:145,y:174}, hipR:{x:161,y:176}, kneeL:{x:173,y:215}, kneeR:{x:188,y:218},
      ankleL:{x:151,y:270}, ankleR:{x:176,y:271},
    })),
  ], 2600);
}

function burpee() {
  const low = pushup().frames[0].pose;
  return make('side', 'floor', 'none', 'Move from a strong plank to a soft, tall jump.', [
    f('Plank', low),
    f('Jump', p(SIDE, {
      head:{x:163,y:25}, neck:{x:158,y:48},
      shoulderL:{x:154,y:63}, shoulderR:{x:166,y:66},
      elbowL:{x:139,y:29}, elbowR:{x:181,y:31},
      handL:{x:134,y:4}, handR:{x:186,y:6},
      hipL:{x:153,y:145}, hipR:{x:169,y:146},
      kneeL:{x:151,y:203}, kneeR:{x:173,y:205},
      ankleL:{x:149,y:257}, ankleR:{x:175,y:258},
      toeL:{x:166,y:265}, toeR:{x:192,y:266},
    })),
  ], 3300);
}

function abWheel() {
  const kneel = p(SIDE, {
    head:{x:186,y:162}, neck:{x:168,y:175},
    shoulderL:{x:149,y:186}, shoulderR:{x:157,y:192},
    elbowL:{x:171,y:228}, elbowR:{x:179,y:232},
    handL:{x:192,y:269}, handR:{x:201,y:270},
    hipL:{x:106,y:219}, hipR:{x:114,y:224},
    kneeL:{x:86,y:274}, kneeR:{x:95,y:276},
    ankleL:{x:61,y:262}, ankleR:{x:70,y:265},
    toeL:{x:48,y:279}, toeR:{x:57,y:280},
  });
  const rollout = p(kneel, {
    head:{x:246,y:214}, neck:{x:226,y:221},
    shoulderL:{x:205,y:226}, shoulderR:{x:212,y:231},
    elbowL:{x:231,y:248}, elbowR:{x:238,y:251},
    handL:{x:256,y:269}, handR:{x:264,y:270},
    hipL:{x:142,y:247}, hipR:{x:149,y:251},
  });
  return make('side', 'floor', 'ab-wheel', 'Roll only as far as you can keep the ribs tucked and low back controlled.', [
    f('Kneel', kneel),
    f('Roll out', rollout),
  ], 3200);
}

const propFor = (equipment: Equipment): PropKind =>
  equipment === 'dumbbell' ? 'dumbbells' :
  equipment === 'barbell' ? 'barbell' :
  equipment === 'kettlebell' ? 'kettlebell' :
  equipment === 'cable' ? 'cable-handle' : 'none';

export function getMotionProfile(id: string, demo: DemoKind, equipment: Equipment): MotionProfile {
  switch (id) {
    case 'bench-press': case 'close-grip-bench': return bench('barbell');
    case 'incline-bench-press': return bench('barbell', 'incline-bench');
    case 'decline-bench-press': return bench('barbell', 'decline-bench');
    case 'db-bench-press': return bench('dumbbells');
    case 'incline-db-press': return bench('dumbbells', 'incline-bench');
    case 'chest-press-machine': return seatedPress('none', false);
    case 'db-fly': return fly('dumbbells', 'bench');
    case 'cable-fly': return fly('cable-handle', 'cable');
    case 'pec-deck': return fly('none', 'machine-seat');
    case 'overhead-press': return press('barbell');
    case 'db-shoulder-press': return seatedPress('dumbbells', true);
    case 'shoulder-press': return seatedPress('none', true);
    case 'arnold-press': return seatedPress('dumbbells', true);
    case 'lateral-raise': return lateral('dumbbells');
    case 'cable-lateral-raise': return cableLateral();
    case 'shrug': return shrug();
    case 'upright-row': return uprightRow();
    case 'barbell-row': case 'pendlay-row': case 't-bar-row': return row('barbell');
    case 'db-row': return row('dumbbells', 'bench');
    case 'rear-delt-fly': return rearDeltFly();
    case 'seated-cable-row': case 'close-grip-row': case 'upper-back-row': return row('cable-handle', 'cable');
    case 'machine-row': return row('none', 'machine-seat');
    case 'lat-pulldown': return latPulldown();
    case 'straight-arm-pulldown': return pulldown('cable-handle');
    case 'face-pull': return pulldown('rope');
    case 'pull-up': case 'chin-up': return pulldown('none', 'pullup');
    case 'deadlift': case 'romanian-deadlift': case 'good-morning': return hinge('barbell');
    case 'power-clean': return powerClean();
    case 'back-extension': return { ...hinge('none'), scene:'roman-chair' };
    case 'barbell-curl': case 'reverse-curl': return curl('barbell');
    case 'wrist-curl': return wristCurl();
    case 'db-curl': case 'hammer-curl': return curl('dumbbells');
    case 'incline-db-curl': return curl('dumbbells', 'incline-bench');
    case 'preacher-curl': return curl('ez-bar', 'preacher');
    case 'cable-curl': case 'recline-curl': return curl('cable-handle', 'cable');
    case 'tricep-pushdown': return pushdown('rope');
    case 'single-arm-cuff-tricep-extension': return pushdown('cable-handle');
    case 'overhead-tricep-extension': return press('rope', 'high-cable');
    case 'skull-crusher': return bench('ez-bar');
    case 'dips': return dip(false);
    case 'tricep-dip-machine': return dip(true);
    case 'squat': case 'front-squat': return squat('barbell');
    case 'goblet-squat': return squat('dumbbells');
    case 'leg-press': return legPress();
    case 'hack-squat': return squat('none', 'machine-seat');
    case 'bulgarian-split-squat': case 'lunge': return lunge();
    case 'leg-extension': return seatedLeg(true);
    case 'seated-leg-curl': return seatedLeg(false);
    case 'lying-leg-curl': return seatedLeg(false, true);
    case 'standing-calf-raise': return calf(false);
    case 'seated-calf-raise': return calf(true);
    case 'plank': return plank();
    case 'ab-wheel': return abWheel();
    case 'push-up': return pushup();
    case 'burpee': return burpee();
    case 'hanging-leg-raise': return hangingLegRaise();
    case 'cable-crunch': return cableCrunch();
    case 'russian-twist': return russianTwist();
    case 'hip-thrust': {
      const lower = p(SIDE, {
        head:{x:74,y:164}, neck:{x:92,y:172}, shoulderL:{x:108,y:178}, shoulderR:{x:114,y:183},
        elbowL:{x:132,y:204}, elbowR:{x:138,y:209}, handL:{x:156,y:224}, handR:{x:162,y:229},
        hipL:{x:158,y:228}, hipR:{x:165,y:233}, kneeL:{x:206,y:212}, kneeR:{x:214,y:218},
        ankleL:{x:212,y:270}, ankleR:{x:220,y:273}, toeL:{x:232,y:280}, toeR:{x:240,y:281},
      });
      return make('side', 'bench', 'barbell', 'Drive through the heels and finish with ribs down.', [
        f('Lower', lower),
        f('Bridge', p(lower, {
          head:{x:72,y:162}, neck:{x:91,y:168},
          elbowL:{x:134,y:184}, elbowR:{x:140,y:189}, handL:{x:162,y:184}, handR:{x:168,y:189},
          hipL:{x:162,y:184}, hipR:{x:169,y:189}, kneeL:{x:210,y:188}, kneeR:{x:218,y:193},
        })),
      ]);
    }
    case 'glute-bridge': {
      const lower = p(SIDE, {
        head:{x:74,y:261}, neck:{x:95,y:265}, shoulderL:{x:114,y:268}, shoulderR:{x:120,y:272},
        elbowL:{x:140,y:275}, elbowR:{x:146,y:278}, handL:{x:166,y:278}, handR:{x:172,y:280},
        hipL:{x:172,y:270}, hipR:{x:178,y:274}, kneeL:{x:212,y:222}, kneeR:{x:220,y:227},
        ankleL:{x:224,y:270}, ankleR:{x:232,y:273}, toeL:{x:243,y:280}, toeR:{x:251,y:281},
      });
      return make('side', 'floor', 'none', 'Drive through the heels and finish with ribs down.', [
        f('Lower', lower),
        f('Bridge', p(lower, {
          hipL:{x:166,y:230}, hipR:{x:173,y:235},
          kneeL:{x:212,y:216}, kneeR:{x:220,y:221},
        })),
      ]);
    }
    case 'cable-kickback': return make('side', 'cable', 'cable-handle', 'Keep the pelvis square and extend from the hip.', [
      f('Start', SIDE), f('Kick', p(SIDE, { kneeR:{x:112,y:215}, ankleR:{x:67,y:229}, toeR:{x:50,y:232} })),
    ]);
    case 'hip-abduction': return make('front', 'machine-seat', 'none', 'Open the knees without rocking the torso.', [
      f('Close', FRONT), f('Open', p(FRONT, {
        kneeL:{x:113,y:216}, kneeR:{x:207,y:216}, ankleL:{x:103,y:270}, ankleR:{x:217,y:270},
        toeL:{x:91,y:280}, toeR:{x:229,y:280},
      })),
    ]);
    case 'farmers-walk': return make('front', 'floor', 'dumbbells', 'Walk tall with the load quiet at your sides.', [
      f('Left', p(FRONT, { kneeL:{x:153,y:214}, ankleL:{x:164,y:265} })),
      f('Right', p(FRONT, { kneeR:{x:167,y:214}, ankleR:{x:156,y:265} })),
    ], 1800);
    case 'kb-swing': return make('side', 'floor', 'kettlebell', 'Snap the hips; let the arms guide the bell.', [
      f('Hike', p(hinge('kettlebell').frames[1].pose, { handL:{x:138,y:206}, handR:{x:146,y:211} })),
      f('Float', p(SIDE, { elbowL:{x:194,y:93}, elbowR:{x:199,y:100}, handL:{x:231,y:99}, handR:{x:236,y:106} })),
    ]);
    case 'rowing-machine': return rowingErgometer();
    case 'stationary-bike': return make('side', 'bike', 'none', 'Keep the hips steady and pedal smoothly.', [
      f('Drive', p(SIDE, { kneeL:{x:194,y:211}, ankleL:{x:211,y:244} })),
      f('Recover', p(SIDE, { kneeL:{x:143,y:192}, ankleL:{x:174,y:237} })),
    ], 1600);
    case 'treadmill': case 'jump-rope': return make('side', id === 'treadmill' ? 'treadmill' : 'floor', 'none', id === 'jump-rope' ? 'Bounce softly from the ankles.' : 'Land with the foot under the body.', [
      f('Left', p(SIDE, { kneeL:{x:186,y:210}, ankleL:{x:205,y:253}, kneeR:{x:137,y:218}, ankleR:{x:114,y:257} })),
      f('Right', p(SIDE, { kneeL:{x:137,y:218}, ankleL:{x:114,y:257}, kneeR:{x:186,y:210}, ankleR:{x:205,y:253} })),
    ], 1500);
  }

  const prop = propFor(equipment);
  if (demo === 'lateralRaise') return lateral(prop);
  if (demo === 'overheadPress') return press(prop);
  if (demo === 'benchPress' || demo === 'fly') return bench(prop);
  if (demo === 'row') return row(prop);
  if (demo === 'pulldown' || demo === 'pullup') return pulldown(prop);
  if (demo === 'deadlift' || demo === 'swing') return hinge(prop);
  if (demo === 'curl' || demo === 'hammerCurl') return curl(prop);
  if (demo === 'pushdown' || demo === 'skullCrusher') return pushdown(prop);
  if (demo === 'squat') return squat(prop);
  if (demo === 'lunge') return lunge();
  if (demo === 'legExtension') return seatedLeg(true);
  if (demo === 'legCurl') return seatedLeg(false);
  if (demo === 'calfRaise') return calf(false);
  if (demo === 'plank' || demo === 'pushup') return plank();
  return make('front', 'floor', prop, 'Move with control through a comfortable range.', [f('Start', FRONT)]);
}

export function interpolatePose(a: FigurePose, b: FigurePose, t: number): FigurePose {
  const out = {} as FigurePose;
  for (const key of Object.keys(a) as (keyof FigurePose)[]) {
    out[key] = { x:a[key].x + (b[key].x-a[key].x)*t, y:a[key].y + (b[key].y-a[key].y)*t };
  }
  return out;
}
