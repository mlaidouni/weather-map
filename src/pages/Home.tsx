import React from 'react';

import MapCard from '../components/card/MapCard';

import { LatLngExpression } from 'leaflet';

/**
 * Composant principal de la page d'accueil.
 * Affiche une carte interactive avec les arrêts et potentiellement une ligne de transport.
 *
 * @param arrets - Liste des étapes (arrêts) à afficher sur la carte.
 * @param setPosition - Fonction pour définir l'arrêt de départ sélectionné.
 * @param setDestination - Fonction pour définir l'arrêt de destination sélectionné.
 * @param lineDetails - Détails de la ligne à afficher sur la carte (optionnel).
 * @param disableMapClicks - Booléen pour désactiver les clics sur la carte (par défaut `false`).
 * @returns Le composant de la page d'accueil.
 */
const Home : React.FC = () => {
  const mapCenter: LatLngExpression = [48.86, 2.33];

  return (
    <div className="w-full h-full">
      <MapCard
        center={mapCenter}
        zoom={14}
      />
    </div>
  );
};

export default Home;
