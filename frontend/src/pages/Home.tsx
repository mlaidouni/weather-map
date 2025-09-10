import React, { useEffect, useState } from "react";
import MapCard from "../components/card/MapCard";
import L, { LatLngExpression } from "leaflet";
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "@/components/ui/command";
import { ChevronRightIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import MapFilterCard from "@/components/card/MapFilterCard";
import { useLocationSuggestions } from "../hooks/useLocationSuggestions";
import { Marker } from "react-leaflet";
import { RouteData } from "@/types/routes";
import { Area } from "@/types/area";

const markerIcon = L.icon({
	iconUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png",
	shadowUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png",
	iconSize: [25, 41],
	iconAnchor: [12, 41],
	popupAnchor: [1, -34],
	shadowSize: [41, 41],
});

// Import Sheet shadcn/ui
import {
	Sheet,
	SheetContent,
	SheetHeader,
	SheetTitle,
} from "@/components/ui/sheet";

const Home: React.FC = () => {
	const [center, setCenter] = useState<LatLngExpression>([48.86, 2.33]);
	const [zoom, setZoom] = useState(12);
	const [open, setOpen] = useState(false); // toggle barre de recherche
	const [query, setQuery] = useState("");

	const [tempselected, setTempSelected] = useState(0);
	const [rainselected, setRainSelected] = useState(0);

	// état pour la Sheet
	const [isSheetOpen, setIsSheetOpen] = useState(false);

	const suggestions = useLocationSuggestions(query);
	const [startPin, setStartPin] = useState<LatLngExpression | null>(null);
	const [endPin, setEndPin] = useState<LatLngExpression | null>(null);

	const [routes, setRoutes] = useState<RouteData[]>([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const [areas, setAreas] = useState<Area[]>([]);

	const handleMapClick = (e: any) => {
		const { lat, lng } = e.latlng;

		// Si le point de départ n'est pas défini, on le définit
		if (!startPin) {
			setStartPin([lat, lng]);
		}
		// Sinon, si le point d'arrivée n'est pas défini, on le définit
		else if (!endPin) {
			setEndPin([lat, lng]);
		}
		// Si les deux sont définis, on réinitialise le point de départ et on efface le point d'arrivée
		else {
			clearPoints();
		}
	};

	const clearPoints = () => {
		setRoutes([]);
		setError(null);
		setAreas([]);

		setStartPin(null);
		setEndPin(null);
	};

	// Appel au backend pour calculer l'itinéraire quand les deux pins sont définis
	useEffect(() => {
		if (startPin && endPin) {
			fetchRoute();
		}
	}, [startPin, endPin]);

	const fetchRoute = async () => {
		if (!startPin || !endPin) return;

		setLoading(true);
		setError(null);

		try {

			// Conversion des pins en coordonnées lat/lng pour l'API
			const startLatLng = L.latLng(startPin);
			const endLatLng = L.latLng(endPin);
			const urlRainZones = `/api/weather/rain/zone?startLat=${startLatLng.lat}&startLng=${startLatLng.lng}&endLat=${endLatLng.lat}&endLng=${endLatLng.lng}`;
			const responseRainZones = await fetch(urlRainZones);

			if (!responseRainZones.ok) {
				throw new Error(`Erreur API: ${responseRainZones.status}`);
			}

			const rainingZonesMap = await responseRainZones.json();
			const rainingZones = rainingZonesMap.polygons;

			// raining_zones is ALWAYS: [ [ [lat,lng], [lat,lng], ... ],  ... ]
			if (Array.isArray(rainingZones)) {
				const polygons: Area[] = rainingZones
					.map((poly: any) => {
						if (!Array.isArray(poly)) return null;

						const coords = poly
							.map((pt: any) => {
								if (Array.isArray(pt) && pt.length >= 2) {
									const lat = Number(pt[0]);
									const lng = Number(pt[1]);
									if (!isNaN(lat) && !isNaN(lng)) return [lat, lng] as LatLngExpression;
								}
								return null;
							})
							.filter(Boolean) as LatLngExpression[];

						if (!coords.length) return null;

						// Optionally close polygon if not closed
						const first = coords[0];
						const last = coords[coords.length - 1];
						if (first[0] !== last[0] || first[1] !== last[1]) {
							coords.push(first);
						}

						return {
							coordinates: coords,
							isRaining: true
						} as Area;
					})
					.filter(Boolean) as Area[];

				setAreas(polygons);
			}

			// Construction de l'URL avec les paramètres
			const url = `/api/routing/weather-aware?startLat=${startLatLng.lat}&startLng=${startLatLng.lng}&endLat=${endLatLng.lat}&endLng=${endLatLng.lng}&avoidConditions=rain`;
			const response = await fetch(url);

			if (!response.ok) {
				throw new Error(`Erreur API: ${response.status}`);
			}

			const data = await response.json();
			const apiRoutes = data.routes;

			if (!apiRoutes || apiRoutes.length === 0) {
				setError("Aucun itinéraire trouvé");
				return;
			}

			// Traitement des données de l'itinéraire
			if (Array.isArray(apiRoutes) && apiRoutes.length > 0) {
				const processedRoutes: RouteData[] = apiRoutes.map((route, index) => {
					// Process coordinates
					const coordinates = route.coordinates
						.map((coord: number[]) => {
							const lat = Number(coord[0]);
							const lng = Number(coord[1]);

							if (isNaN(lat) || isNaN(lng)) {
								console.error("Coordonnée invalide:", coord);
								return null;
							}
							return [lat, lng] as LatLngExpression;
						})
						.filter(Boolean);

					// Calculate distance in km (rounded to 1 decimal)
					const distance = route.distance
						? Math.round(route.distance / 1000 * 10) / 10
						: 0;

					// Calculate duration in minutes
					const duration = route.duration
						? Math.round(route.duration / 60)
						: 0;

					return {
						id: `route-${index}`,
						coordinates,
						distance,
						duration
					};
				});

				setRoutes(processedRoutes);
			}
			else {
				setError("Format de données invalide");
			}
		}
		catch (err) {
			console.error("Erreur lors de la récupération de l'itinéraire:", err);
			setError("Impossible de calculer l'itinéraire");
		}
		finally {
			setLoading(false);
		}
	};


	return (
		<div className="relative w-full h-full">
			{/* Bouton toggle pour la barre de recherche */}
			<Button
				variant="secondary"
				size="icon"
				className="size-8 absolute top-4 left-4 z-10"
				onClick={() => setOpen((prev) => !prev)}
			>
				<ChevronRightIcon
					className={`transition-transform duration-300 ${open ? "rotate-90" : ""
						}`}
				/>
			</Button>
			{/* Barre de recherche en haut à gauche */}
			<div
				className={`absolute top-4 left-16 z-10 transition-all duration-300 ${open ? "w-64 opacity-100" : "w-0 opacity-0"
					} overflow-hidden`}
			>
				<Command>
					<CommandInput
						placeholder="Search city..."
						value={query}
						onValueChange={setQuery}
					/>
					<CommandList>
						<CommandGroup heading="Suggestions">
							{suggestions.map((s, idx) => (
								<CommandItem
									key={idx}
									value={s.label}
									onSelect={() => {
										// On masque les suggestions
										setOpen(false);
										const coord = s.coordinates as LatLngExpression;
										setCenter(coord);
										setZoom(13);
										setQuery(s.label);
										setIsSheetOpen(true); // ouvrir la sheet
										// TODO: set Start Coord
									}}
								>
									{s.label}
								</CommandItem>
							))}
						</CommandGroup>
						<CommandEmpty>No results found.</CommandEmpty>
					</CommandList>
				</Command>
			</div>

			{/* Filtres */}
			<div className="absolute top-4 right-20 z-10 flex flex-row gap-2">
				<MapFilterCard
					setSelected={setTempSelected}
					selected={tempselected}
					img={"soleil.png"}
				/>
				<MapFilterCard
					setSelected={setRainSelected}
					selected={rainselected}
					img={"pluie.png"}
				/>
			</div>

			{/* Carte */}
			<div className="w-full h-full">
				<MapCard
					center={center}
					zoom={zoom}
					showTempLayer={!!tempselected}
					showRainLayer={!!rainselected}
					routes={routes}
					areas={areas}
					startPin={startPin}
					endPin={endPin}
					onMapClick={handleMapClick}
				/>
			</div>

			{/* Sheet vierge */}
			<Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
				<SheetContent side="left" className="w-[380px] sm:w-[420px]">
					<SheetHeader>
						<SheetTitle>{query}</SheetTitle>
					</SheetHeader>
				</SheetContent>
			</Sheet>
		</div>
	);
};

export default Home;
