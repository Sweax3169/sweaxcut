import React from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/mona-sans/standard.css'
import '@fontsource-variable/geist-mono/index.css'
import './ui/styles/base.css'
import './ui/styles/app.css'
import './packs/index.js'
import App from './ui/App.jsx'

createRoot(document.getElementById('root')).render(<App />)
