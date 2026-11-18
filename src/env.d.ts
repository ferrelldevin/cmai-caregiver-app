declare const __APP_VERSION__: string;
declare const __BUILD_COMMIT__: string;
/** The lab server origin built into this version, or "" for none (always "" in the caregiver build). */
declare const __SYNC_ORIGIN__: string;

interface ImportMetaEnv {
  // "lab" turns on features built on assumed approval (src/study/settings.ts). Unset means caregiver.
  readonly VITE_STUDY_MODE?: string;
  // The one lab server the lab build may send to, such as https://tower-desk.tail25672a.ts.net:8787 (F-62).
  // Read at build time by vite.config.ts; the caregiver build ignores it.
  readonly VITE_SYNC_ORIGIN?: string;
}
