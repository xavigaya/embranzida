import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/big-shoulders-display/wght'
import '@fontsource/atkinson-hyperlegible/latin-400'
import '@fontsource/atkinson-hyperlegible/latin-700'
import '@fontsource/atkinson-hyperlegible/latin-ext-400'
import '@fontsource/atkinson-hyperlegible/latin-ext-700'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
