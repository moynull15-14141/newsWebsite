import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react';
import { Trash2 } from 'lucide-react';
import { getGalleryLayout, layoutsForCount } from '../lib/image-gallery';

interface GalleryImage {
  src: string;
  alt?: string;
}

/**
 * Renders the collage using the exact same layout metadata as the public renderer (see
 * apps/web/src/components/TiptapRenderer.tsx's imageGallery case) — same containerClass/itemClasses from
 * lib/image-gallery.ts on both sides, so what's arranged here is what readers actually see. The layout
 * dropdown only offers templates matching this gallery's own image count, since a 3-image layout can't
 * render a 4-image gallery and vice versa.
 */
export default function ImageGalleryNodeView({ node, selected, deleteNode, updateAttributes }: NodeViewProps) {
  const images = (node.attrs.images ?? []) as GalleryImage[];
  const layoutKey = node.attrs.layout as string;
  const layout = getGalleryLayout(layoutKey);
  const options = layoutsForCount(images.length);

  return (
    <NodeViewWrapper className={`group relative my-4 rounded ${selected ? 'ring-2 ring-primary-500' : ''}`}>
      {layout ? (
        <div className={layout.containerClass}>
          {images.map((img, i) => (
            <img
              key={i}
              src={img.src}
              alt={img.alt || ''}
              draggable={false}
              className={`w-full rounded object-cover ${layout.itemClasses[i] ?? 'aspect-square'}`}
            />
          ))}
        </div>
      ) : (
        <p className="rounded border border-dashed border-gray-300 p-4 text-center text-sm text-gray-500">Unknown gallery layout</p>
      )}

      <div className="absolute right-2 top-2 flex items-center gap-1 rounded-md bg-black/60 p-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
        {options.length > 1 && (
          <select
            aria-label="Change gallery layout"
            value={layoutKey}
            onChange={(e) => updateAttributes({ layout: e.target.value })}
            className="rounded border-0 bg-white/90 px-1.5 py-1 text-xs"
          >
            {options.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
          </select>
        )}
        <button
          type="button"
          onClick={(e) => { e.preventDefault(); deleteNode(); }}
          aria-label="Delete gallery"
          title="Delete gallery"
          className="rounded p-1 text-white hover:bg-red-600"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </NodeViewWrapper>
  );
}
