let seq = 0

/**
 * Unique negative temp id for new (unsaved) list rows.
 *
 * Row keys must be unique per row — duplicate or missing keys break dirty
 * tracking, validation rails and reorder targeting. A single module-wide
 * negative sequence guarantees uniqueness across all factories (two domain
 * factories can no longer both hand out `-1`), and can never collide with
 * persisted ids, which are positive. The backend assigns real ids on save.
 */
export const nextListEditorTempId = (): number => --seq
