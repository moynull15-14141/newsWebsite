import { Fragment } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiFetch, withLang } from '@/lib/api';
import AdSlot from '@/components/AdSlot';
import NewsletterSignup from '@/components/NewsletterSignup';
import { Skeleton } from '@/components/Skeleton';
import { Container } from '@/components/Container';
import { BriefList, EditorialSection, LeadStory, RankedList, SectionBody, StoryRow } from '@/components/editorial';
import { selectHomepageSections, selectHomepageStories, uniqueArticles, type HomepageEditorialData } from '@/lib/editorial-selection';
import { useLanguage } from '@/lib/i18n';
import SeoHead from '@/components/SeoHead';

function HomeSkeleton() {
  return <Container className="py-8"><div className="grid gap-7 md:grid-cols-[minmax(0,2fr)_minmax(15rem,1fr)] lg:grid-cols-[14rem_minmax(0,2fr)_17rem]">
    <div className="hidden space-y-4 lg:block"><Skeleton className="h-7 w-28" />{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
    <div className="space-y-4"><Skeleton className="aspect-video w-full" /><Skeleton className="h-8 w-5/6" /><Skeleton className="h-5 w-full" /></div>
    <div className="space-y-4"><Skeleton className="h-7 w-28" />{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
  </div></Container>;
}

export default function HomePage() {
  const { code, t, pathFor } = useLanguage();
  const { data, isLoading, error } = useQuery<HomepageEditorialData>({
    queryKey: ['homepage', code],
    queryFn: () => apiFetch(withLang('/public/homepage', code)),
  });
  if (isLoading) return <HomeSkeleton />;
  if (error) return <Container className="py-16 text-center"><h1 className="text-xl font-bold">{t('common.somethingWrong')}</h1><p className="mt-2 text-neutral-600">{t('common.unableToLoad')}</p></Container>;

  const { hero, briefs, secondary, ranked } = selectHomepageStories(data);
  const sections = selectHomepageSections(data);
  const sectionUsed = new Set(hero ? [hero.id] : []);
  const pageTitle = code === 'bn' ? 'বাংলাদেশ ও বিশ্বের সর্বশেষ সংবাদ' : 'Latest Bangladesh and world news';

  return <><SeoHead title={pageTitle} description={code === 'bn' ? 'বাংলাদেশ ও বিশ্বের সর্বশেষ সংবাদ, প্রতিবেদন ও বিশ্লেষণ।' : 'Latest Bangladesh and world news, reporting and analysis.'} alternates={[{ code: 'bn', url: '/' }, { code: 'en', url: '/en' }]} /><Container className="py-6 lg:py-8">
    {/* The masthead logo is a styled <span>, not a heading, so the homepage otherwise has zero <h1> —
      * visually hidden since the logo already carries this visually, but every page needs exactly one
      * real <h1> for screen reader users and document outline. */}
    <h1 className="sr-only">{pageTitle}</h1>
    {hero ? <section aria-label={t('common.topStories')} className="grid gap-7 border-b border-neutral-300 pb-8 md:grid-cols-[minmax(0,2fr)_minmax(15rem,1fr)] lg:grid-cols-[14rem_minmax(0,2fr)_17rem] lg:gap-8">
      <div className="order-2 lg:order-1"><BriefList title={t('common.latest')} articles={briefs} /></div>
      <div className="order-1 lg:order-2"><LeadStory article={hero} /></div>
      <div className="order-3 border-t border-neutral-300 pt-5 md:border-l md:border-t-0 md:pl-7 md:pt-0 lg:pl-8"><h2 className="mb-1 border-t-4 border-neutral-900 py-3 text-lg font-bold">{t('common.topStories')}</h2>{secondary.slice(0, 3).map((article) => <StoryRow key={article.id} article={article} compact />)}</div>
    </section> : <p className="py-16 text-center text-neutral-500">{t('home.noStories')}</p>}

    <AdSlot slot="HOME_HERO" pageType="HOMEPAGE" />

    <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_18rem] lg:gap-10">
      <div className="space-y-12">
        <AdSlot slot="HOME_FEED" pageType="HOMEPAGE" />
        {sections.map((section, index) => {
          const articles = uniqueArticles(section.articles, sectionUsed).slice(0, 6);
          if (!articles.length) return null;
          articles.forEach((article) => sectionUsed.add(article.id));
          return <Fragment key={section.key}>
            <EditorialSection title={section.title} href={section.href ? pathFor(section.href, code) : undefined}>
              <SectionBody articles={articles} layout={section.layout} cardVariant={section.cardVariant} />
            </EditorialSection>
            {index === 1 && <AdSlot slot="HOME_MID_FEED" pageType="HOMEPAGE" />}
          </Fragment>;
        })}
      </div>
      <div className="space-y-10 lg:border-l lg:border-neutral-300 lg:pl-8">
        <RankedList title={t('common.mostRead')} articles={ranked.length ? ranked : uniqueArticles(data?.mostRead || [], new Set(hero ? [hero.id] : [])).slice(0, 5)} />
        {data?.trending && <BriefList title={t('common.trending')} articles={uniqueArticles(data.trending, new Set(hero ? [hero.id] : [])).slice(0, 5)} />}
        <AdSlot slot="HOME_SIDEBAR" pageType="HOMEPAGE" />
      </div>
    </div>
    <div className="mt-12"><NewsletterSignup /></div>
    <AdSlot slot="HOME_BEFORE_FOOTER" pageType="HOMEPAGE" />
  </Container></>;
}
