import { Navigate } from 'react-router-dom';

function SuperAdminPrivateRoute({ children }) {
  const isSuperAdminAuthenticated = !!localStorage.getItem('superAdminToken');

  return isSuperAdminAuthenticated ? children : <Navigate to="/super-admin/login" replace />;
}

export default SuperAdminPrivateRoute;