import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import MainLayout from './layouts/MainLayout';
import HomePage from './pages/HomePage';
import LatestPage from './pages/LatestPage';
import CategoryPage from './pages/CategoryPage';
import ArticlePage from './pages/ArticlePage';
import TagPage from './pages/TagPage';
import AuthorPage from './pages/AuthorPage';
import LocationPage from './pages/LocationPage';
import SearchPage from './pages/SearchPage';
import NotFoundPage from './pages/NotFoundPage';
import ReaderLoginPage from './pages/ReaderLoginPage';
import ReaderRegisterPage from './pages/ReaderRegisterPage';
import { AccountPage, SavedPage, NotificationsPage } from './pages/ReaderAccountPages';
import CollectionPage from './pages/CollectionPage';
import { LanguageProvider } from './lib/i18n';
import { ForgotPasswordPage, ResetPasswordPage } from './pages/ReaderPasswordPages';
import { ReaderProfilePage, ReaderSettingsPage } from './pages/ReaderProfileSettings';
import JobsListPage from './pages/JobsListPage';
import JobDetailPage from './pages/JobDetailPage';
import { SavedJobsPage, JobApplicationsPage } from './pages/ReaderJobsPages';
import EmployerLayout from './pages/employer/EmployerLayout';
import EmployerOnboardingPage from './pages/employer/EmployerOnboardingPage';
import EmployerDashboardPage from './pages/employer/EmployerDashboardPage';
import EmployerJobsPage from './pages/employer/EmployerJobsPage';
import EmployerJobFormPage from './pages/employer/EmployerJobFormPage';
import EmployerApplicationsPage from './pages/employer/EmployerApplicationsPage';
import EmployerApplicationDetailPage from './pages/employer/EmployerApplicationDetailPage';
import EmployerTeamPage from './pages/employer/EmployerTeamPage';
import EmployerCompanyPage from './pages/employer/EmployerCompanyPage';
import EmployerBillingPage from './pages/employer/EmployerBillingPage';

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
    <Route key="latest" path="latest" element={<LatestPage />} />,
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
    <Route key="jobs" path="jobs" element={<JobsListPage />} />,
    <Route key="job" path="jobs/:slug" element={<JobDetailPage />} />,
    <Route key="not-found" path="*" element={<NotFoundPage />} />,
  ];
}

/**
 * Employer portal routes, shared between the default language and `/en` — same rationale as
 * `contentRoutes()` above. `onboarding` has its own auth/registration gating (any signed-in reader may
 * reach it); every other page is nested under `EmployerLayout`, which additionally requires an active
 * employer membership and redirects to onboarding otherwise.
 */
function employerRoutes() {
  return [
    <Route key="employer-onboarding" path="onboarding" element={<EmployerOnboardingPage />} />,
    <Route key="employer-portal" element={<EmployerLayout />}>
      <Route key="dashboard" index element={<EmployerDashboardPage />} />
      <Route key="jobs" path="jobs" element={<EmployerJobsPage />} />
      <Route key="jobs-new" path="jobs/new" element={<EmployerJobFormPage />} />
      <Route key="jobs-edit" path="jobs/:id/edit" element={<EmployerJobFormPage />} />
      <Route key="applications" path="applications" element={<EmployerApplicationsPage />} />
      <Route key="application-detail" path="applications/:id" element={<EmployerApplicationDetailPage />} />
      <Route key="team" path="team" element={<EmployerTeamPage />} />
      <Route key="company" path="company" element={<EmployerCompanyPage />} />
      <Route key="billing" path="billing" element={<EmployerBillingPage />} />
    </Route>,
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
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/en/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/en/reset-password" element={<ResetPasswordPage />} />

        <Route path="/account" element={<MainLayout />}>
          <Route index element={<AccountPage />} />
          <Route path="profile" element={<ReaderProfilePage />} />
          <Route path="saved" element={<SavedPage />} />
          <Route path="saved-jobs" element={<SavedJobsPage />} />
          <Route path="applications" element={<JobApplicationsPage />} />
          <Route path="notifications" element={<NotificationsPage />} />
          <Route path="settings" element={<ReaderSettingsPage />} />
        </Route>
        <Route path="/en/account" element={<MainLayout />}>
          <Route index element={<AccountPage />} />
          <Route path="profile" element={<ReaderProfilePage />} />
          <Route path="saved" element={<SavedPage />} />
          <Route path="saved-jobs" element={<SavedJobsPage />} />
          <Route path="applications" element={<JobApplicationsPage />} />
          <Route path="notifications" element={<NotificationsPage />} />
          <Route path="settings" element={<ReaderSettingsPage />} />
        </Route>

        <Route path="/employer" element={<MainLayout />}>
          {employerRoutes()}
        </Route>
        <Route path="/en/employer" element={<MainLayout />}>
          {employerRoutes()}
        </Route>
      </Routes>
    </LanguageProvider>
  );
}

export default App;
