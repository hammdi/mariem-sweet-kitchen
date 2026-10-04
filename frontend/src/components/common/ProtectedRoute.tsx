import { Navigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { RootState } from '../../store/store';
import AdminLayout from '../layout/AdminLayout';

export default function ProtectedRoute() {
  const { isAuthenticated } = useSelector((state: RootState) => state.auth);

  if (!isAuthenticated) {
    return <Navigate to="/auth/login" replace />;
  }

  // Ossature admin : menu, indicateurs du jour, aide interactive ✨
  return <AdminLayout />;
}
