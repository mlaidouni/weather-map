import React from 'react'
import { BrowserRouter } from 'react-router-dom'
import Layout from './Layout'

/**
 * Composant principal pour la configuration des routes de l'application.
 * Il initialise `BrowserRouter` et affiche le composant `Layout`.
 *
 * @returns Le composant `AppRoutes` avec le routeur et la mise en page.
 */
function AppRoutes() {
  return (
    <BrowserRouter>
      <Layout />
    </BrowserRouter>
  )
}

export default AppRoutes
