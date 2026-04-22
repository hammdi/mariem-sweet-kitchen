import { Outlet } from 'react-router-dom'
import { Box } from '@mui/material'

const AuthLayout = () => {
  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        background: 'linear-gradient(135deg, #fef7ee 0%, #fad7a5 100%)',
      }}
    >
      <Outlet />
    </Box>
  )
}

export default AuthLayout
