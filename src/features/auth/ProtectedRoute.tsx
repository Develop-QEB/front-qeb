import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { Spinner } from '../../components/ui/spinner';
import { MAINTENANCE_MODE, isUserAllowedDuringMaintenance } from '../../config/maintenance';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const user = useAuthStore((state) => state.user);
  const hasHydrated = useAuthStore((state) => state._hasHydrated);
  const location = useLocation();

  // Wait for Zustand to hydrate from localStorage before checking auth
  if (!hasHydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (
    MAINTENANCE_MODE &&
    location.pathname !== '/mantenimiento' &&
    user &&
    !isUserAllowedDuringMaintenance(user.rol)
  ) {
    return <Navigate to="/mantenimiento" replace />;
  }

  return <>{children}</>;
}
