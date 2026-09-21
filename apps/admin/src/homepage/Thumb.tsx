import { ImageOff } from 'lucide-react';

/** Story thumbnail from the article's featured image, with the Admin's grey placeholder when there is none. */
export default function Thumb({ url, className = 'h-12 w-16' }: { url?: string | null; className?: string }) {
  if (!url) {
    return (
      <span className={`flex shrink-0 items-center justify-center rounded bg-gray-100 text-gray-400 ${className}`} role="img" aria-label="No image">
        <ImageOff className="h-4 w-4" aria-hidden="true" />
      </span>
    );
  }
  // Decorative: the headline next to it already names the story.
  return <img src={url} alt="" loading="lazy" className={`shrink-0 rounded bg-gray-100 object-cover ${className}`} />;
}
