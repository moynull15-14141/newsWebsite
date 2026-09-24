/**
 * Best-effort "don't show the same campaign twice on one page" tracking (spec: "avoid duplicate ads in
 * the same request where practical"). Deliberately module-level state, not a React context — every
 * AdSlot on the page reads/writes the same set regardless of where it sits in the tree, and MainLayout
 * resets it once per navigation (see its useEffect on location.pathname). This is inherently best-effort:
 * AdSlots that mount in the same render pass fire their eligibility fetches before any of them resolves,
 * so two slots can still race to the same campaign — full correctness would need a single shared fetch
 * queue, which is more machinery than "where practical" calls for.
 */
let shown = new Set<string>();

export function markAdShown(campaignId: string) {
  shown.add(campaignId);
}

export function getShownAdIds(): string[] {
  return [...shown];
}

export function resetShownAds() {
  shown = new Set();
}
