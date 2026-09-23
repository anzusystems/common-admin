/**
 * Pretty-prints a JSON string, and hands back whatever it was given when that is not what it is.
 * Log context carries request and response bodies that are usually but not always JSON.
 */
export const formatJson = (data: string): string => {
  try {
    return JSON.stringify(JSON.parse(data), null, 2)
  } catch {
    return data
  }
}
