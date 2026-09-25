import { useEditor, EditorContent, ReactNodeViewRenderer } from '@tiptap/react';
import { Node } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import ImageNodeView from './ImageNodeView';
import ImageGalleryNodeView from './ImageGalleryNodeView';
import Placeholder from '@tiptap/extension-placeholder';
import TextAlign from '@tiptap/extension-text-align';
import { TextStyle } from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import Highlight from '@tiptap/extension-highlight';
import Subscript from '@tiptap/extension-subscript';
import Superscript from '@tiptap/extension-superscript';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { Table } from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import CharacterCount from '@tiptap/extension-character-count';
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough, List, ListOrdered, ListChecks, Quote, Minus,
  Link as LinkIcon, Unlink, ExternalLink, Image as ImageIcon, AlignLeft, AlignCenter, AlignRight, AlignJustify,
  Heading2, Heading3, Heading4, Pilcrow, Code, Code2, Highlighter, Palette, Superscript as SuperscriptIcon,
  Subscript as SubscriptIcon, RemoveFormatting, Indent, Table as TableIcon,
  Trash2, X, LayoutGrid,
} from 'lucide-react';
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';

/** The base Image node only knows src/alt/title — add width & alignment so the editor can offer real
 * layout control without a heavier custom node (no caption node yet; the "caption" field below rides
 * on `title`, which browsers already show as a tooltip). */
const ImageWithLayout = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: { default: null, renderHTML: (attrs) => (attrs.width ? { style: `width: ${attrs.width}` } : {}) },
      align: {
        default: 'left',
        renderHTML: (attrs) => {
          const align = attrs.align || 'left';
          const margin = align === 'center' ? 'margin-left:auto;margin-right:auto;display:block;' : align === 'right' ? 'margin-left:auto;display:block;' : 'display:block;';
          return { style: `${margin}${attrs.width ? `width:${attrs.width};` : ''}` };
        },
      },
    };
  },
  // Gives inline images a visible hover/selected delete button (see ImageNodeView) — the node was
  // already deletable via click-then-Backspace with the stock renderer, but with zero visual affordance
  // that was never discoverable, which is exactly the "can set an image but can't remove it" complaint.
  addNodeView() {
    return ReactNodeViewRenderer(ImageNodeView);
  },
});

/**
 * A 2–4 image collage in one of the ready-made layouts from lib/image-gallery.ts. Deliberately its own
 * node rather than a sequence of plain Image nodes wrapped in a div — TipTap has no generic "container"
 * node that survives copy/paste and JSON round-tripping cleanly, and keeping the whole collage (images +
 * chosen layout) as one atomic node is what lets ImageGalleryNodeView offer a single "change layout" /
 * "delete" control for the group instead of the group falling apart into loose images.
 */
const ImageGallery = Node.create({
  name: 'imageGallery',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      layout: { default: 'TWO_EQUAL' },
      // Array<{ src: string; alt?: string }> — TipTap attrs accept any JSON-serializable value, they
      // just don't get their own parseHTML/renderHTML treatment beyond what's declared here.
      images: { default: [] as { src: string; alt?: string }[] },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-image-gallery]' }];
  },

  renderHTML() {
    // Non-interactive fallback (no NodeView mounted) — not the normal path, since both the editor and
    // TiptapRenderer always render this node type explicitly, but required for the schema to be valid.
    return ['div', { 'data-image-gallery': 'true' }];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ImageGalleryNodeView);
  },
});

interface RichTextEditorProps {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
  /** When given, the toolbar's Image button calls this (typically to open the shared Media Library
   *  picker in "insert into body" mode) instead of falling back to the built-in URL modal. */
  onRequestImage?: () => void;
  /** When given, the toolbar's Gallery button calls this (opens the parent's multi-select Media Library
   *  + layout picker flow) instead of hiding the Gallery button entirely. */
  onRequestGallery?: () => void;
}

