const PRESETS_STORAGE_KEY = 'wpe-user-presets';

/** Named parameter sets from localStorage. Never throws: a corrupt or
 *  unavailable store just reads as empty rather than breaking the panel. */
export function loadPresets() {
  try {
    const stored = localStorage.getItem(PRESETS_STORAGE_KEY);
    const parsed = stored ? JSON.parse(stored) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function persistPresets(presets) {
  try {
    localStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(presets));
  } catch (error) {
    console.error('Could not save presets:', error);
  }
}

/** Adds, or replaces the entry of the same name. Returns a new list. */
export function upsertPreset(presets, name, params) {
  const entry = { name, params: structuredClone(params) };
  const existing = presets.findIndex((preset) => preset.name === name);

  if (existing < 0) return [...presets, entry];

  const next = [...presets];
  next[existing] = entry;
  return next;
}

export function removePreset(presets, name) {
  return presets.filter((preset) => preset.name !== name);
}

export function findPreset(presets, name) {
  return presets.find((preset) => preset.name === name) ?? null;
}
