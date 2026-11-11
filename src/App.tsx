import { LogOut, ShieldAlert } from 'lucide-react';
import { lazy, Suspense, type ReactNode } from 'react';
import { createBrowserRouter, Link, Navigate, Outlet, RouterProvider, useLocation } from 'react-router';
import { AuthProvider, useAuth } from './auth/AuthProvider';
import { AppShell } from './components/AppShell';
import { PrototypeNotice } from './components/PrototypeNotice';
import { ErrorState, LoadingState } from './components/States';
import { FiltersProvider } from './filters/FiltersProvider';
import { LoginPage } from './pages/LoginPage';
import { OverviewPage } from './pages/OverviewPage';

const DepartmentsPage = lazy(() => import('./pages/DepartmentsPage').then((m) => ({ default: m.DepartmentsPage })));
const FacultyPage = lazy(() => import('./pages/FacultyPage').then((m) => ({ default: m.FacultyPage })));
const TargetsPage = lazy(() => import('./pages/TargetsPage').then((m) => ({ default: m.TargetsPage })));
const AboutPage = lazy(() => import('./pages/AboutPage').then((m) => ({ default: m.AboutPage })));

function FullPage({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <PrototypeNotice />
      <div className="flex flex-1 items-center justify-center p-6">{children}</div>
    </div>
  );
}

/** Route guard: only signed-in users with a dashboard profile get past here. */
function RequireAuth() {
  const { status, error, retry, signOut } = useAuth();
  const location = useLocation();

  if (status === 'loading') {
    return (
      <FullPage>
        <LoadingState label="Checking your session…" />
      </FullPage>
    );
  }
  if (status === 'signed_out') return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  if (status === 'error' && error) {
    return (
      <FullPage>
        <ErrorState error={error} onRetry={retry} />
      </FullPage>
    );
  }
  if (status === 'no_profile') {
    return (
      <FullPage>
        <div className="card max-w-md p-6 text-center" data-testid="access-denied">
          <ShieldAlert className="mx-auto text-critical" size={28} aria-hidden />
          <h1 className="mt-3 text-lg font-semibold text-ink">Access denied</h1>
          <p className="mt-2 text-sm text-ink-2">
            This dashboard is restricted to <strong className="text-ink">authorized academic administrators</strong>. Your account signed in
            successfully, but it is not authorized, so the database returns no student, grade or SETE data to it.
          </p>
          <button type="button" className="btn btn-ghost mt-5" onClick={() => void signOut()}>
            <LogOut size={15} aria-hidden /> Sign out
          </button>
        </div>
      </FullPage>
    );
  }
  return (
    <FiltersProvider>
      <Outlet />
    </FiltersProvider>
  );
}

function PageFallback() {
  return <LoadingState label="Loading page…" minHeight={400} />;
}

function NotFound() {
  return (
    <div className="card mx-auto max-w-lg p-8 text-center">
      <p className="text-sm font-semibold text-accent">404</p>
      <h1 className="mt-1 text-xl font-semibold text-ink">Page not found</h1>
      <p className="mt-2 text-sm text-ink-2">The page you requested does not exist.</p>
      <Link to="/" className="btn btn-primary mt-5">
        Back to overview
      </Link>
    </div>
  );
}

const lazyPage = (node: ReactNode) => <Suspense fallback={<PageFallback />}>{node}</Suspense>;

const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppShell />,
        children: [
          { index: true, element: <OverviewPage /> },
          { path: 'departments', element: lazyPage(<DepartmentsPage />) },
          { path: 'faculty', element: lazyPage(<FacultyPage />) },
          { path: 'targets', element: lazyPage(<TargetsPage />) },
          { path: 'about', element: lazyPage(<AboutPage />) },
          { path: '*', element: <NotFound /> },
        ],
      },
    ],
  },
]);

export default function App() {
  return (
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  );
}