export interface RichTextEditorHandle {
  /** Inserts a real, already-uploaded media asset at the current cursor position. */
  insertImage: (url: string, alt?: string) => void;
  /** Inserts a 2–4 image collage using one of lib/image-gallery.ts's ready-made layouts. */
  insertGallery: (images: { src: string; alt?: string }[], layoutKey: string) => void;
}

const READING_WPM = 200;

const RichTextEditor = forwardRef<RichTextEditorHandle, RichTextEditorProps>(function RichTextEditor({ content, onChange, placeholder, onRequestImage, onRequestGallery }, ref) {
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkNewTab, setLinkNewTab] = useState(false);
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [imageUrl, setImageUrl] = useState('');
  const [imageAlt, setImageAlt] = useState('');
  const [imageCaption, setImageCaption] = useState('');
  const [imageWidth, setImageWidth] = useState('');
  const [imageAlign, setImageAlign] = useState<'left' | 'center' | 'right'>('left');
  // Plain refs, not state: the native color <input>'s change event can fire before a React state
  // update from the preceding mousedown has flushed and re-rendered, so a closure over state risks
  // reading the stale (null) value — a ref's `.current` is always read fresh at call time.
  const colorSelectionRef = useRef<{ from: number; to: number } | null>(null);
  const highlightSelectionRef = useRef<{ from: number; to: number } | null>(null);

  const editor = useEditor({
    extensions: [
      // heading levels capped to 2–4: the article's own title is the page's only H1 (toolbar already
      // only offers H2–H4), and without this the Markdown "# " input rule or a pasted Word/HTML H1
      // would still slip a level-1 heading into the body, producing a second <h1> on the public page.
      StarterKit.configure({ link: { openOnClick: false }, heading: { levels: [2, 3, 4] } }),
      ImageWithLayout,
      ImageGallery,
      Placeholder.configure({ placeholder: placeholder || 'Start writing...' }),
      TextAlign.configure({ types: ['heading', 'paragraph'], alignments: ['left', 'center', 'right', 'justify'] }),
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      Subscript,
      Superscript,
      TaskList,
      TaskItem.configure({ nested: true }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      CharacterCount,
    ],
    content: content || '',
    onUpdate: ({ editor }) => {
      onChange(JSON.stringify(editor.getJSON()));
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm sm:prose max-w-none focus:outline-none min-h-[300px] px-4 py-3',
      },
    },
  });

  useEffect(() => {
    if (editor && content) {
      try {
        const parsed = JSON.parse(content);
        const currentContent = JSON.stringify(editor.getJSON());
        if (content !== currentContent) {
          editor.commands.setContent(parsed);
        }
      } catch {
        // ignore
      }
    }
  }, [content, editor]);

  useImperativeHandle(ref, () => ({
    insertImage: (url: string, alt?: string) => {
      editor?.chain().focus().setImage({ src: url, alt }).run();
    },
    insertGallery: (images, layoutKey) => {
      editor?.chain().focus().insertContent({ type: 'imageGallery', attrs: { images, layout: layoutKey } }).run();
    },
  }), [editor]);

  if (!editor) return null;

  const ToolbarButton = ({
    onClick,
    active,
    disabled,
    label,
    children,
  }: {
    onClick: () => void;
    active?: boolean;
    disabled?: boolean;
    label: string;
    children: React.ReactNode;
  }) => (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={active}
      title={label}
      className={`rounded p-1.5 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-30 ${active ? 'bg-gray-200 text-primary-500' : 'text-gray-600'}`}
    >
      {children}
    </button>
  );

  const Divider = () => <div className="mx-1 h-6 w-px shrink-0 bg-gray-300" />;

  const openLinkModal = () => {
    setLinkUrl(editor.getAttributes('link').href || '');
    setLinkNewTab(editor.getAttributes('link').target === '_blank');
    setLinkModalOpen(true);
  };

  const applyLink = () => {
    if (linkUrl.trim()) {
      editor.chain().focus().extendMarkRange('link').setLink({ href: linkUrl.trim(), target: linkNewTab ? '_blank' : null }).run();
    }
    setLinkModalOpen(false);
  };

  const removeLink = () => {
    editor.chain().focus().unsetLink().run();
    setLinkModalOpen(false);
  };

  const openImageModal = () => {
    if (onRequestImage) {
      onRequestImage();
      return;
    }
    setImageUrl('');
    setImageAlt('');
    setImageCaption('');
    setImageWidth('');
    setImageAlign('left');
    setImageModalOpen(true);
  };

  const insertImageFromModal = () => {
    if (imageUrl.trim()) {
      editor.chain().focus().setImage({
        src: imageUrl.trim(),
        alt: imageAlt.trim() || undefined,
        title: imageCaption.trim() || undefined,
        ...(imageWidth.trim() ? { width: imageWidth.trim() } : {}),
        align: imageAlign,
      } as never).run();
    }
    setImageModalOpen(false);
  };

  const wordCount = editor.storage.characterCount?.words() ?? 0;
  const charCount = editor.storage.characterCount?.characters() ?? 0;
  const readingMinutes = Math.max(1, Math.round(wordCount / READING_WPM));

  return (
    <div className="rounded-md border border-gray-300">
      <div role="toolbar" aria-label="Formatting" className="flex flex-wrap items-center gap-1 border-b border-gray-200 p-2">
        {/* Headings */}
        <ToolbarButton label="Paragraph" onClick={() => editor.chain().focus().setParagraph().run()} active={editor.isActive('paragraph')}>
          <Pilcrow className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton label="Heading 2" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })}>
          <Heading2 className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton label="Heading 3" onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive('heading', { level: 3 })}>
          <Heading3 className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton label="Heading 4" onClick={() => editor.chain().focus().toggleHeading({ level: 4 }).run()} active={editor.isActive('heading', { level: 4 })}>
          <Heading4 className="h-4 w-4" />
        </ToolbarButton>
        <Divider />

        {/* Marks */}
        <ToolbarButton label="Bold" onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')}>
          <Bold className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton label="Italic" onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')}>
          <Italic className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton label="Underline" onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive('underline')}>
          <UnderlineIcon className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton label="Strikethrough" onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive('strike')}>
          <Strikethrough className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton label="Inline code" onClick={() => editor.chain().focus().toggleCode().run()} active={editor.isActive('code')}>
          <Code className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton label="Superscript" onClick={() => editor.chain().focus().toggleSuperscript().run()} active={editor.isActive('superscript')}>
          <SuperscriptIcon className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton label="Subscript" onClick={() => editor.chain().focus().toggleSubscript().run()} active={editor.isActive('subscript')}>
          <SubscriptIcon className="h-4 w-4" />
        </ToolbarButton>
        <label className="relative flex cursor-pointer items-center rounded p-1.5 text-gray-600 hover:bg-gray-100" title="Text color">
          <Palette className="h-4 w-4" />
          <input
            type="color"
            aria-label="Text color"
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            // A native color <input> opens the OS picker on click, which can steal focus from the
            // editor and collapse its text selection — by the time onChange fires, "apply to current
            // selection" would silently apply to nothing. Capture the selection on mousedown (before
            // the dialog opens) and explicitly restore it here before coloring.
            onMouseDown={() => { colorSelectionRef.current = { from: editor.state.selection.from, to: editor.state.selection.to }; }}
            onChange={(e) => {
              const chain = editor.chain().focus();
              if (colorSelectionRef.current) chain.setTextSelection(colorSelectionRef.current);
              chain.setColor(e.target.value).run();
            }}
          />
        </label>
        <label className="relative flex cursor-pointer items-center rounded p-1.5 text-gray-600 hover:bg-gray-100" title="Highlight color">
          <Highlighter className="h-4 w-4" />
          <input
            type="color"
            aria-label="Highlight color"
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            onMouseDown={() => { highlightSelectionRef.current = { from: editor.state.selection.from, to: editor.state.selection.to }; }}
            onChange={(e) => {
              const chain = editor.chain().focus();
              if (highlightSelectionRef.current) chain.setTextSelection(highlightSelectionRef.current);
              chain.toggleHighlight({ color: e.target.value }).run();
            }}
          />
        </label>
        <ToolbarButton label="Clear formatting" onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}>
          <RemoveFormatting className="h-4 w-4" />
        </ToolbarButton>
        <Divider />

        {/* Lists */}
        <ToolbarButton label="Bullet list" onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')}>
          <List className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton label="Numbered list" onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')}>
          <ListOrdered className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton label="Checklist" onClick={() => editor.chain().focus().toggleTaskList().run()} active={editor.isActive('taskList')}>
          <ListChecks className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton label="Indent" disabled={!editor.can().sinkListItem('listItem')} onClick={() => editor.chain().focus().sinkListItem('listItem').run()}>
          <Indent className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton label="Outdent" disabled={!editor.can().liftListItem('listItem')} onClick={() => editor.chain().focus().liftListItem('listItem').run()}>
          <Indent className="h-4 w-4 -scale-x-100" />
        </ToolbarButton>
        <Divider />

        {/* Blocks */}
        <ToolbarButton label="Blockquote" onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive('blockquote')}>
          <Quote className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton label="Code block" onClick={() => editor.chain().focus().toggleCodeBlock().run()} active={editor.isActive('codeBlock')}>
          <Code2 className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton label="Horizontal rule" onClick={() => editor.chain().focus().setHorizontalRule().run()}>
          <Minus className="h-4 w-4" />
        </ToolbarButton>
        <Divider />

        {/* Links & media */}
        <ToolbarButton label="Link" onClick={openLinkModal} active={editor.isActive('link')}>
          <LinkIcon className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton label="Image" onClick={openImageModal}>
          <ImageIcon className="h-4 w-4" />
        </ToolbarButton>
        {onRequestGallery && (
          <ToolbarButton label="Image gallery (2–4 photos)" onClick={onRequestGallery}>
            <LayoutGrid className="h-4 w-4" />
          </ToolbarButton>
        )}
        <ToolbarButton
          label="Insert table"
          onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
        >
          <TableIcon className="h-4 w-4" />
        </ToolbarButton>
        {editor.isActive('table') && (
          <>
            <ToolbarButton label="Add row" onClick={() => editor.chain().focus().addRowAfter().run()}>
              <span className="text-xs font-semibold">+R</span>
            </ToolbarButton>
            <ToolbarButton label="Add column" onClick={() => editor.chain().focus().addColumnAfter().run()}>
              <span className="text-xs font-semibold">+C</span>
            </ToolbarButton>
            <ToolbarButton label="Delete row" onClick={() => editor.chain().focus().deleteRow().run()}>
              <span className="text-xs font-semibold">-R</span>
            </ToolbarButton>
            <ToolbarButton label="Delete column" onClick={() => editor.chain().focus().deleteColumn().run()}>
              <span className="text-xs font-semibold">-C</span>
            </ToolbarButton>
            <ToolbarButton label="Delete table" onClick={() => editor.chain().focus().deleteTable().run()}>
              <Trash2 className="h-4 w-4" />
            </ToolbarButton>
          </>
        )}
        <Divider />

        {/* Alignment */}
        <ToolbarButton label="Align left" onClick={() => editor.chain().focus().setTextAlign('left').run()} active={editor.isActive({ textAlign: 'left' })}>
          <AlignLeft className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton label="Align center" onClick={() => editor.chain().focus().setTextAlign('center').run()} active={editor.isActive({ textAlign: 'center' })}>
          <AlignCenter className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton label="Align right" onClick={() => editor.chain().focus().setTextAlign('right').run()} active={editor.isActive({ textAlign: 'right' })}>
          <AlignRight className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton label="Justify" onClick={() => editor.chain().focus().setTextAlign('justify').run()} active={editor.isActive({ textAlign: 'justify' })}>
          <AlignJustify className="h-4 w-4" />
        </ToolbarButton>
      </div>

      <EditorContent editor={editor} />

      <div className="flex items-center justify-end gap-3 border-t border-gray-100 px-3 py-1.5 text-xs text-gray-400">
        <span>{wordCount} words</span>
        <span>{charCount} characters</span>
        <span>{readingMinutes} min read</span>
      </div>

      {linkModalOpen && (
        <div role="dialog" aria-modal="true" aria-labelledby="link-modal-title" className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-lg bg-white p-5 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 id="link-modal-title" className="text-sm font-semibold text-gray-900">Link</h3>
              <button type="button" onClick={() => setLinkModalOpen(false)} aria-label="Close" className="text-gray-400 hover:text-gray-600">
                <X className="h-4 w-4" />
              </button>
            </div>
            <label htmlFor="rte-link-url" className="mt-3 block text-xs font-medium text-gray-600">URL</label>
            <input
              id="rte-link-url"
              autoFocus
              type="text"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="https://..."
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
            <label className="mt-3 flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={linkNewTab} onChange={(e) => setLinkNewTab(e.target.checked)} />
              <ExternalLink className="h-3.5 w-3.5" /> Open in new tab
            </label>
            <div className="mt-4 flex justify-end gap-2">
              {editor.isActive('link') && (
                <button type="button" onClick={removeLink} className="mr-auto inline-flex items-center gap-1.5 rounded-md border border-red-200 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50">
                  <Unlink className="h-3.5 w-3.5" /> Remove
                </button>
              )}
              <button type="button" onClick={() => setLinkModalOpen(false)} className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50">Cancel</button>
              <button type="button" onClick={applyLink} className="rounded-md bg-primary-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-600">Apply</button>
            </div>
          </div>
        </div>
      )}

      {imageModalOpen && (
        <div role="dialog" aria-modal="true" aria-labelledby="image-modal-title" className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-lg bg-white p-5 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 id="image-modal-title" className="text-sm font-semibold text-gray-900">Insert image</h3>
              <button type="button" onClick={() => setImageModalOpen(false)} aria-label="Close" className="text-gray-400 hover:text-gray-600">
                <X className="h-4 w-4" />
              </button>
            </div>
            <label htmlFor="rte-image-url" className="mt-3 block text-xs font-medium text-gray-600">Image URL</label>
            <input id="rte-image-url" autoFocus type="text" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://..." className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
            <label htmlFor="rte-image-alt" className="mt-3 block text-xs font-medium text-gray-600">Alt text</label>
            <input id="rte-image-alt" type="text" value={imageAlt} onChange={(e) => setImageAlt(e.target.value)} placeholder="Describes the image for accessibility & SEO" className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
            <label htmlFor="rte-image-caption" className="mt-3 block text-xs font-medium text-gray-600">Caption (optional)</label>
            <input id="rte-image-caption" type="text" value={imageCaption} onChange={(e) => setImageCaption(e.target.value)} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="rte-image-width" className="block text-xs font-medium text-gray-600">Width (optional)</label>
                <input id="rte-image-width" type="text" value={imageWidth} onChange={(e) => setImageWidth(e.target.value)} placeholder="e.g. 480px or 100%" className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
              </div>
              <div>
                <label htmlFor="rte-image-align" className="block text-xs font-medium text-gray-600">Alignment</label>
                <select id="rte-image-align" value={imageAlign} onChange={(e) => setImageAlign(e.target.value as 'left' | 'center' | 'right')} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
                  <option value="left">Left</option>
                  <option value="center">Center</option>
                  <option value="right">Right</option>
                </select>
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setImageModalOpen(false)} className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50">Cancel</button>
              <button type="button" onClick={insertImageFromModal} disabled={!imageUrl.trim()} className="rounded-md bg-primary-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-600 disabled:opacity-50">Insert</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

export default RichTextEditor;
