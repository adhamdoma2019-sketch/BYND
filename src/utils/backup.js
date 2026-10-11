// Turns a backup into the text saved in the file. Dates from Firestore become
// readable text (2026-10-10T08:30:00.000Z) instead of {seconds, nanoseconds}.
export function backupToJson(backup) {
  return JSON.stringify(
    backup,
    (key, value) =>
      value && typeof value === 'object' && 'seconds' in value && 'nanoseconds' in value
        ? new Date(value.seconds * 1000).toISOString()
        : value,
    2
  );
}
