import { LogOut, ShieldAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import { createBrowserRouter, Link, Navigate, Outlet, RouterProvider } from 'react-router';
import { AuthProvider, useAuth } from './auth/AuthProvider';
import { AppShell } from './components/AppShell';
import { PrototypeNotice } from './components/PrototypeNotice';
import { ErrorState, LoadingState } from './components/States';
import { FiltersProvider } from './filters/FiltersProvider';
import { LoginPage } from './pages/LoginPage';
import { OverviewPage } from './pages/OverviewPage';

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

  if (status === 'loading') {
    return (
      <FullPage>
        <LoadingState label="Checking your session…" />
      </FullPage>
    );
  }
  if (status === 'signed_out') return <Navigate to="/login" replace />;
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

function NotFound() {
  return (
    <div className="card mx-auto max-w-lg p-8 text-center">
      <p className="text-sm font-semibold text-accent">404</p>
      <h1 className="mt-1 text-xl font-semibold text-ink">Page not found</h1>
      <p className="mt-2 text-sm text-ink-2">The page you requested does not exist.</p>
      <Link to="/dashboard" className="btn btn-primary mt-5">
        Back to overview
      </Link>
    </div>
  );
}

const router = createBrowserRouter([
  { path: '/', element: <Navigate to="/login" replace /> },
  { path: '/login', element: <LoginPage /> },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppShell />,
        children: [
          { path: 'dashboard', element: <OverviewPage /> },
          { path: 'departments', element: <Navigate to="/dashboard" replace /> },
          { path: 'faculty', element: <Navigate to="/dashboard" replace /> },
          { path: 'targets', element: <Navigate to="/dashboard" replace /> },
          { path: 'about', element: <Navigate to="/dashboard" replace /> },
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
