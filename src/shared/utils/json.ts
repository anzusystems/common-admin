/**
 * Pretty-prints a JSON string, or returns the input unchanged if it is not JSON.
 * Log context carries request and response bodies that are usually but not always JSON.
 */
export const formatJson = (data: string): string => {
  try {
    return JSON.stringify(JSON.parse(data), null, 2)
  } catch {
    return data
  }
}
