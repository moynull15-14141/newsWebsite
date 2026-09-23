import { Routes, Route, Navigate } from 'react-router-dom';
import AdminLayout from './layouts/AdminLayout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import ArticlesPage from './pages/ArticlesPage';
import ReviewQueuePage from './pages/ReviewQueuePage';
import ArticleEditorPage from './pages/ArticleEditorPage';
import RevisionsPage from './pages/RevisionsPage';
import MediaPage from './pages/MediaPage';
import ProtectedRoute from './components/ProtectedRoute';
import CommentsPage from './pages/CommentsPage';
import AdsPage from './pages/AdsPage';
import AnalyticsPage from './pages/AnalyticsPage';
import HomepagePage from './pages/HomepagePage';
import HomepagePreviewPage from './pages/HomepagePreviewPage';
import RequirePermission from './components/RequirePermission';
import CollectionsPage from './pages/CollectionsPage';
import SettingsPage from './pages/SettingsPage';
import CategoriesPage from './pages/CategoriesPage';
import TagsPage from './pages/TagsPage';
import LocationsPage from './pages/LocationsPage';
import UsersPage from './pages/UsersPage';
import LanguagesPage from './pages/LanguagesPage';
import SeoDashboardPage from './pages/SeoDashboardPage';
import BreakingNewsPage from './pages/BreakingNewsPage';
import JobsDashboardPage from './pages/JobsDashboardPage';
import JobsPage from './pages/JobsPage';
import JobEditorPage from './pages/JobEditorPage';
import JobCategoriesPage from './pages/JobCategoriesPage';
import EmployersPage from './pages/EmployersPage';
import JobApplicationsPage from './pages/JobApplicationsPage';
import PlatformSettingsPage from './pages/PlatformSettingsPage';

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="articles" element={<ArticlesPage />} />
        <Route path="review" element={<ReviewQueuePage />} />
        <Route path="articles/new" element={<ArticleEditorPage />} />
        <Route path="articles/:id/edit" element={<ArticleEditorPage />} />
        <Route path="articles/:id/revisions" element={<RevisionsPage />} />
        <Route path="media" element={<MediaPage />} />
        <Route path="comments" element={<CommentsPage />} />
        <Route path="ads" element={<AdsPage />} />
        <Route path="analytics" element={<AnalyticsPage />} />
        <Route path="seo" element={<RequirePermission permission="analytics.view"><SeoDashboardPage /></RequirePermission>} />
        <Route path="categories" element={<CategoriesPage />} />
        <Route path="tags" element={<TagsPage />} />
        <Route path="locations" element={<LocationsPage />} />
        <Route path="users" element={<UsersPage />} />
        <Route path="homepage" element={<RequirePermission permission="homepage.manage"><HomepagePage /></RequirePermission>} />
        <Route path="breaking-news" element={<RequirePermission permission="breaking_news.manage"><BreakingNewsPage /></RequirePermission>} />
        <Route path="homepage/preview" element={<RequirePermission permission="homepage.manage"><HomepagePreviewPage /></RequirePermission>} />
        <Route path="collections" element={<CollectionsPage />} />
        <Route path="languages" element={<RequirePermission permission="settings.manage"><LanguagesPage /></RequirePermission>} />
        <Route path="jobs" element={<RequirePermission permission="job.read"><JobsDashboardPage /></RequirePermission>} />
        <Route path="jobs/all" element={<RequirePermission permission="job.read"><JobsPage /></RequirePermission>} />
        <Route path="jobs/new" element={<RequirePermission permission="job.create"><JobEditorPage /></RequirePermission>} />
        <Route path="jobs/:id/edit" element={<RequirePermission permission="job.edit"><JobEditorPage /></RequirePermission>} />
        <Route path="jobs/categories" element={<RequirePermission permission="job.manage_categories"><JobCategoriesPage /></RequirePermission>} />
        <Route path="jobs/employers" element={<RequirePermission permission="job.manage_employers"><EmployersPage /></RequirePermission>} />
        <Route path="jobs/applications" element={<RequirePermission permission="job_application.view"><JobApplicationsPage /></RequirePermission>} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="settings/platform" element={<RequirePermission permission="platform.settings.view"><PlatformSettingsPage /></RequirePermission>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
