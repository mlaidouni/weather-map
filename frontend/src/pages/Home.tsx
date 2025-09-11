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
	TriangleAlert,
	Loader2,
	CircleX,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import MapFilterCard from "@/components/card/MapFilterCard";
import { useLocationSuggestions } from "../hooks/useLocationSuggestions";
import { fetchMeteoFromLocation, fetchRainZones } from "@/api/weather";
import { fetchRoutingWeatherAware } from "@/api/routing";
import { LocationData } from "@/types/locationData";
import { Suggestion } from "@/types/suggestion";
import { Area } from "@/types/area";
import { RouteData } from "@/types/routes";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { SidebarInset, SidebarTrigger, SidebarProvider } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { AppSidebar } from "@/components/app-sidebar";

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
	const [isSideBarOpen, setIsSideBarOpen] = useState(false);

	// Météo
	const [meteoLoading, setMeteoLoading] = useState(false);
	const [meteoError, setMeteoError] = useState<string | null>(null);
	const [selectedMeteoView, setSelectedMeteoView] = useState<"start" | "end">(
		"start"
	);

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
									if (!isNaN(lat) && !isNaN(lng))
										return [lat, lng] as LatLngExpression;
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
							isRaining: true,
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
						? Math.round((route.distance / 1000) * 10) / 10
						: 0;

					// Calculate duration in minutes
					const duration = route.duration ? Math.round(route.duration / 60) : 0;

					return {
						id: `route-${index}`,
						coordinates,
						distance,
						duration,
					};
				});

				setRoutes(processedRoutes);
			} else {
				setRouteError("Format de données invalide");
			}
		} catch (err) {
			console.error("Erreur lors de la récupération de l'itinéraire:", err);
			setRouteError("Impossible de calculer l'itinéraire");
		} finally {
			setRouteLoading(false);
		}
	};

	// Mis à jour de la météo quand la localisation change

	const fetchMeteo = async (
		loc: LocationData,
		setLoc: React.Dispatch<React.SetStateAction<LocationData | null>>
	) => {
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

		const newLoc: LocationData = {
			name: s.label,
			latitude: s.coordinates[0],
			longitude: s.coordinates[1],
		};

		setStartLocation(newLoc);
		setCenter(s.coordinates as LatLngExpression);
		setZoom(13);

		await fetchMeteo(newLoc, setStartLocation);
	};

	const onSelectSuggestionEnd = async (s: Suggestion) => {
		setQueryEnd(s.label);
		setShowSuggestionEnd(false);

		const newLoc: LocationData = {
			name: s.label,
			latitude: s.coordinates[0],
			longitude: s.coordinates[1],
		};

		setEndLocation(newLoc);
		setCenter(s.coordinates as LatLngExpression);
		setZoom(13);
		setIsSideBarOpen(true);

		await fetchMeteo(newLoc, setEndLocation);
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
	}, [
		startLocation?.latitude,
		startLocation?.longitude,
		endLocation?.latitude,
		endLocation?.longitude,
	]);

	// Mise à jour de la météo quand la localisation de départ change
	useEffect(() => {
		if (startLocation) fetchMeteo(startLocation, setStartLocation);
		else
			setStartLocation((prev) => (prev ? { ...prev, meteo: undefined } : prev));
	}, [startLocation?.latitude, startLocation?.longitude]);

	// Mise à jour de la météo quand la localisation d'arrivée change
	useEffect(() => {
		if (endLocation) fetchMeteo(endLocation, setEndLocation);
		else
			setEndLocation((prev) => (prev ? { ...prev, meteo: undefined } : prev));
	}, [endLocation?.latitude, endLocation?.longitude]);

	// Affiche les suggestions quand la query change
	useEffect(() => {
		setShowSuggestionStart(true);
	}, [queryStart]);
	useEffect(() => {
		setShowSuggestionEnd(true);
	}, [queryEnd]);

	// Masque les suggestions quand la localisation est sélectionnée
	useEffect(() => {
		if (startLocation?.name) setShowSuggestionStart(false);
	}, [startLocation?.name]);
	useEffect(() => {
		if (endLocation?.name) setShowSuggestionEnd(false);
	}, [endLocation?.name]);

	/// ---- Rendu ----

	function sideBarHeader() {
		return (
			<div className="mb-2">
				<div className="text-2xl font-semibold">
					{startLocation?.name ||
						(startLocation?.latitude
							? `${startLocation.latitude.toFixed(10)}, 
				  ${startLocation.longitude.toFixed(10)}`
							: "Informations")}
				</div>
				{/* Coordonnées */}
				{startLocation && (
					<div className="text-sm text-muted-foreground">
						Coordonnées: {startLocation.latitude.toFixed(4)},{" "}
						{startLocation.longitude.toFixed(4)}
					</div>
				)}
				{/* <Button
          variant="default"
          size="sm"
          className="mt-2 w-fit"
          disabled={!meteoLoading && !meteoError && !startLocation?.meteo}
          onClick={() => {
            console.log("Button Itineraire - startlocation", startLocation);
            setIsRouteSearchBarOpen(true);
            setQueryStart(
              startLocation?.name
                ? startLocation.name
                : startLocation
                ? `${startLocation.latitude.toFixed(
                    10
                  )}, ${startLocation.longitude.toFixed(10)}`
                : ""
            );
            setShowSuggestionStart(false);
          }}
        >
          Itinéraire
        </Button> */}
			</div>
		);
	}

	function meteoInfoCard(title: string, icon: React.ReactNode, data: number | undefined, unit: string | undefined) {
		return (
			<div className="rounded-2xl border p-3 shadow-sm flex flex-col items-center text-center">
				{/* <Thermometer className="w-5 h-5 mb-1 text-red-500" /> */}
				{icon}
				<div className="text-xs text-muted-foreground">
					{title}
				</div>
				<div className="text-xl font-semibold">
					{data ?? "-"}
					{unit ? ` ${unit}` : " ??"}
				</div>
			</div>
		)
	}

	function meteoComponentFor(location: LocationData | null, label: string) {
		return (
			<div className="mt-6 space-y-3">
				<div className="col-span-2 flex items-center gap-2 my-4">
					<div className="h-px flex-1 bg-muted" />
					<span className="text-xs uppercase tracking-wide text-muted-foreground">
						{label}
					</span>
					<div className="h-px flex-1 bg-muted" />
				</div>

				{meteoError && (
					<div className="text-sm text-red-600 p-2 rounded-md border border-red-200 bg-red-50">
						<CircleX className="inline-block mr-1 mb-1 text-red-500" />
						{meteoError || "Erreur lors de la récupération des données météo."}
					</div>
				)}

				{meteoLoading && (
					<div className="text-sm text-muted-foreground p-2 flex items-center gap-2">
						<Loader2 className="w-4 h-4 animate-spin" />
						Chargement des données météo…
					</div>
				)}

				{!meteoLoading && !meteoError && !location && (
					<div className="text-sm text-muted-foreground p-2 flex items-center gap-2">
						<TriangleAlert className="w-4 h-4 text-yellow-500" />
						Sélectionner une localisation pour afficher la météo.
					</div>
				)}

				{!meteoLoading && !meteoError && location?.meteo && (
					<div className="grid grid-cols-2 gap-4">
						{meteoInfosCurrentFor(location)}
					</div>
				)}
			</div>
		);
	}

	// version adaptée de meteoInfosCurrent mais avec un paramètre location
	function meteoInfosCurrentFor(location: LocationData) {
		return (
			<>
				{meteoInfoCard(
					"Température",
					<Thermometer className="w-5 h-5 mb-1 text-red-500" />,
					location.meteo?.temperature,
					location.meteo?.temperature_unit || "°C"
				)}
				{meteoInfoCard(
					"Température ressentie",
					<Thermometer className="w-5 h-5 mb-1 text-red-500" />,
					location.meteo?.apparent_temperature,
					location.meteo?.apparent_temperature_unit || "°C"
				)}
				{meteoInfoCard(
					"Humidité",
					<Droplets className="w-5 h-5 mb-1 text-cyan-500" />,
					location.meteo?.humidity,
					location.meteo?.humidity_unit || "%"
				)}
				{meteoInfoCard(
					"Vent",
					<Wind className="w-5 h-5 mb-1 text-gray-500" />,
					location.meteo?.windSpeed,
					location.meteo?.windSpeed_unit || "km/h"
				)}
				{meteoInfoCard(
					"Pluie",
					<CloudRainWind className="w-5 h-5 mb-1 text-blue-500" />,
					location.meteo?.rain,
					location.meteo?.rain_unit || "mm"
				)}
				{meteoInfoCard(
					"Précipitations",
					<CloudDrizzle className="w-5 h-5 mb-1 text-blue-500" />,
					location.meteo?.precipitation,
					location.meteo?.precipitation_unit || "mm"
				)}
				{meteoInfoCard(
					"Couverture nuageuse",
					<Cloud className="w-5 h-5 mb-1 text-sky-500" />,
					location.meteo?.cloudCover,
					location.meteo?.cloudCover_unit || "%"
				)}
				{meteoInfoCard(
					"Visibilité",
					<CloudFog className="w-5 h-5 mb-1 text-sky-500" />,
					location.meteo?.visibility,
					location.meteo?.visibility_unit || "m"
				)}
			</>
		);
	}

	function sideBar() {
		return (
			<SidebarProvider
				defaultOpen={false}
				open={isSideBarOpen}
				onOpenChange={setIsSideBarOpen}
			>
				<AppSidebar
					header={sideBarHeader()}
					content={
						<>
							{startLocation && endLocation ? (
								<>
									{/* Toggle de sélection */}
									<div className="flex items-center gap-2 my-3">
										<Button
											variant={
												selectedMeteoView === "start" ? "default" : "outline"
											}
											size="sm"
											onClick={() => setSelectedMeteoView("start")}
										>
											Départ
										</Button>
										<Button
											variant={
												selectedMeteoView === "end" ? "default" : "outline"
											}
											size="sm"
											onClick={() => setSelectedMeteoView("end")}
										>
											Arrivée
										</Button>
									</div>

									{/* Affichage conditionnel */}
									{selectedMeteoView === "start" &&
										meteoComponentFor(startLocation, "Météo au départ")}
									{selectedMeteoView === "end" &&
										meteoComponentFor(endLocation, "Météo à l’arrivée")}
								</>
							) : (
								// Sinon, seulement la météo du départ
								meteoComponentFor(startLocation, "Météo actuelle")
							)}
						</>
					}
				/>
				<SidebarInset>
					<div className="flex flex-col h-full">
						<header className="flex h-16 items-center gap-2 border-b px-4">
							<SidebarTrigger />
							<Separator
								orientation="vertical"
								className="mr-2 data-[orientation=vertical]:h-4"
							/>
							Weather Map
						</header>
						{/* Layout principal en position relative pour le positionnement absolu des éléments */}
						<div className="flex-1 relative overflow-hidden">
							{/* Carte en arrière-plan */}
							<div className="absolute inset-0 z-0">
								{mapComponent()}
							</div>

							{/* Bouton toggle la barre de recherche d'itinéraire */}
							<div className="absolute top-4 left-4 z-30">
								{buttonToggleSearchBar()}
							</div>

							{/* Barre de recherche en haut à gauche */}
							<div className="absolute top-4 left-16 z-30">
								{searchBar()}
							</div>

							{/* Filtres en haut à droite */}
							<div className="absolute top-4 right-20 z-30">
								{filterLayer()}
							</div>

							{/* Slider au centre en bas */}
							<div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-30 w-[30%] flex justify-center">
								<Slider
									className="w-full"
									defaultValue={[33]} max={100} step={1} />
							</div>
						</div>
					</div>
				</SidebarInset>
			</SidebarProvider>
		);
	}

	function buttonToggleSearchBar() {
		return (
			<Button
				variant="secondary"
				size="icon"
				onClick={() => setIsRouteSearchBarOpen((prev) => !prev)}
			>
				<ChevronRightIcon
					className={`transition-transform duration-300 ${isRouteSearchBarOpen ? "rotate-90" : ""
						}`}
				/>
			</Button>
		);
	}

	function searchBar() {
		return (
			<div className="transition-all duration-300 w-72 opacity-100 bg-white shadow-lg rounded-lg p-2 space-y-3 overflow-hidden">
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
						</CommandList>
					)}
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
											onSelect={() => {
												onSelectSuggestionEnd(s);
											}}
										>
											{s.label}
										</CommandItem>
									))}
								</CommandGroup>
								<CommandEmpty>Aucun résultat.</CommandEmpty>
							</CommandList>
						)}
					</Command>
				)}

				{isRouteSearchBarOpen && (
					<div className="flex items-center gap-2 p-2">
						<Checkbox
							disabled={!startLocation || !endLocation}
							onCheckedChange={(checked) => {
								setRouteFilteredByRain(!checked);
								// TODO: Rafraîchir l'itinéraire avec le filtre
							}}
						/>
						<Label>Éviter la pluie</Label>
					</div>
				)}
			</div>
		);
	}

	function filterLayer() {
		return (
			<div className="flex flex-row gap-2">
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
		);
	}

	function mapComponent() {
		return (
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
		);
	}

	// ---------- Home Render ----------
	return (
		<div className="relative w-full h-full">

			{/* Sidebar informations */}
			{sideBar()}
		</div>
	);
};

export default Home;
