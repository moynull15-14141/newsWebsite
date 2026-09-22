import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import MainLayout from './layouts/MainLayout';
import HomePage from './pages/HomePage';
import CategoryPage from './pages/CategoryPage';
import ArticlePage from './pages/ArticlePage';
import TagPage from './pages/TagPage';
import AuthorPage from './pages/AuthorPage';
import LocationPage from './pages/LocationPage';
import SearchPage from './pages/SearchPage';
import NotFoundPage from './pages/NotFoundPage';
import ReaderLoginPage from './pages/ReaderLoginPage';
import ReaderRegisterPage from './pages/ReaderRegisterPage';
import { AccountPage, SavedPage, NotificationsPage, SettingsPage } from './pages/ReaderAccountPages';
import CollectionPage from './pages/CollectionPage';
import { LanguageProvider } from './lib/i18n';

/**
 * Content routes, shared between the default (bare) language and every prefixed one (`/en`). Keeping
 * one definition means a route can never exist in English but not Bangla, or vice versa.
 *
 * A plain function called inline (`{contentRoutes()}`) — not a component rendered as `<ContentRoutes/>`.
 * React Router builds its route table by walking `<Routes>`'s children for literal `<Route>` elements
 * without rendering them; a custom component in that position is invisible to that walk, so its routes
 * would silently never match. Calling the function inline splices the real `<Route>` elements in place.
 */
function contentRoutes() {
  return [
    <Route key="home" index element={<HomePage />} />,
    <Route key="category" path="category/:slug" element={<CategoryPage />} />,
    <Route key="article" path="article/:slug" element={<ArticlePage />} />,
    <Route key="tag" path="tag/:slug" element={<TagPage />} />,
    <Route key="author" path="author/:id" element={<AuthorPage />} />,
    <Route key="location" path="location/:slug" element={<LocationPage />} />,
    <Route key="bangladesh" path="bangladesh" element={<LocationPage />} />,
    <Route key="division" path="division/:slug" element={<LocationPage />} />,
    <Route key="district" path="district/:slug" element={<LocationPage />} />,
    <Route key="search" path="search" element={<SearchPage />} />,
    <Route key="collection" path="collection/:slug" element={<CollectionPage />} />,
    <Route key="not-found" path="*" element={<NotFoundPage />} />,
  ];
}

/**
 * `/bn/...` is a compatibility alias, not a second canonical form: bn is the default language and
 * already lives at the bare URL, so a `/bn` link (e.g. someone guessing the prefix, or an old bookmark
 * from before this existed) is redirected to its bare equivalent rather than served twice.
 */
function RedirectToDefaultLanguage() {
  const location = useLocation();
  const rest = location.pathname.slice('/bn'.length) || '/';
  return <Navigate to={`${rest}${location.search}`} replace />;
}

function App() {
  return (
    <LanguageProvider>
      <Routes>
        <Route path="/" element={<MainLayout />}>
          {contentRoutes()}
        </Route>
        <Route path="/en" element={<MainLayout />}>
          {contentRoutes()}
        </Route>
        <Route path="/bn/*" element={<RedirectToDefaultLanguage />} />

        <Route path="/login" element={<ReaderLoginPage />} />
        <Route path="/en/login" element={<ReaderLoginPage />} />
        <Route path="/register" element={<ReaderRegisterPage />} />
        <Route path="/en/register" element={<ReaderRegisterPage />} />

        <Route path="/account" element={<MainLayout />}>
          <Route index element={<AccountPage />} />
          <Route path="saved" element={<SavedPage />} />
          <Route path="notifications" element={<NotificationsPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
        <Route path="/en/account" element={<MainLayout />}>
          <Route index element={<AccountPage />} />
          <Route path="saved" element={<SavedPage />} />
          <Route path="notifications" element={<NotificationsPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </LanguageProvider>
  );
}

export default App;
