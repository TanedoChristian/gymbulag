import type { Equipment, Exercise, MuscleGroup } from '../types';

type Seed = [id: string, name: string, muscle: MuscleGroup, equipment: Equipment];

const SEEDS: Seed[] = [
  // Chest
  ['bench-press', 'Bench Press', 'chest', 'barbell'],
  ['incline-bench-press', 'Incline Bench Press', 'chest', 'barbell'],
  ['decline-bench-press', 'Decline Bench Press', 'chest', 'barbell'],
  ['db-bench-press', 'Dumbbell Bench Press', 'chest', 'dumbbell'],
  ['incline-db-press', 'Incline Dumbbell Press', 'chest', 'dumbbell'],
  ['db-fly', 'Dumbbell Fly', 'chest', 'dumbbell'],
  ['cable-fly', 'Cable Fly', 'chest', 'cable'],
  ['chest-press-machine', 'Chest Press (Machine)', 'chest', 'machine'],
  ['pec-deck', 'Pec Deck', 'chest', 'machine'],
  ['push-up', 'Push-up', 'chest', 'bodyweight'],
  ['dips', 'Dips', 'chest', 'bodyweight'],
  // Back
  ['deadlift', 'Deadlift', 'back', 'barbell'],
  ['barbell-row', 'Barbell Row', 'back', 'barbell'],
  ['pendlay-row', 'Pendlay Row', 'back', 'barbell'],
  ['db-row', 'Dumbbell Row', 'back', 'dumbbell'],
  ['pull-up', 'Pull-up', 'back', 'bodyweight'],
  ['chin-up', 'Chin-up', 'back', 'bodyweight'],
  ['lat-pulldown', 'Lat Pulldown', 'back', 'cable'],
  ['seated-cable-row', 'Seated Cable Row', 'back', 'cable'],
  ['t-bar-row', 'T-Bar Row', 'back', 'barbell'],
  ['machine-row', 'Machine Row', 'back', 'machine'],
  ['straight-arm-pulldown', 'Straight-arm Pulldown', 'back', 'cable'],
  ['back-extension', 'Back Extension', 'back', 'bodyweight'],
  // Shoulders
  ['overhead-press', 'Overhead Press', 'shoulders', 'barbell'],
  ['db-shoulder-press', 'Dumbbell Shoulder Press', 'shoulders', 'dumbbell'],
  ['arnold-press', 'Arnold Press', 'shoulders', 'dumbbell'],
  ['lateral-raise', 'Lateral Raise', 'shoulders', 'dumbbell'],
  ['cable-lateral-raise', 'Cable Lateral Raise', 'shoulders', 'cable'],
  ['rear-delt-fly', 'Rear Delt Fly', 'shoulders', 'dumbbell'],
  ['face-pull', 'Face Pull', 'shoulders', 'cable'],
  ['shrug', 'Shrug', 'shoulders', 'dumbbell'],
  ['upright-row', 'Upright Row', 'shoulders', 'barbell'],
  // Biceps
  ['barbell-curl', 'Barbell Curl', 'biceps', 'barbell'],
  ['db-curl', 'Dumbbell Curl', 'biceps', 'dumbbell'],
  ['hammer-curl', 'Hammer Curl', 'biceps', 'dumbbell'],
  ['preacher-curl', 'Preacher Curl', 'biceps', 'machine'],
  ['incline-db-curl', 'Incline Dumbbell Curl', 'biceps', 'dumbbell'],
  ['cable-curl', 'Cable Curl', 'biceps', 'cable'],
  // Triceps
  ['close-grip-bench', 'Close-grip Bench Press', 'triceps', 'barbell'],
  ['tricep-pushdown', 'Tricep Pushdown', 'triceps', 'cable'],
  ['overhead-tricep-extension', 'Overhead Tricep Extension', 'triceps', 'cable'],
  ['skull-crusher', 'Skull Crusher', 'triceps', 'barbell'],
  ['tricep-dip-machine', 'Tricep Dip (Machine)', 'triceps', 'machine'],
  // Forearms
  ['wrist-curl', 'Wrist Curl', 'forearms', 'dumbbell'],
  ['farmers-walk', "Farmer's Walk", 'forearms', 'dumbbell'],
  // Core
  ['plank', 'Plank', 'core', 'bodyweight'],
  ['hanging-leg-raise', 'Hanging Leg Raise', 'core', 'bodyweight'],
  ['cable-crunch', 'Cable Crunch', 'core', 'cable'],
  ['ab-wheel', 'Ab Wheel Rollout', 'core', 'other'],
  ['russian-twist', 'Russian Twist', 'core', 'bodyweight'],
  // Quads
  ['squat', 'Back Squat', 'quads', 'barbell'],
  ['front-squat', 'Front Squat', 'quads', 'barbell'],
  ['leg-press', 'Leg Press', 'quads', 'machine'],
  ['hack-squat', 'Hack Squat', 'quads', 'machine'],
  ['leg-extension', 'Leg Extension', 'quads', 'machine'],
  ['bulgarian-split-squat', 'Bulgarian Split Squat', 'quads', 'dumbbell'],
  ['lunge', 'Walking Lunge', 'quads', 'dumbbell'],
  ['goblet-squat', 'Goblet Squat', 'quads', 'dumbbell'],
  // Hamstrings
  ['romanian-deadlift', 'Romanian Deadlift', 'hamstrings', 'barbell'],
  ['lying-leg-curl', 'Lying Leg Curl', 'hamstrings', 'machine'],
  ['seated-leg-curl', 'Seated Leg Curl', 'hamstrings', 'machine'],
  ['good-morning', 'Good Morning', 'hamstrings', 'barbell'],
  // Glutes
  ['hip-thrust', 'Hip Thrust', 'glutes', 'barbell'],
  ['glute-bridge', 'Glute Bridge', 'glutes', 'bodyweight'],
  ['cable-kickback', 'Cable Kickback', 'glutes', 'cable'],
  ['hip-abduction', 'Hip Abduction (Machine)', 'glutes', 'machine'],
  // Calves
  ['standing-calf-raise', 'Standing Calf Raise', 'calves', 'machine'],
  ['seated-calf-raise', 'Seated Calf Raise', 'calves', 'machine'],
  // Full body
  ['power-clean', 'Power Clean', 'full body', 'barbell'],
  ['kb-swing', 'Kettlebell Swing', 'full body', 'kettlebell'],
  ['burpee', 'Burpee', 'full body', 'bodyweight'],
  // Added for the Upper A / Lower B templates
  ['shoulder-press', 'Shoulder Press', 'shoulders', 'machine'],
  ['close-grip-row', 'Close-grip Row', 'back', 'cable'],
  ['upper-back-row', 'Upper Back Row', 'back', 'cable'],
  ['single-arm-cuff-tricep-extension', 'Single-arm Cuff Tricep Extension', 'triceps', 'cable'],
  ['recline-curl', 'Recline Curl', 'biceps', 'cable'],
  ['reverse-curl', 'Reverse Curl', 'forearms', 'barbell'],
  // Cardio
  ['treadmill', 'Treadmill', 'cardio', 'machine'],
  ['rowing-machine', 'Rowing Machine', 'cardio', 'machine'],
  ['stationary-bike', 'Stationary Bike', 'cardio', 'machine'],
  ['jump-rope', 'Jump Rope', 'cardio', 'other'],
];

export const DEFAULT_EXERCISES: Exercise[] = SEEDS.map(([id, name, muscle, equipment]) => ({
  id,
  name,
  muscle,
  equipment,
  custom: false,
  archived: false,
}));
