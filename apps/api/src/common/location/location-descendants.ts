import { PrismaClient } from '@prisma/client';

type LocationReader = Pick<PrismaClient, 'location'>;

/**
 * "Bangladesh" (COUNTRY) → division → district → upazila can be up to 4 levels deep. A location page or
 * a homepage LOCATION section must include articles tagged anywhere in that subtree — not just the
 * requested location's own id, and not just its *direct* children (a one-level fetch was the actual bug:
 * it made COUNTRY-level pages, like /bangladesh, invisible to every district-tagged article, which is
 * most real content). This walks the tree breadth-first, one query per depth level (bounded by the
 * hierarchy's actual depth, not the row count), and returns every requested root id plus all of its
 * descendants.
 */
export async function loadLocationDescendants(prisma: LocationReader, rootIds: string[]): Promise<string[]> {
  const all = new Set(rootIds);
  let frontier = [...rootIds];
  while (frontier.length) {
    const children = await prisma.location.findMany({
      where: { parentId: { in: frontier } },
      select: { id: true },
    });
    frontier = children.map((c) => c.id).filter((id) => !all.has(id));
    for (const id of frontier) all.add(id);
  }
  return [...all];
}

/**
 * Same traversal, but keeps each root's own subtree separate — for callers (the homepage LOCATION
 * source) that need "this specific section's location and everything under it" rather than one
 * combined list. A location has exactly one parent, so a descendant belongs to exactly one root's
 * family — including when one requested root is itself nested inside another requested root's subtree
 * (e.g. a country-wide section and a division-level section configured at the same time): each root
 * keeps its own family regardless of ancestry between the roots. Without the `rootIdSet` guard below,
 * the nested root would get relabeled as the outer root's child on the very same BFS pass its own real
 * children are fetched in, silently stealing its whole subtree into the outer root's family and leaving
 * the nested root's own section with nothing but itself (seen in production: a homepage section scoped
 * to a division came back with zero articles because every district under it had been reassigned to a
 * sibling country-wide section that happened to be configured at the same time).
 */
export async function loadLocationFamilies(prisma: LocationReader, rootIds: string[]): Promise<Map<string, string[]>> {
  const families = new Map<string, string[]>(rootIds.map((id) => [id, [id]]));
  if (!rootIds.length) return families;

  const rootIdSet = new Set(rootIds);
  // Which root a location id currently belongs to, so a grandchild is attributed to the right family.
  const owner = new Map<string, string>(rootIds.map((id) => [id, id]));
  let frontier = [...rootIds];

  while (frontier.length) {
    const children = await prisma.location.findMany({
      where: { parentId: { in: frontier } },
      select: { id: true, parentId: true },
    });
    const nextFrontier: string[] = [];
    for (const child of children) {
      // Already one of the requested roots — keeps owning its own subtree no matter which other root's
      // children this same query batch also happened to fetch it as.
      if (rootIdSet.has(child.id)) continue;
      const rootId = child.parentId ? owner.get(child.parentId) : undefined;
      if (!rootId) continue;
      families.get(rootId)?.push(child.id);
      owner.set(child.id, rootId);
      nextFrontier.push(child.id);
    }
    frontier = nextFrontier;
  }
  return families;
}
