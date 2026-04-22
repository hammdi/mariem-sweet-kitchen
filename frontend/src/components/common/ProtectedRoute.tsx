import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { RootState } from '../../store/store'
import AiAssistant from '../admin/AiAssistant'

export default function ProtectedRoute() {
  const { isAuthenticated } = useSelector((state: RootState) => state.auth)
  const location = useLocation()

  if (!isAuthenticated) {
    return <Navigate to="/auth/login" replace />
  }

  // Nom de page lisible pour le contexte IA
  const pageName = location.pathname.replace('/admin', '').replace('/', '') || 'dashboard'

  return (
    <>
      <Outlet />
      <AiAssistant page={pageName} />
    </>
  )
}
