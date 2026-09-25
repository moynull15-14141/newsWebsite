import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react';
import { Trash2 } from 'lucide-react';

/**
 * The stock TipTap Image node has no visible UI of its own — deleting one technically already worked
 * (click to select, then Backspace/Delete), but with zero visual affordance nobody could discover that,
 * which is exactly why "an image can be set but not removed" kept coming up. This NodeView adds a small
 * hover/selected toolbar with an explicit delete button, so removing an inline image is as obvious as
 * inserting one.
 */
export default function ImageNodeView({ node, selected, deleteNode }: NodeViewProps) {
  const { src, alt, title, width, align } = node.attrs as { src: string; alt?: string; title?: string; width?: string | null; align?: string };
  const margin = align === 'center' ? 'mx-auto' : align === 'right' ? 'ml-auto' : '';

  return (
    <NodeViewWrapper as="span" className="group relative inline-block" style={{ display: 'block', width: width || undefined }}>
      <img
        src={src}
        alt={alt || ''}
        title={title || undefined}
        className={`block rounded ${margin} ${selected ? 'ring-2 ring-primary-500' : ''}`}
        style={{ width: width || '100%' }}
        draggable={false}
      />
      <div
        className={`absolute right-2 top-2 flex gap-1 rounded-md bg-black/60 p-1 opacity-0 transition-opacity group-hover:opacity-100 ${selected ? 'opacity-100' : ''}`}
      >
        <button
          type="button"
          onClick={(e) => { e.preventDefault(); deleteNode(); }}
          aria-label="Delete image"
          title="Delete image"
          className="rounded p-1 text-white hover:bg-red-600"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </NodeViewWrapper>
  );
}
