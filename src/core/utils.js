/**
 * Generate a short unique id with an optional prefix.
 */
export function uid(prefix = "id") {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36).slice(-3)}`;
}

export function deepClone(value) {
  if (value === null || value === undefined) return value;
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

export function isObject(v) {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}
