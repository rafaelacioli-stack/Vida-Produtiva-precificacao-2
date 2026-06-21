export function canReplaceBusinesses(role: string, existing: unknown, incoming: unknown) {
  if (role === "admin") return true;
  if (!Array.isArray(existing) || !Array.isArray(incoming)) return false;
  const incomingIds = new Set(incoming.map((item: any) => item?.id).filter(Boolean));
  return existing.every((item: any) => !item?.id || incomingIds.has(item.id));
}
