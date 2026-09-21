import React from 'react';

interface TiptapMark {
  type: string;
  attrs?: Record<string, unknown>;
}

interface TiptapNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: TiptapNode[];
  marks?: TiptapMark[];
  text?: string;
}

interface TiptapRendererProps {
  content: TiptapNode | Record<string, unknown> | string;
}

function renderMarks(text: string, marks?: TiptapMark[]): React.ReactNode {
  if (!marks || !marks.length) return text;

  return marks.reduce<React.ReactNode>((acc, mark) => {
    switch (mark.type) {
      case 'bold':
        return <strong key={mark.type}>{acc}</strong>;
      case 'italic':
        return <em key={mark.type}>{acc}</em>;
      case 'link':
        return (
          <a
            key={mark.type}
            href={mark.attrs?.href as string}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary-500 underline hover:text-primary-600"
          >
            {acc}
          </a>
        );
      case 'code':
        return (
          <code key={mark.type} className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-sm">
            {acc}
          </code>
        );
      default:
        return acc;
    }
  }, text);
}

function renderNode(node: TiptapNode, index: number): React.ReactNode {
  switch (node.type) {
    case 'paragraph':
      return (
        <p key={index} className="mb-4 leading-relaxed text-gray-800">
          {node.content?.map((child, i) => renderNode(child, i))}
        </p>
      );

    case 'heading': {
      const level = (node.attrs?.level as number) || 1;
      const Tag = (`h${level}`) as keyof JSX.IntrinsicElements;
      const sizeClass =
        level === 1
          ? 'text-3xl font-bold'
          : level === 2
            ? 'text-2xl font-bold'
            : 'text-xl font-semibold';
      return (
        <Tag key={index} className={`${sizeClass} mb-4 mt-8 text-gray-900`}>
          {node.content?.map((child, i) => renderNode(child, i))}
        </Tag>
      );
    }

    case 'bulletList':
      return (
        <ul key={index} className="mb-4 list-disc space-y-1 pl-6">
          {node.content?.map((child, i) => renderNode(child, i))}
        </ul>
      );

    case 'orderedList':
      return (
        <ol key={index} className="mb-4 list-decimal space-y-1 pl-6">
          {node.content?.map((child, i) => renderNode(child, i))}
        </ol>
      );

    case 'listItem':
      return (
        <li key={index} className="leading-relaxed text-gray-800">
          {node.content?.map((child, i) => renderNode(child, i))}
        </li>
      );

    case 'blockquote':
      return (
        <blockquote
          key={index}
          className="my-6 border-l-4 border-primary-300 bg-gray-50 py-3 pl-4 italic text-gray-600"
        >
          {node.content?.map((child, i) => renderNode(child, i))}
        </blockquote>
      );

    case 'horizontalRule':
      return <hr key={index} className="my-8 border-gray-200" />;

    case 'image': {
      const alt = (node.attrs?.alt as string) || '';
      return (
        <figure key={index} className="my-6">
          <img
            src={node.attrs?.src as string}
            alt={alt}
            className="w-full rounded-lg"
          />
          {alt && (
            <figcaption className="mt-2 text-center text-sm text-gray-500">
              {alt}
            </figcaption>
          )}
        </figure>
      );
    }

    case 'text':
      return node.text
        ? renderMarks(node.text, node.marks)
        : null;

    default:
      return null;
  }
}

export default function TiptapRenderer({ content }: TiptapRendererProps) {
  let parsed: TiptapNode;

  if (typeof content === 'string') {
    try {
      parsed = JSON.parse(content) as TiptapNode;
    } catch {
      return <div className="prose max-w-none whitespace-pre-wrap">{content}</div>;
    }
  } else if ('type' in content) {
    parsed = content as TiptapNode;
  } else {
    return null;
  }

  if (!parsed || !('type' in parsed)) {
    return null;
  }

  return (
    <div className="prose max-w-none">
      {parsed.content?.map((node, i) => renderNode(node, i))}
    </div>
  );
}
