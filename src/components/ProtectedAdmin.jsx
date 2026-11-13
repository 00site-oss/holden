import { Navigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';

export default function ProtectedAdmin({ children }) {
  const { me, loading } = useApp();

  if (loading) return <div className="card gate"><i className="fas fa-spinner fa-spin"></i><h3>Loading...</h3></div>;

  if (!me || !me.isAdmin) {
    return <Navigate to="/" replace />;
  }

  return children;
}
