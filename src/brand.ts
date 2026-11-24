/*
 * The app's name and wording, from brand.json at the project root. To rename the app, edit that
 * file only: the app, the browser tab, the install manifest and the server all read it.
 * (Internal ids such as storage keys and the local database name stay as they are, so renaming
 * never logs anyone out or loses data on their device.)
 */
import brand from '../brand.json';

/** "Spotter" */
export const APP_NAME: string = brand.name;
/** "Workout Log" */
export const APP_TAGLINE: string = brand.tagline;
/** One-sentence description (install manifest, search results). */
export const APP_DESCRIPTION: string = brand.description;
/** Lower-case name for downloaded files, e.g. spotter-backup-2026-11-24.json */
export const APP_FILE_SLUG: string = brand.fileSlug;
