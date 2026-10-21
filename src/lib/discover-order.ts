/** Keep already displayed profiles in place and append each new profile once. */
export function appendDiscoverMembers<T extends { id: string }>(existing: T[], incoming: T[]): T[] {
  const seen = new Set(existing.map(member => member.id));
  const additions = incoming.filter(member => {
    if (seen.has(member.id)) return false;
    seen.add(member.id);
    return true;
  });
  return [...existing, ...additions];
}

/** A shuffle is a snapshot, not a new reshuffle whenever another page arrives. */
export function orderDiscoverMembers<T extends { id: string }>(members: T[], shuffledIds: string[] | null): T[] {
  if (!shuffledIds) return members;
  const byId = new Map(members.map(member => [member.id, member]));
  const ordered: T[] = [];
  for (const id of shuffledIds) {
    const member = byId.get(id);
    if (member) {
      ordered.push(member);
      byId.delete(id);
    }
  }
  return [...ordered, ...byId.values()];
}