import React, { useEffect } from "react";
import {
	MapContainer,
	TileLayer,
	Marker,
	Popup,
	useMap,
	ZoomControl,
	Polyline,
	useMapEvents,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L, { LatLngExpression } from "leaflet";

const apikey = import.meta.env.VITE_OPEN_WEATHER_API_KEY;

const startIcon = L.icon({
	iconUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png",
	shadowUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png",
	iconSize: [25, 41],
	iconAnchor: [12, 41],
	popupAnchor: [1, -34],
	shadowSize: [41, 41],
});

const endIcon = L.icon({
	iconUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png",
	shadowUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png",
	iconSize: [25, 41],
	iconAnchor: [12, 41],
	popupAnchor: [1, -34],
	shadowSize: [41, 41],
});

L.Marker.prototype.options.icon = startIcon;

interface MapProps {
	center: LatLngExpression;
	zoom: number;
	showTempLayer?: boolean;
	showRainLayer?: boolean;
	showCloudLayer?: boolean;
	showWindLayer?: boolean;
	listStops?: LatLngExpression[];
	startCoord?: LatLngExpression | null;
	endCoord?: LatLngExpression | null;
	onMapClick: (e: any) => void;
}

interface MapSettingsUpdaterProps {
	useOnlineTiles: boolean;
}

// Fonction qui permet de recentrer la carte dynamiquement
function RecenterOnPropChange({
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
	showCloudLayer = false,
	showWindLayer = false,
	listStops = [],
	startCoord = null,
	endCoord = null,
	onMapClick,
}) => {
	return (
		<div className="map-container w-full h-screen">
			<MapContainer
				center={center}
				zoom={zoom}
				scrollWheelZoom={true}
				zoomControl={false}
				style={{ height: "100%", width: "100%" }}
				className="z-0"
			>
				<MapResizeHandler />
				<MapClickHandler onMapClick={onMapClick} />
				<ZoomControl position="topright" />
				<TileLayer
					attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
					url={"https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"}
				/>
				{showTempLayer && (
					<TileLayer
						url={`https://tile.openweathermap.org/map/temp_new/{z}/{x}/{y}.png?appid=${apikey}`}
						attribution="&copy; OpenWeatherMap"
						opacity={1.0}
					/>
				)}
				
				{showRainLayer && (
					<TileLayer
						url={`https://tile.openweathermap.org/map/precipitation_new/{z}/{x}/{y}.png?appid=${apikey}`}
						attribution="&copy; OpenWeatherMap"
						opacity={1.0}
					/>
				)}

				{showCloudLayer && (
					<TileLayer
						url={`https://tile.openweathermap.org/map/clouds_new/{z}/{x}/{y}.png?appid=${apikey}`}
						attribution="&copy; OpenWeatherMap"
						opacity={1.0}
					/>
				)}

				{showWindLayer && (
					<TileLayer
						url={`https://tile.openweathermap.org/map/wind_new/{z}/{x}/{y}.png?appid=${apikey}`}
						attribution="&copy; OpenWeatherMap"
						opacity={1.0}
					/>
				)}

				{listStops.length > 0 && <Polyline positions={listStops} color="red" />}

				{/* Afficher le point de départ s'il existe */}
				{startCoord && (
					<Marker position={startCoord} icon={startIcon}>
						<Popup>
							Point de départ
							<br />
							Position: {(startCoord as [number, number])[0].toFixed(5)},{" "}
							{(startCoord as [number, number])[1].toFixed(5)}
						</Popup>
					</Marker>
				)}

				{/* Afficher le point d'arrivée s'il existe */}
				{endCoord && (
					<Marker position={endCoord} icon={endIcon}>
						<Popup>
							Point d'arrivée
							<br />
							Position: {(endCoord as [number, number])[0].toFixed(5)},{" "}
							{(endCoord as [number, number])[1].toFixed(5)}
						</Popup>
					</Marker>
				)}

				<RecenterOnPropChange center={center} zoom={zoom} />
			</MapContainer>
		</div>
	);
};

export default MapCard;
