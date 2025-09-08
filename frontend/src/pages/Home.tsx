import React from 'react';

import MapCard from '../components/card/MapCard';

import { LatLngExpression } from 'leaflet';

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
