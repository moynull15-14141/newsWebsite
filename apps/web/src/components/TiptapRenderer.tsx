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
      case 'underline':
        return <u key={mark.type}>{acc}</u>;
      case 'strike':
        return <s key={mark.type}>{acc}</s>;
      case 'subscript':
        return <sub key={mark.type}>{acc}</sub>;
      case 'superscript':
        return <sup key={mark.type}>{acc}</sup>;
      case 'textStyle':
        return mark.attrs?.color ? (
          <span key={mark.type} style={{ color: mark.attrs.color as string }}>
            {acc}
          </span>
        ) : (
          acc
        );
      case 'highlight':
        return (
          <mark
            key={mark.type}
            style={{ backgroundColor: (mark.attrs?.color as string) || undefined, color: 'inherit' }}
          >
            {acc}
          </mark>
        );
      default:
        return acc;
    }
  }, text);
}

function textAlignStyle(node: TiptapNode): React.CSSProperties | undefined {
  const align = node.attrs?.textAlign as string | undefined;
  return align && align !== 'left' ? { textAlign: align as React.CSSProperties['textAlign'] } : undefined;
}

function renderNode(node: TiptapNode, index: number): React.ReactNode {
  switch (node.type) {
    case 'paragraph':
      return (
        <p key={index} className="mb-4 leading-relaxed text-gray-800" style={textAlignStyle(node)}>
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
        <Tag key={index} className={`${sizeClass} mb-4 mt-8 text-gray-900`} style={textAlignStyle(node)}>
          {node.content?.map((child, i) => renderNode(child, i))}
        </Tag>
      );
    }

    case 'codeBlock':
      return (
        <pre key={index} className="my-4 overflow-x-auto rounded-md bg-gray-800 p-4 text-sm text-gray-100">
          <code>{node.content?.map((child) => child.text).join('')}</code>
        </pre>
      );

    case 'taskList':
      return (
        <ul key={index} className="mb-4 list-none space-y-1 pl-1">
          {node.content?.map((child, i) => renderNode(child, i))}
        </ul>
      );

    case 'taskItem':
      return (
        <li key={index} className="flex items-start gap-2 text-gray-800">
          <input type="checkbox" checked={Boolean(node.attrs?.checked)} readOnly className="mt-1.5" />
          <span>{node.content?.map((child, i) => renderNode(child, i))}</span>
        </li>
      );

    case 'table':
      return (
        <div key={index} className="my-4 overflow-x-auto">
          <table className="w-full border-collapse">
            <tbody>{node.content?.map((child, i) => renderNode(child, i))}</tbody>
          </table>
        </div>
      );

    case 'tableRow':
      return <tr key={index}>{node.content?.map((child, i) => renderNode(child, i))}</tr>;

    case 'tableHeader':
      return (
        <th key={index} className="border border-gray-300 bg-gray-50 p-2 text-left font-semibold">
          {node.content?.map((child, i) => renderNode(child, i))}
        </th>
      );

    case 'tableCell':
      return (
        <td key={index} className="border border-gray-300 p-2 align-top">
          {node.content?.map((child, i) => renderNode(child, i))}
        </td>
      );

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
      const caption = (node.attrs?.title as string) || '';
      const width = node.attrs?.width as string | undefined;
      const align = (node.attrs?.align as string) || 'left';
      const figureStyle: React.CSSProperties = width ? { width } : {};
      if (align === 'center') {
        figureStyle.marginLeft = 'auto';
        figureStyle.marginRight = 'auto';
      } else if (align === 'right') {
        figureStyle.marginLeft = 'auto';
      }
      return (
        <figure key={index} className="my-6" style={figureStyle}>
          <img
            src={node.attrs?.src as string}
            alt={alt}
            className="w-full rounded-lg"
          />
          {caption && (
            <figcaption className="mt-2 text-center text-sm text-gray-500">
              {caption}
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
