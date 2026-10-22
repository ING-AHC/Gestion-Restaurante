import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { rutaInicial } from '../utils/roles';

function RutaRol({ roles, children }) {
  const { user } = useAuth();
  const rol = user?.rol || 'admin';

  if (!roles.includes(rol)) {
    return <Navigate to={rutaInicial(rol)} replace />;
  }

  return children;
}

export default RutaRol;