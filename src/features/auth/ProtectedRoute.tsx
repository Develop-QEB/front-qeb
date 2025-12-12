import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { Spinner } from '../../components/ui/spinner';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const hasHydrated = useAuthStore((state) => state._hasHydrated);
  const location = useLocation();

  console.log('[ProtectedRoute] hasHydrated:', hasHydrated, 'isAuthenticated:', isAuthenticated, 'path:', location.pathname);

  // Wait for Zustand to hydrate from localStorage before checking auth
  if (!hasHydrated) {
    console.log('[ProtectedRoute] Waiting for hydration...');
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!isAuthenticated) {
    console.log('[ProtectedRoute] Not authenticated, redirecting to login');
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  console.log('[ProtectedRoute] Authenticated, rendering children');
  return <>{children}</>;
}
