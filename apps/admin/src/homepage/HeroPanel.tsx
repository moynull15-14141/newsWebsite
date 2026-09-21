import { Newspaper } from 'lucide-react';
import Thumb from './Thumb';
import { contentLang, formatDate } from './logic';
import { STORY_STATUS_LABELS } from './labels';
import type { DraftSection } from './types';

interface HeroPanelProps {
  /** The draft's HERO section, if it has one. */
  section?: DraftSection;
  disabled: boolean;
  onChoose: () => void;
  onRemove: () => void;
  onShow: () => void;
}

/** The Hero is a single-story slot, presented separately from ordinary multi-story sections. */
export default function HeroPanel({ section, disabled, onChoose, onRemove, onShow }: HeroPanelProps) {
  const placement = section?.placements[0];
  const article = placement?.article;

  return (
    <section aria-labelledby="hero-heading" id={section ? `section-${section.key}` : 'section-hero'} className="mb-6 overflow-hidden rounded-md border border-gray-200 bg-white">
      <div className="flex items-baseline justify-between gap-3 border-b border-gray-100 px-4 py-2">
        <h2 id="hero-heading" className="text-sm font-bold uppercase tracking-wide text-gray-700">Homepage Hero</h2>
        <p className="text-xs text-gray-500">One story. It leads the public homepage.</p>
      </div>

      {section && !section.enabled && (
        <div className="flex items-center justify-between gap-3 bg-amber-50 px-4 py-2 text-sm text-amber-900">
          <span>The Hero is hidden in this draft, so the public homepage would ignore your choice.</span>
          <button type="button" onClick={onShow} disabled={disabled} className="rounded border border-amber-300 bg-white px-2 py-1 text-xs font-semibold hover:bg-amber-100 disabled:opacity-50">Show hero</button>
        </div>
      )}

      {article && placement ? (
        <div className="flex flex-wrap items-start gap-4 px-4 py-4">
          <Thumb url={article.media?.publicUrl} className="h-24 w-40" />
          <div className="min-w-0 flex-1">
            <p lang={contentLang(article.title)} className="text-base font-semibold leading-snug text-gray-900">{article.title}</p>
            <p className="mt-1 text-xs text-gray-500">{[article.category?.name, article.author?.name, formatDate(article.publishedAt)].filter(Boolean).join(' · ')}</p>
            {!placement.eligible && (
              <p role="alert" className="mt-2 inline-block rounded bg-red-100 px-2 py-1 text-xs font-semibold text-red-800">
                {STORY_STATUS_LABELS[article.status] ?? article.status} — this story can no longer be the Hero. Replace it.
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={onChoose} disabled={disabled} className="rounded border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">Replace article</button>
            <button type="button" onClick={onRemove} disabled={disabled} className="rounded border border-red-200 bg-white px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50">Remove</button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-4 px-4 py-5">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-gray-100 text-gray-400"><Newspaper className="h-6 w-6" aria-hidden="true" /></span>
          <div className="min-w-0 flex-1 text-sm text-gray-600">
            <p className="font-medium text-gray-800">No hero story is selected.</p>
            <p>Until you choose one, the public homepage leads with the first curated story instead.</p>
          </div>
          <button type="button" onClick={onChoose} disabled={disabled} className="rounded bg-primary-500 px-3 py-1.5 text-sm font-semibold text-white hover:bg-primary-600 disabled:opacity-50">Choose hero article</button>
        </div>
      )}
    </section>
  );
}
