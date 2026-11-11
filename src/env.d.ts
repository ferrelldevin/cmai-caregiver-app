declare const __APP_VERSION__: string;
declare const __BUILD_COMMIT__: string;

interface ImportMetaEnv {
  // "lab" turns on features built on assumed approval (src/study/settings.ts). Unset means caregiver.
  readonly VITE_STUDY_MODE?: string;
}
