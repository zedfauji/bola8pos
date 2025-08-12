// Utility to resolve backend numeric table ID from UI ID using localStorage mapping
export function resolveBackendTableId(uiId) {
  try {
    const raw = localStorage.getItem('pos_table_map');
    if (!raw) return null;
    const map = JSON.parse(raw);
    const n = map?.[uiId];
    if (typeof n === 'number' && Number.isFinite(n)) return n;
    return null;
  } catch {
    return null;
  }
}
