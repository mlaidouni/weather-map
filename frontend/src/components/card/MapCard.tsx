import React, { useEffect, useState } from 'react';
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMap,
  ZoomControl,
  Polyline,
  useMapEvents,
  Polygon,
} from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { LatLngExpression, Icon } from 'leaflet';
import L from 'leaflet';

import { RouteData } from "@/types/routes";

const apikey = import.meta.env.VITE_OPEN_WEATHER_API_KEY;


const startIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const endIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

L.Marker.prototype.options.icon = startIcon;

interface MapProps {
  center: LatLngExpression;
  zoom: number;
  showTempLayer?: boolean;
  showRainLayer?: boolean;
  routes: RouteData[];
  smallZones?: Array<{
    latMin: number;
    latMax: number;
    lonMin: number;
    lonMax: number;
  }>;
  startPin?: LatLngExpression | null;
  endPin?: LatLngExpression | null;
  onMapClick: (e: any) => void;
}

interface MapSettingsUpdaterProps {
  useOnlineTiles: boolean;
}
function RecenterOnPropChange({ //Fonction qui permet de recentrer la carte dynamiquement 
  center,
  zoom,
}: {
  center: LatLngExpression;
  zoom: number;
}) {
  const map = useMap();
  useEffect(() => {
    map.flyTo(center as any, zoom, { duration: 0.7 }); // ou map.setView(center as any, zoom)
  }, [center, zoom, map]);
  return null;
}

function MapClickHandler({ onMapClick }: { onMapClick: (e: any) => void }) {
  useMapEvents({
    click: (e) => {
      onMapClick(e);
    },
  });
  return null;
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
  zoom,
  showTempLayer = false,
  showRainLayer = false,
  routes = [],
  smallZones = [],
  startPin = null,
  endPin = null,
  onMapClick,
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
        <MapClickHandler onMapClick={onMapClick} />
        <ZoomControl position="topright" />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url={'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'}
        />
        {showTempLayer && (
          <TileLayer
            url={`https://tile.openweathermap.org/map/temp_new/{z}/{x}/{y}.png?appid=${apikey}`}
            attribution="&copy; OpenWeatherMap"
            opacity={0.8}
          />
        )}
        {showRainLayer && (
          <TileLayer
            url={`https://tile.openweathermap.org/map/precipitation_new/{z}/{x}/{y}.png?appid=${apikey}`}
            attribution="&copy; OpenWeatherMap"
            opacity={1.0}
          />
        )}

        {/* Afficher les petites zones */}
        {smallZones.map((smallZone, index) => {
          
          const zoneCoords: LatLngExpression[] = [
            [smallZone.latMin, smallZone.lonMin],
            [smallZone.latMin, smallZone.lonMax],
            [smallZone.latMax, smallZone.lonMax],
            [smallZone.latMax, smallZone.lonMin],
            [smallZone.latMin, smallZone.lonMin],
          ];
          
          return (
            <Polygon
              key={`small-zone-${index}`}
              positions={zoneCoords}
              pathOptions={{
                color: 'rgba(220, 53, 69, 0.7)',
                fillColor: 'rgba(220, 53, 69, 0.3)',
                weight: 1,
                fillOpacity: 0.2,
                opacity: 0.7
              }}
            >
              <Popup>
                Zone {index + 1}<br/>
                Lat: {smallZone.latMin.toFixed(4)} - {smallZone.latMax.toFixed(4)}<br/>
                Lon: {smallZone.lonMin.toFixed(4)} - {smallZone.lonMax.toFixed(4)}
              </Popup>
            </Polygon>
            );
        })}
        {routes && routes.length > 0 && routes.map((route, index) => (
          <Polyline
            key={route.id}
            positions={route.coordinates}
            pathOptions={{
              color: ["#3b82f6", "#10b981", "#8b5cf6", "#ef4444", "#f59e0b"][index % 5],
              // Increase minimum weight for better visibility
              weight: Math.max(4, 7 - index), // Minimum weight of 4 for all routes
              // Keep higher opacity for better visibility
              opacity: Math.max(0.6, 0.9 - (index * 0.1)),
              // Adjust dash patterns for better visibility
              dashArray: index === 0 ? undefined :
                        index === 1 ? "10, 10" :  // Longer dashes
                        index === 2 ? "5, 5" :    // Medium dashes
                        "15, 10",                 // Long dash, short gap
              lineCap: "round",
              lineJoin: "round"
            }}
          />
        ))}

        {/* Afficher le point de départ s'il existe */}
        {startPin && (
          <Marker position={startPin} icon={startIcon}>
            <Popup>
              Point de départ<br />
              Position: {(startPin as [number, number])[0].toFixed(5)}, {(startPin as [number, number])[1].toFixed(5)}
            </Popup>
          </Marker>
        )}

        {/* Afficher le point d'arrivée s'il existe */}
        {endPin && (
          <Marker position={endPin} icon={endIcon}>
            <Popup>
              Point d'arrivée<br />
              Position: {(endPin as [number, number])[0].toFixed(5)}, {(endPin as [number, number])[1].toFixed(5)}
            </Popup>
          </Marker>
        )}

        <RecenterOnPropChange center={center} zoom={zoom} />
      </MapContainer>
    </div>
  );
};


export default MapCard;
