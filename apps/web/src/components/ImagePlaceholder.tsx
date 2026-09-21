import { forwardRef } from 'react';

interface ImagePlaceholderProps extends React.HTMLAttributes<HTMLDivElement> {
  aspect?: '16/9' | '4/3' | '1/1' | string;
}

const ImagePlaceholder = forwardRef<HTMLDivElement, ImagePlaceholderProps>(
  ({ className, aspect = '16/9', ...props }, ref) => {
    const aspectRatioMap: Record<string, string> = {
      '16/9': 'aspect-video',
      '4/3': 'aspect-[4/3]',
      '1/1': 'aspect-square',
    };
    const aspectClass = aspectRatioMap[aspect] || 'aspect-video';

    return (
      <div
        ref={ref}
        className={`flex items-center justify-center overflow-hidden bg-neutral-200 ${aspectClass} ${className || ''}`}
        {...props}
      >
        <svg aria-hidden="true" className="h-12 w-12 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.41a2.25 2.25 0 013.182 0l2.909 2.91m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"
          />
        </svg>
      </div>
    );
  }
);

ImagePlaceholder.displayName = 'ImagePlaceholder';

export { ImagePlaceholder };
export type { ImagePlaceholderProps };
