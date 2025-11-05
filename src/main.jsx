import './lib/fetchBase.js'
import './dev/guardRemoteSync.js'
import './dev/disableRemoteSync.js'
import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'
import { AuthProvider } from './AuthContext.jsx'
import LogoutOverlay from './LogoutOverlay.jsx'
import RoleRouter from './RoleRouter.jsx'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <RoleRouter />
      <LogoutOverlay />
    </AuthProvider>
  </React.StrictMode>,
)
