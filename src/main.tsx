import { StrictMode } from 'react'
   import { createRoot } from 'react-dom/client'
   import './index.css'
   import BasketballERPApp from './App.tsx'

   createRoot(document.getElementById('root')!).render(
     <StrictMode>
       <BasketballERPApp />
     </StrictMode>,
   )