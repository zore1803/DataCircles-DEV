import { Navigate } from 'react-router-dom';
import { useAuth0 } from '@auth0/auth0-react';

function AuthRoute({ children }) {
  const { isAuthenticated } = useAuth0();
  return isAuthenticated ? <Navigate to="/" /> : children;
}

export default AuthRoute;