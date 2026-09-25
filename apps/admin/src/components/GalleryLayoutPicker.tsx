import { X } from 'lucide-react';
import { layoutsForCount } from '../lib/image-gallery';

interface GalleryLayoutPickerProps {
  imageCount: number;
  onSelect: (layoutKey: string) => void;
  onClose: () => void;
}

/** Miniature, non-interactive rendering of a layout's own grid — a real preview of the arrangement
 * (using gray placeholder boxes, not the actual selected photos) rather than an abstract diagram, so
 * "big left, two stacked right" reads at a glance instead of needing the description text. */
function LayoutThumbnail({ containerClass, itemClasses }: { containerClass: string; itemClasses: string[] }) {
  return (
    <div className={`${containerClass} h-16 w-full`}>
      {itemClasses.map((_, i) => (
        <div key={i} className={`rounded bg-gray-300 ${itemClasses[i]?.includes('h-full') ? 'h-full' : 'h-full w-full'}`} />
      ))}
    </div>
  );
}

export default function GalleryLayoutPicker({ imageCount, onSelect, onClose }: GalleryLayoutPickerProps) {
  const options = layoutsForCount(imageCount);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" role="dialog" aria-modal="true" aria-labelledby="gallery-layout-title">
      <div className="w-full max-w-2xl rounded-lg bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 id="gallery-layout-title" className="text-lg font-semibold text-gray-900">Choose a layout for your {imageCount} images</h2>
          <button onClick={onClose} aria-label="Close" className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {options.map((layout) => (
            <button
              key={layout.key}
              type="button"
              onClick={() => onSelect(layout.key)}
              className="rounded-lg border border-gray-200 p-3 text-left hover:border-primary-500 hover:bg-primary-50"
            >
              <LayoutThumbnail containerClass={layout.containerClass} itemClasses={layout.itemClasses} />
              <p className="mt-2 text-sm font-semibold text-gray-900">{layout.label}</p>
              <p className="text-xs text-gray-500">{layout.description}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
