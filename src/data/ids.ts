// IDs that stay unique when records from several phones are put together (database version 4).
// crypto.randomUUID needs a secure context: the app is always served over HTTPS or from localhost.
export const newId = (): string => crypto.randomUUID();

/** Minutes from UTC on this phone at `at`, as a clock reads it: New York in winter is -300 (D-22). */
export const utcOffsetMin = (at: number): number => {
  const offset = -new Date(at).getTimezoneOffset();
  return offset === 0 ? 0 : offset; // never -0, which JSON would write as 0 anyway
};
