import React from 'react'
import { Route, Routes } from 'react-router-dom'
import Home from './pages/Home'

/**
 * Composant de mise en page principale de l'application.
 * Il définit la structure des routes et le layout commun à toutes les pages.
 *
 * @returns Le composant Layout avec les routes configurées
 */
const Layout: React.FC = () => {
  return (
    <div className="layout-container">
      <main className="main-content">
        <Routes>
          <Route path="/" element={<Home />} />
          {/* Add more routes here */}
        </Routes>
      </main>
    </div>
  )
}

export default Layout