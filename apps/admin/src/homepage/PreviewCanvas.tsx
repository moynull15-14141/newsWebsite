import Thumb from './Thumb';
import { contentLang, formatDate } from './logic';
import { selectPreviewSections, selectPreviewStories, uniqueArticles } from './preview-selection';
import type { PreviewArticle, PreviewData } from './types';

export type PreviewMode = 'desktop' | 'mobile';

/**
 * Faithful, compact rendition of the public homepage composition (lead + briefs + top stories, layout
 * presets per section, most-read/trending rail) for reviewing a DRAFT. Presentation only: it never
 * fetches and mutates nothing. Links are intentionally inert so a preview click cannot leave the draft.
 * The two modes use explicit classes (not viewport breakpoints) so "mobile" looks the same on any monitor.
 */
export default function PreviewCanvas({ data, mode }: { data: PreviewData; mode: PreviewMode }) {
  const desktop = mode === 'desktop';
  const { hero, briefs, secondary, ranked } = selectPreviewStories(data);
  const sections = selectPreviewSections(data);
  const used = new Set(hero ? [hero.id] : []);

  return (
    <div className="bg-white p-5 text-neutral-900" data-preview-mode={mode}>
      {hero ? (
        <section aria-label="Top stories" className={`border-b border-neutral-300 pb-6 ${desktop ? 'grid grid-cols-[12rem_minmax(0,1fr)_15rem] gap-6' : 'space-y-5'}`}>
          <div className={desktop ? '' : 'order-2'}><Briefs title="Latest" articles={briefs} /></div>
          <div className={desktop ? '' : 'order-1'}><Lead article={hero} desktop={desktop} /></div>
          <div className={desktop ? 'border-l border-neutral-200 pl-6' : 'order-3'}>
            <h2 className="border-t-4 border-neutral-900 py-2 text-base font-bold">Top stories</h2>
            {secondary.slice(0, 3).map((article) => <Row key={article.id} article={article} compact />)}
          </div>
        </section>
      ) : (
        <p className="py-10 text-center text-sm text-neutral-500">No published stories are available.</p>
      )}

      <div className={`mt-8 ${desktop ? 'grid grid-cols-[minmax(0,1fr)_15rem] gap-8' : 'space-y-8'}`}>
        <div className="space-y-9">
          {sections.map((section) => {
            const articles = uniqueArticles(section.articles, used).slice(0, 6);
            if (!articles.length) return null;
            articles.forEach((article) => used.add(article.id));
            return (
              <section key={section.key} aria-label={section.title} className="border-t-4 border-neutral-900">
                <h2 className="mb-4 border-b border-neutral-300 py-2 text-lg font-bold">{section.title}</h2>
                <Body articles={articles} layout={section.layout} desktop={desktop} />
              </section>
            );
          })}
        </div>
        <aside className={`space-y-8 ${desktop ? 'border-l border-neutral-200 pl-6' : ''}`}>
          <Ranked title="Most read" articles={ranked.length ? ranked : uniqueArticles(data.mostRead, new Set(hero ? [hero.id] : [])).slice(0, 5)} />
          <Briefs title="Trending" articles={uniqueArticles(data.trending, new Set(hero ? [hero.id] : [])).slice(0, 5)} />
          <p className="text-[11px] leading-4 text-neutral-500">Most read, Trending and Breaking news are automatic and are not part of the draft.</p>
        </aside>
      </div>
    </div>
  );
}

function Lead({ article, desktop }: { article: PreviewArticle; desktop: boolean }) {
  return (
    <article>
      <Thumb url={article.media?.publicUrl} className="aspect-video h-auto w-full" />
      <div className="pt-3">
        {article.category && <span className="text-[11px] font-bold uppercase text-primary-600">{article.category.name}</span>}
        <h2 lang={contentLang(article.title)} className={`mt-1 font-bold leading-snug ${desktop ? 'text-2xl' : 'text-xl'}`}>{article.title}</h2>
        {article.excerpt && <p lang={contentLang(article.excerpt)} className="mt-2 line-clamp-3 text-sm leading-6 text-neutral-600">{article.excerpt}</p>}
        <Meta article={article} />
      </div>
    </article>
  );
}

