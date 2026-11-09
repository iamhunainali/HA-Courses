import { useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './auth';
import Header from './components/Header';
import Footer from './components/Footer';
import Home from './pages/Home';
import AuthPage from './pages/AuthPage';
import Courses from './pages/Courses';
import CourseDetail from './pages/CourseDetail';
import Dashboard from './pages/Dashboard';
import Learn from './pages/Learn';
import ReviewsPage from './pages/ReviewsPage';
import Admin from './pages/Admin';
import Checkout from './pages/Checkout';
import Celebrate from './components/Celebrate';
import SuspendedModal from './components/SuspendedModal';

function Protected({ children, admin }: { children: any; admin?: boolean }) {
  const { user, ready } = useAuth();
  const loc = useLocation();
  if (!ready) return <div className="page">Loading…</div>;
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(loc.pathname + loc.search)}`} replace />;
  if (admin && user.role !== 'SUPER_ADMIN') return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  const { user } = useAuth();
  // Users ke liye video/image par right-click aur drag-save band (admin ko chhoot)
  useEffect(() => {
    const block = (e: any) => { if (['VIDEO', 'IMG'].includes(e.target?.tagName) && user?.role !== 'SUPER_ADMIN') e.preventDefault(); };
    document.addEventListener('contextmenu', block);
    document.addEventListener('dragstart', block);
    return () => { document.removeEventListener('contextmenu', block); document.removeEventListener('dragstart', block); };
  }, [user]);
  return (
    <div className="app">
      <Header />
      <Celebrate />
      <SuspendedModal />
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<AuthPage mode="login" />} />
          <Route path="/signup" element={<AuthPage mode="signup" />} />
          <Route path="/courses" element={<Courses />} />
          <Route path="/course/:id" element={<CourseDetail />} />
          <Route path="/dashboard" element={<Protected><Dashboard /></Protected>} />
          <Route path="/learn/:id" element={<Protected><Learn /></Protected>} />
          <Route path="/reviews" element={<Protected><ReviewsPage /></Protected>} />
          <Route path="/checkout/:id" element={<Protected><Checkout /></Protected>} />
          <Route path="/admin" element={<Protected admin><Admin /></Protected>} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </main>
      <Footer />
    </div>
  );
}
