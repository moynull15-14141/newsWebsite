/**
 * Ready-made multi-image collage layouts (2–4 images each). Framework-free so both the editor's
 * NodeView and the read-only renderer can share the exact same grid definitions — mirrored byte-for-byte
 * in apps/web/src/lib/image-gallery.ts (no shared package between the two apps; see other mirrored
 * files like breaking-news.ts for the same pattern), so what an editor picks here is exactly what
 * readers see.
 *
 * `itemClasses[i]` is the Tailwind class string for the i-th selected image, in selection order — the
 * "featured" (bigger) image in an asymmetric layout is always whichever one the editor picked first
 * (or last, for the *_RIGHT layouts), not a separately-configurable position, to keep the picker simple.
 */
export interface GalleryLayout {
  key: string;
  label: string;
  imageCount: 2 | 3 | 4;
  /** Short description of the arrangement, shown under the layout's name in the picker. */
  description: string;
  containerClass: string;
  itemClasses: string[];
}

export const GALLERY_LAYOUTS: GalleryLayout[] = [
  {
    key: 'TWO_EQUAL',
    label: 'Two, equal',
    imageCount: 2,
    description: 'Side by side, same size.',
    containerClass: 'grid grid-cols-2 gap-2',
    itemClasses: ['aspect-square', 'aspect-square'],
  },
  {
    key: 'TWO_FEATURED',
    label: 'Two, one featured',
    imageCount: 2,
    description: 'First image larger, second smaller beside it.',
    containerClass: 'grid grid-cols-3 gap-2',
    itemClasses: ['col-span-2 aspect-[4/3]', 'col-span-1 aspect-[4/3]'],
  },
  {
    key: 'THREE_EQUAL',
    label: 'Three, equal',
    imageCount: 3,
    description: 'Three columns, same size.',
    containerClass: 'grid grid-cols-3 gap-2',
    itemClasses: ['aspect-square', 'aspect-square', 'aspect-square'],
  },
  {
    key: 'THREE_FEATURED_LEFT',
    label: 'Three, big left',
    imageCount: 3,
    description: 'First image tall on the left; other two stacked on the right.',
    containerClass: 'grid grid-cols-2 grid-rows-2 gap-2',
    itemClasses: ['col-start-1 row-span-2 aspect-auto h-full', 'col-start-2 row-start-1 aspect-video', 'col-start-2 row-start-2 aspect-video'],
  },
  {
    key: 'THREE_FEATURED_RIGHT',
    label: 'Three, big right',
    imageCount: 3,
    description: 'Last image tall on the right; other two stacked on the left.',
    containerClass: 'grid grid-cols-2 grid-rows-2 gap-2',
    itemClasses: ['col-start-1 row-start-1 aspect-video', 'col-start-1 row-start-2 aspect-video', 'col-start-2 row-span-2 aspect-auto h-full'],
  },
  {
    key: 'FOUR_EQUAL',
    label: 'Four, grid',
    imageCount: 4,
    description: '2×2 grid, same size.',
    containerClass: 'grid grid-cols-2 grid-rows-2 gap-2',
    itemClasses: ['aspect-square', 'aspect-square', 'aspect-square', 'aspect-square'],
  },
  {
    key: 'FOUR_FEATURED',
    label: 'Four, one featured',
    imageCount: 4,
    description: 'First image tall on the left; other three stacked on the right.',
    containerClass: 'grid grid-cols-2 grid-rows-3 gap-2',
    itemClasses: [
      'col-start-1 row-span-3 aspect-auto h-full',
      'col-start-2 row-start-1 aspect-[16/9]',
      'col-start-2 row-start-2 aspect-[16/9]',
      'col-start-2 row-start-3 aspect-[16/9]',
    ],
  },
  {
    key: 'FOUR_STRIP',
    label: 'Four, strip',
    imageCount: 4,
    description: 'One row of four, same size.',
    containerClass: 'grid grid-cols-4 gap-2',
    itemClasses: ['aspect-square', 'aspect-square', 'aspect-square', 'aspect-square'],
  },
];

export function getGalleryLayout(key: string): GalleryLayout | undefined {
  return GALLERY_LAYOUTS.find((l) => l.key === key);
}

export function layoutsForCount(count: number): GalleryLayout[] {
  return GALLERY_LAYOUTS.filter((l) => l.imageCount === count);
}
