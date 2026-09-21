import { Outlet } from 'react-router-dom';
import Header from '../components/Header';
import Footer from '../components/Footer';
import BreakingNewsBanner from '../components/BreakingNewsBanner';

export default function MainLayout() {
  return (
    <div className="flex min-h-screen flex-col">
      <BreakingNewsBanner />
      <Header />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
