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
import { LatLngExpression, LatLngBoundsExpression } from 'leaflet';

const franceBounds: LatLngBoundsExpression = [
  [42.86724335803936, -5.115694769961799], // Coin sud-ouest (lat, lng)
  [50.889126785527864, 8.550363242396145], // Coin nord-est (lat, lng)
];

const idfBounds: LatLngBoundsExpression = [
  [48.46, 1.76], // Coin sud-ouest (lat, lng)
  [49.153, 3.16], // Coin nord-est (lat, lng)
];

interface MapProps {
  center: LatLngExpression;
  zoom: number;
}

interface MapSettingsUpdaterProps {
  useOnlineTiles: boolean;
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
  const [useOnlineTiles, setUseOnlineTiles] = useState<boolean>(false);
  const [markers, setMarkers] = useState<LatLngExpression[]>([]);

  useEffect(() => {
    const checkOnlineTiles = async () => {
      const response = await fetch(
        'https://a.tile.openstreetmap.org/0/0/0.png',
        {
          method: 'HEAD',
          cache: 'no-store',
          signal: AbortSignal.timeout(2000), // 2 second timeout
        }
      );
    };

    checkOnlineTiles();

    const intervalId = setInterval(checkOnlineTiles, 3000);

    return () => {
      clearInterval(intervalId);
    };
  }, [useOnlineTiles]);

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
