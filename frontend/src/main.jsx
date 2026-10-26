import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import DialogosProvider from './components/DialogosProvider.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <DialogosProvider>
        <App />
      </DialogosProvider>
    </AuthProvider>
  </StrictMode>,
)