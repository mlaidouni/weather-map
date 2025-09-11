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
import {
	ChevronRightIcon,
	Thermometer,
	Droplets,
	Wind,
	Cloud,
	CloudFog,
	CloudDrizzle,
	CloudRainWind,
	ChevronLeftIcon,
	TriangleAlert,
	Loader2,
	CircleX,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import MapFilterCard from "@/components/card/MapFilterCard";
import { useLocationSuggestions } from "../hooks/useLocationSuggestions";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
} from "@/components/ui/sheet";
import { fetchMeteoFromLocation, fetchRainZones } from "@/api/weather";
import { fetchRoutingWeatherAware } from "@/api/routing";
import { LocationData } from "@/types/locationData";
import { Suggestion } from "@/types/suggestion";
import { Area } from "@/types/area";
import { RouteData } from "@/types/routes";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel } from "@/components/ui/sidebar";
import { SidebarProvider } from "@/components/ui/sidebar";

const Home: React.FC = () => {
	/// ---- États ----
	// Map
	const [center, setCenter] = useState<LatLngExpression>([48.86, 2.33]);
	const [zoom, setZoom] = useState(12);
	// Filtre de la map
	const [isTempMapSelected, setIsTempMapSelected] = useState(0);
	const [isRainMapSelected, setIsRainMapSelected] = useState(0);
	const [isCloudMapSelected, setIsCloudMapSelected] = useState(0);
	const [isWindMapSelected, setIsWindMapSelected] = useState(0);
	const [routeFilteredByRain, setRouteFilteredByRain] = useState(false);

	// Recherche et Search bar
	const [isRouteSearchBarOpen, setIsRouteSearchBarOpen] = useState(false);
	const [queryStart, setQueryStart] = useState("");
	const [queryEnd, setQueryEnd] = useState("");
	const suggestionsStart = useLocationSuggestions(queryStart);
	const suggestionsEnd = useLocationSuggestions(queryEnd);
	const [showSuggestionStart, setShowSuggestionStart] = useState(true);
	const [showSuggestionEnd, setShowSuggestionEnd] = useState(true);

	// Localisation sélectionnée
	const [startLocation, setStartLocation] = useState<LocationData | null>(null);
	const [endLocation, setEndLocation] = useState<LocationData | null>(null);

	// Itinéraire
	const [routes, setRoutes] = useState<RouteData[]>([]);
	const [routeLoading, setRouteLoading] = useState(false);
	const [routeError, setRouteError] = useState<string | null>(null);
	const [areas, setAreas] = useState<Area[]>([]);

	// Sheet
	const [isSheetOpen, setIsSheetOpen] = useState(false);

	// Météo
	const [meteoLoading, setMeteoLoading] = useState(false);
	const [meteoError, setMeteoError] = useState<string | null>(null);

	/// ---- Fonctions ----
	// Nettoie les points sur la carte ET les données de localisation
	const clearPoints = () => {
		// FIXME: Doit gérer aussi l'affichage des barre, sheet, etc.
		setStartLocation(null);
		setEndLocation(null);
		setRoutes([]);
		setAreas([]);
		setRouteError(null);
		setRouteLoading(false);
	};

	// Appel au backend pour calculer l'itinéraire
	const fetchRoute = async () => {
		if (!startLocation || !endLocation) return;

		setRouteLoading(true);
		setRouteError(null);

		try {
			// Conversion des pins en coordonnées lat/lng pour l'API
			const startLatLng = L.latLng(
				startLocation.latitude,
				startLocation.longitude
			);
			const endLatLng = L.latLng(endLocation.latitude, endLocation.longitude);

			const rainingZonesMap = await fetchRainZones(startLatLng, endLatLng);
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
						const first = coords[0] as [number, number];
						const last = coords[coords.length - 1] as [number, number];
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

			const data = await fetchRoutingWeatherAware(startLatLng, endLatLng);

			const apiRoutes = data.routes;

			if (!apiRoutes || apiRoutes.length === 0) {
				setRouteError("Aucun itinéraire trouvé");
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
				setRouteError("Format de données invalide");
			}
		}
		catch (err) {
			console.error("Erreur lors de la récupération de l'itinéraire:", err);
			setRouteError("Impossible de calculer l'itinéraire");
		}
		finally {
			setRouteLoading(false);
		}
	};

	// Mis à jour de la météo quand la localisation change
	const fetchMeteo = async (loc: LocationData, setLoc: React.Dispatch<React.SetStateAction<LocationData | null>>) => {
		try {
			setLoc((prev) => (prev ? { ...prev, meteo: undefined } : prev));
			setMeteoError(null);
			setMeteoLoading(true);
			const data: MeteoData = await fetchMeteoFromLocation(
				loc.latitude,
				loc.longitude
			);
			setLoc((prev) => (prev ? { ...prev, meteo: data } : prev));
		} catch (e) {
			console.error(e);
			setMeteoError("Impossible de récupérer la météo.");
		} finally {
			setMeteoLoading(false);
		}
	};

	const onSelectSuggestionStart = async (s: Suggestion) => {
		setQueryStart(s.label);
		setShowSuggestionStart(false);
		setStartLocation({
			name: s.label,
			latitude: s.coordinates[0],
			longitude: s.coordinates[1],
		});

		setCenter(s.coordinates as LatLngExpression);
		setZoom(13);

		// Ouvre la sheet et prépare affichage
		setIsSheetOpen(true);
		setMeteoError(null);
		setMeteoLoading(true);
	};

	const onSelectSuggestionEnd = async (s: Suggestion) => {
		setQueryEnd(s.label);
		setShowSuggestionEnd(false);
		setEndLocation({
			name: s.label,
			latitude: s.coordinates[0],
			longitude: s.coordinates[1],
		});

		setCenter(s.coordinates as LatLngExpression);
		setZoom(13);

		// Ouvre la sheet et prépare affichage
		setIsSheetOpen(true);
		setMeteoError(null);
		setMeteoLoading(true);
	};

	/// ---- Effets ----
	const handleMapClick = (e: any) => {
		const { lat, lng } = e.latlng;

		// FIXME: Doit ouvrir la barre de recherche d'itinéraire si fermée

		// Si le point de départ n'est pas défini, on le définit
		if (!startLocation) setStartLocation({ latitude: lat, longitude: lng });
		// Sinon, si le point d'arrivée n'est pas défini, on le définit
		else if (!endLocation) setEndLocation({ latitude: lat, longitude: lng });
		// Si les deux sont définis, on réinitialise le point de départ et on efface le point d'arrivée
		else clearPoints();
	};

	// Calculer l'itinéraire quand les deux pins sont définis
	useEffect(() => {
		if (startLocation && endLocation) fetchRoute();
	}, [startLocation?.latitude, startLocation?.longitude, endLocation?.latitude, endLocation?.longitude]);

	// Mise à jour de la météo quand la localisation de départ change
	useEffect(() => {
		if (startLocation) fetchMeteo(startLocation, setStartLocation);
		else
			setStartLocation((prev) => (prev ? { ...prev, meteo: undefined } : prev));

	}, [startLocation?.latitude, startLocation?.longitude]);

	// Mise à jour de la météo quand la localisation d'arrivée change
	useEffect(() => {
		if (endLocation) fetchMeteo(endLocation, setEndLocation);
		else setEndLocation((prev) => (prev ? { ...prev, meteo: undefined } : prev));
	}, [endLocation?.latitude, endLocation?.longitude]);

	// Affiche les suggestions quand la query change
	useEffect(() => { setShowSuggestionStart(true); }, [queryStart]);
	useEffect(() => { setShowSuggestionEnd(true); }, [queryEnd]);

	// Masque les suggestions quand la localisation est sélectionnée
	useEffect(() => { if (startLocation?.name) setShowSuggestionStart(false); }, [startLocation?.name]);
	useEffect(() => { if (endLocation?.name) setShowSuggestionEnd(false); }, [endLocation?.name]);


	// ---------- RENDER ----------
	return (
		<div className="relative w-full h-full">
			{/* Bouton toggle la barre de recherche d'itinéraire */}
			<Button
				variant="secondary"
				size="icon"
				className="absolute top-4 left-4 z-10"
				onClick={() =>
					setIsRouteSearchBarOpen((prev) => !prev)

				}
			>
				<ChevronRightIcon
					className={`transition-transform duration-300 ${isRouteSearchBarOpen ? "rotate-90" : ""
						}`}
				/>
			</Button>

			{/* Barre de recherche en haut à gauche */}
			<div className={"absolute top-4 left-16 z-10 transition-all duration-300 w-72 opacity-100 bg-white shadow-lg rounded-lg p-2 space-y-3 overflow-hidden"}>
				{/* Recherche départ et générale*/}
				<Command>
					<CommandInput
						placeholder="Rechercher dans GoogleMaps..."
						value={queryStart}
						onValueChange={setQueryStart}
					/>

					{/* FIXME: Les suggestions devraient se masquer quand on sélectionne une suggestion */}
					{showSuggestionStart && queryStart && (
						<CommandList>
							<CommandGroup heading="Suggestions">
								{suggestionsStart.map((s, idx) => (
									<CommandItem
										key={idx}
										value={s.label}
										onSelect={() => onSelectSuggestionStart(s)}
									>
										{s.label}
									</CommandItem>
								))}
							</CommandGroup>
							<CommandEmpty>Aucun résultat.</CommandEmpty>
						</CommandList>)}
				</Command>

				{/* Recherche arrivée */}
				{isRouteSearchBarOpen && (
					<Command>
						<CommandInput
							placeholder="Destination..."
							value={queryEnd}
							onValueChange={setQueryEnd}
						/>

						{/* FIXME: Les suggestions devraient se masquer quand on sélectionne une suggestion */}
						{showSuggestionEnd && queryEnd && (
							<CommandList>
								<CommandGroup heading="Suggestions">
									{suggestionsEnd.map((s, idx) => (
										<CommandItem
											key={idx}
											value={s.label}
											onSelect={() => { onSelectSuggestionEnd(s); }}
										>
											{s.label}
										</CommandItem>
									))}
								</CommandGroup>
								<CommandEmpty>Aucun résultat.</CommandEmpty>
							</CommandList>)}
					</Command>)}

				{isRouteSearchBarOpen && (<div className="flex items-center gap-2 p-2">
					<Checkbox
						disabled={!startLocation || !endLocation}
						onCheckedChange={(checked) => {
							setRouteFilteredByRain(!checked);
							// TODO: Rafraîchir l'itinéraire avec le filtre
						}}
					/>
					<Label>Éviter la pluie</Label>
				</div>)}

			</div>

			{/* Slider au centre en haut */}
			<Slider
				className="absolute bottom-5 left-1/2 -translate-x-1/2 w-[30%] z-10"
				defaultValue={[33]} max={100} step={1} />

			{/* Filtres */}
			<div className="absolute top-4 right-20 z-10 flex flex-row gap-2">
				<MapFilterCard
					setSelected={setIsTempMapSelected}
					selected={isTempMapSelected}
					img={"../img/soleil.png"}
				/>
				<MapFilterCard
					setSelected={setIsRainMapSelected}
					selected={isRainMapSelected}
					img={"../img/pluie.png"}
				/>
				<MapFilterCard
					setSelected={setIsCloudMapSelected}
					selected={isCloudMapSelected}
					img={"../img/nuage.png"}
				/>
				<MapFilterCard
					setSelected={setIsWindMapSelected}
					selected={isWindMapSelected}
					img={"../img/vent.png"}
				/>
			</div>

			{/* Carte */}
			<div className="w-full h-full">
				<MapCard
					center={center}
					zoom={zoom}
					showTempLayer={!!isTempMapSelected}
					showRainLayer={!!isRainMapSelected}
					showCloudLayer={!!isCloudMapSelected}
					showWindLayer={!!isWindMapSelected}
					routes={routes}
					areas={areas}
					startPin={
						startLocation?.latitude && startLocation?.longitude
							? [startLocation.latitude, startLocation.longitude]
							: null
					}
					endPin={
						endLocation?.latitude && endLocation?.longitude
							? [endLocation.latitude, endLocation.longitude]
							: null
					}
					onMapClick={handleMapClick}
				/>
			</div>
			<SidebarProvider>

				<Sidebar>
					<SidebarContent>
						<SidebarGroup>
							<SidebarGroupLabel>Application</SidebarGroupLabel>
							<SidebarGroupContent>
								{/* <SidebarMenu>
								{items.map((item) => (
									<SidebarMenuItem key={item.title}>
										<SidebarMenuButton asChild>
											<a href={item.url}>
												<item.icon />
												<span>{item.title}</span>
											</a>
										</SidebarMenuButton>
									</SidebarMenuItem>
								))}
							</SidebarMenu> */}
							</SidebarGroupContent>
						</SidebarGroup>
					</SidebarContent>
				</Sidebar>
			</SidebarProvider>

			{/* Sheet avec récap météo */}


			{/* Conditional reopen button */}
			{!isSheetOpen && !isRouteSearchBarOpen && (
				<Button
					variant="secondary"
					size="icon"
					className="absolute top-1/2 left-5 -translate-y-1/2 z-10"
					onClick={() => setIsSheetOpen(true)}
				>
					<ChevronLeftIcon className="rotate-180" />
				</Button>
			)}
		</div>
	);
};

export default Home;
