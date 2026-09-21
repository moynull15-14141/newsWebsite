import { Routes, Route } from 'react-router-dom';
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

function App() {
  return (
    <Routes>
      <Route path="/" element={<MainLayout />}>
        <Route index element={<HomePage />} />
        <Route path="category/:slug" element={<CategoryPage />} />
        <Route path="article/:slug" element={<ArticlePage />} />
        <Route path="tag/:slug" element={<TagPage />} />
        <Route path="author/:id" element={<AuthorPage />} />
        <Route path="location/:slug" element={<LocationPage />} />
        <Route path="bangladesh" element={<LocationPage />} />
        <Route path="division/:slug" element={<LocationPage />} />
        <Route path="district/:slug" element={<LocationPage />} />
        <Route path="search" element={<SearchPage />} />
        <Route path="collection/:slug" element={<CollectionPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
      <Route path="/login" element={<ReaderLoginPage />} />
      <Route path="/register" element={<ReaderRegisterPage />} />
      <Route path="/account" element={<MainLayout />}><Route index element={<AccountPage />} /><Route path="saved" element={<SavedPage />} /><Route path="notifications" element={<NotificationsPage />} /><Route path="settings" element={<SettingsPage />} /></Route>
    </Routes>
  );
}

export default App;
