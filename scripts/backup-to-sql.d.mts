// Types for scripts/backup-to-sql.mjs, so TypeScript code (the tests) can import it checked.
export interface Item {
  id: number;
  name: string;
  manualPage: number;
  group: string;
}
export const BEFORE_OPTIONS: string[];
export const DELETE_REASONS: string[];
export function v1ObservationUid(o: {
  patientId: string;
  itemId: number;
  at: number;
  loggedAt: number;
  id?: number;
}): string;
export function itemsFromSource(source: string): Item[];
export function backupToSql(
  text: string,
  options: { items: readonly Item[]; fileName?: string; importedAt?: number; importedBy?: string },
): { sql: string; counts: Record<string, number>; skipped: Record<string, number>; batchId: string };
export function scoresCsvToSql(text: string, computedAtMs: number): { sql: string; rows: number };
