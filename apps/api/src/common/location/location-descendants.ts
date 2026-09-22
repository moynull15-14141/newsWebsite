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
 * family (assuming the given roots aren't themselves ancestor/descendant of each other).
 */
export async function loadLocationFamilies(prisma: LocationReader, rootIds: string[]): Promise<Map<string, string[]>> {
  const families = new Map<string, string[]>(rootIds.map((id) => [id, [id]]));
  if (!rootIds.length) return families;

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