function Meta({ article }: { article: PreviewArticle }) {
  const text = [article.author?.name, formatDate(article.publishedAt)].filter(Boolean).join(' · ');
  return text ? <p className="mt-1.5 text-xs text-neutral-500">{text}</p> : null;
}

function Row({ article, compact = false }: { article: PreviewArticle; compact?: boolean }) {
  return (
    <article className="grid grid-cols-[minmax(0,1fr)_5.5rem] gap-3 border-b border-neutral-200 py-3 last:border-b-0">
      <div className="min-w-0">
        {article.category && !compact && <span className="text-[11px] font-semibold text-primary-600">{article.category.name}</span>}
        <h3 lang={contentLang(article.title)} className={`${compact ? 'text-sm' : 'text-base'} font-bold leading-snug`}>{article.title}</h3>
        <Meta article={article} />
      </div>
      <Thumb url={article.media?.publicUrl} className="aspect-[4/3] h-auto w-full" />
    </article>
  );
}

function Card({ article }: { article: PreviewArticle }) {
  return (
    <article className="min-w-0">
      <Thumb url={article.media?.publicUrl} className="aspect-video h-auto w-full" />
      <h3 lang={contentLang(article.title)} className="mt-2 text-base font-bold leading-snug">{article.title}</h3>
      <Meta article={article} />
    </article>
  );
}

/** The three supported layout presets (mirrors SectionBody in the public web). */
function Body({ articles, layout, desktop }: { articles: PreviewArticle[]; layout: string; desktop: boolean }) {
  const [lead, ...rest] = articles;
  if (articles.length === 1) return <Row article={lead} />;
  if (layout === 'COMPACT_LIST') return <div>{articles.map((article) => <Row key={article.id} article={article} compact />)}</div>;
  if (layout === 'THREE_UP') return <div className={`grid gap-5 ${desktop ? 'grid-cols-3' : 'grid-cols-1'}`}>{articles.slice(0, 3).map((article) => <Card key={article.id} article={article} />)}</div>;
  return (
    <div className={`grid gap-5 ${desktop ? 'grid-cols-[3fr_2fr] divide-x divide-neutral-200' : 'grid-cols-1'}`}>
      <Card article={lead} />
      <div className={desktop ? 'pl-5' : ''}>{rest.slice(0, 3).map((article) => <Row key={article.id} article={article} compact />)}</div>
    </div>
  );
}

function Briefs({ title, articles }: { title: string; articles: PreviewArticle[] }) {
  if (!articles.length) return null;
  return (
    <aside aria-label={title}>
      <h2 className="border-t-4 border-neutral-900 py-2 text-base font-bold">{title}</h2>
      {articles.map((article) => (
        <article key={article.id} className="border-t border-neutral-200 py-2.5">
          <h3 lang={contentLang(article.title)} className="text-sm font-semibold leading-snug">{article.title}</h3>
          {article.publishedAt && <time className="mt-0.5 block text-xs text-neutral-500" dateTime={article.publishedAt}>{formatDate(article.publishedAt)}</time>}
        </article>
      ))}
    </aside>
  );
}

function Ranked({ title, articles }: { title: string; articles: PreviewArticle[] }) {
  if (!articles.length) return null;
  return (
    <aside aria-label={title} className="border-t-4 border-primary-600">
      <h2 className="border-b border-neutral-300 py-2 text-base font-bold">{title}</h2>
      <ol>
        {articles.map((article, index) => (
          <li key={article.id} className="grid grid-cols-[2rem_1fr] gap-2 border-b border-neutral-200 py-3 last:border-b-0">
            <span className="text-xl font-bold leading-none text-neutral-300" aria-hidden="true">{index + 1}</span>
            <span lang={contentLang(article.title)} className="text-sm font-bold leading-snug">{article.title}</span>
          </li>
        ))}
      </ol>
    </aside>
  );
}
