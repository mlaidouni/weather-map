import React, { useEffect, useState } from 'react';
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMap,
  ZoomControl,
  Polyline,
} from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { LatLngExpression } from 'leaflet';

interface MapProps {
  center: LatLngExpression;
  zoom: number;
}

const MapResizeHandler: React.FC = () => {
  const map = useMap();

  useEffect(() => {
    const currentCenter = map.getCenter();

    const timeoutId = setTimeout(() => {
      map.invalidateSize({ animate: true, pan: false });

      setTimeout(() => {
        map.panTo(currentCenter);

        const currentBounds = map.getBounds();
        map.panInsideBounds(currentBounds.pad(0.1), { animate: false });

        map.invalidateSize({ animate: false });
      }, 200);
    }, 100);

    return () => clearTimeout(timeoutId);
  }, [map]);

  return null;
};

/**
 * Composant React principal pour afficher la carte Leaflet.
 * Gère l'affichage des arrêts, des itinéraires et les interactions utilisateur.
 * @param {MapProps} props - Les propriétés du composant.
 * @returns {JSX.Element} Le composant de la carte (implémentation non fournie dans ce snippet).
 */
const MapCard: React.FC<MapProps> = ({
  center,
  zoom
}) => {
  return (
    <div className="map-container w-full h-screen">
      <MapContainer
        center={center}
        zoom={zoom}
        scrollWheelZoom={true}
        zoomControl={false}
        style={{ height: '100%', width: '100%' }}
        className="z-0"
      >
        <MapResizeHandler />
        <ZoomControl position="topright" />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url={'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'}
        />     
      </MapContainer>
    </div>
  );
};

export default MapCard;
