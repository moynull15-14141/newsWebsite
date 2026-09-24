import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Header from '../components/Header';
import Footer from '../components/Footer';
import BreakingNewsBanner from '../components/BreakingNewsBanner';
import AdSlot from '../components/AdSlot';
import { resetShownAds } from '../lib/ad-session';

export default function MainLayout() {
  const location = useLocation();
  // A fresh pageview should never carry over "already shown" campaign ids from the last page — that
  // would just suppress an otherwise-eligible ad for no reason (see lib/ad-session.ts).
  useEffect(() => { resetShownAds(); }, [location.pathname]);

  return (
    <div className="flex min-h-screen flex-col">
      <BreakingNewsBanner />
      <AdSlot slot="BREAKING_NEWS_BELOW" pageType="ALL" />
      <Header />
      <AdSlot slot="TOP_BILLBOARD" pageType="ALL" />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
      <AdSlot slot="MOBILE_STICKY" pageType="ALL" sticky />
    </div>
  );
}
