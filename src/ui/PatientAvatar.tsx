// A colored badge per patient, so the patient being logged for is recognizable at a
// glance (the same job a photo does in a hospital record's patient banner). The color
// comes from the code itself, so it is the same on every screen and every phone. The
// five colors are Paul Tol's "muted" set, chosen to stay apart for color-blind readers;
// the code is always shown, so color only backs it up (design note 008). Colors and text
// colors live in styles.css as --res-* tokens, with lighter tints in dark mode.

export const RESIDENT_COLORS = 5;

/** Which of the five resident colors a code gets (0-4). */
export function residentColor(id: string) {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h % RESIDENT_COLORS;
}

/** The last part of the code: "P-DEMO-A" shows "A", "P-07" shows "07". */
const initials = (id: string) => (id.split("-").filter(Boolean).pop() ?? id).slice(-3).toUpperCase();

export function PatientAvatar({ id, size = 40 }: { id: string; size?: number }) {
  return (
    <span
      className="avatar"
      data-res={residentColor(id)}
      aria-hidden="true"
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {initials(id)}
    </span>
  );
}
