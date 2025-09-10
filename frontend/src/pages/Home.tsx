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
import {
	Suggestion,
	useLocationSuggestions,
} from "../hooks/useLocationSuggestions";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
} from "@/components/ui/sheet";
import { fetchMeteoFromLocation } from "@/api/weather";
import { fetchRoutingWeatherAware } from "@/api/routing";
import { LocationData } from "@/types/locationData";

const Home: React.FC = () => {
	/// ---- États ----
	// Map
	const [center, setCenter] = useState<LatLngExpression>([48.86, 2.33]);
	const [zoom, setZoom] = useState(12);
	// Filtre de la map
	const [isTempMapSelected, setIsTempMapSelected] = useState(0);
	const [isRainMapSelected, setIsRainMapSelected] = useState(0);

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
	const [routePath, setRoutePath] = useState<LatLngExpression[]>([]);
	const [routeInfo, setRouteInfo] = useState<{
		distance?: number;
		duration?: number;
	}>({});
	const [routeLoading, setRouteLoading] = useState(false);
	const [routeError, setRouteError] = useState<string | null>(null);

	// Sheet
	const [isSheetOpen, setIsSheetOpen] = useState(false);

	//  états météo
	const [meteoLoading, setMeteoLoading] = useState(false);
	const [meteoError, setMeteoError] = useState<string | null>(null);

	/// ---- Fonctions ----
	// Nettoie les points sur la carte ET les données de localisation
	const clearPoints = () => {
		// FIXME: Doit gérer aussi l'affichage des barre, sheet, etc.
		setStartLocation(null);
		setEndLocation(null);
		setRoutePath([]);
		setRouteInfo({});
		setRouteError(null);
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

			const data = await fetchRoutingWeatherAware(startLatLng, endLatLng);

			if (data.coordinates && Array.isArray(data.coordinates)) {
				// Conversion des coordonnées au format Leaflet (inversé par rapport à l'API)
				const path = data.coordinates.map(
					(coord: number[]) => [coord[1], coord[0]] as LatLngExpression
				);
				setRoutePath(path);
				setRouteInfo({
					distance: data.distance
						? Math.round((data.distance / 1000) * 10) / 10
						: undefined, // en km
					duration: data.duration ? Math.round(data.duration / 60) : undefined, // en minutes
				});
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

	// Calcule l'itinéraire quand les deux pins sont définis
	useEffect(() => {
		if (startLocation && endLocation) fetchRoute();
	}, [startLocation, endLocation]); // FIXME Déclencher uniquement si les coords changent ?

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
								{suggestionsStart.map((s, _) => (
									<CommandItem
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
			</div>

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
			</div>

			{/* Carte */}
			<div className="w-full h-full">
				<MapCard
					center={center}
					zoom={zoom}
					showTempLayer={!!isTempMapSelected}
					showRainLayer={!!isRainMapSelected}
					listStops={routePath.length > 0 ? routePath : []}
					startCoord={
						startLocation?.latitude && startLocation?.longitude
							? [startLocation.latitude, startLocation.longitude]
							: null
					}
					endCoord={
						endLocation?.latitude && endLocation?.longitude
							? [endLocation.latitude, endLocation.longitude]
							: null
					}
					onMapClick={handleMapClick}
				/>
			</div>

			{/* Sheet avec récap météo */}
			<Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
				<SheetContent side="left" className="w-[380px] sm:w-[420px]">
					{/* Header : Informations générales */}
					<SheetHeader>
						<SheetTitle>
							{startLocation?.name ||
								(startLocation?.latitude
									? `${startLocation.latitude.toFixed(10)}, 
				  ${startLocation.longitude.toFixed(10)}`
									: "Informations")}
						</SheetTitle>
						<SheetDescription>
							{/* Coordonnées */}
							{startLocation && (
								<div className="text-sm text-muted-foreground">
									Coordonnées: {startLocation.latitude.toFixed(4)},{" "}
									{startLocation.longitude.toFixed(4)}
								</div>
							)}
						</SheetDescription>
						<Button
							variant="default"
							size="sm"
							className="mt-2 w-fit"
							disabled={!meteoLoading && !meteoError && !startLocation?.meteo}
							onClick={() => {
								// TODO: Fermer le sheet et ouvrir la RouteSearchBar
								// Puis pré-remplir le point de départ avec cette localisation
							}}
						>
							Itinéraire
						</Button>
					</SheetHeader>

					<div className="mt-4 space-y-3">
						{/* Cas d'erreur */}
						{meteoError && (
							<div className="text-sm text-red-600 p-2">
								<CircleX className="inline-block mr-1 mb-1 text-red-500" />
								{meteoError ||
									"Erreur lors de la récupération des données météo."}
							</div>
						)}

						{/* Chargement */}
						{meteoLoading && (
							<div className="text-sm text-muted-foreground p-2">
								<Loader2 className="inline-block mr-1 mb-1 animate-spin" />
								Chargement des données météo…
							</div>
						)}

						{/* Aucune donnée */}
						{!meteoLoading && !meteoError && !startLocation && (
							<div className="text-sm text-muted-foreground p-2">
								<TriangleAlert className="inline-block mr-1 mb-1 text-yellow-500" />
								Sélectionner une localisation de départ pour afficher la météo.
							</div>
						)}

						{/* TODO: ÇA POURRAIT NOUS SERVIR */}
						{/* <Tabs defaultValue="Météo Actuelle">
              <TabsList>
                <TabsTrigger value="Météo Actuelle">Météo Actuelle</TabsTrigger>
                <TabsTrigger value="Prévisions">Prévisions</TabsTrigger>
              </TabsList>

              <TabsContent value="Météo Actuelle">
                <Card>
                  <CardHeader>
                    <CardTitle>Météo Actuelle</CardTitle>
                    <CardDescription>
                      Météo actuelle (décalage possible de 15 minutes)
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-6"></CardContent>
                </Card>
              </TabsContent>
              <TabsContent value="Prévisions">
                <Card>
                  <CardHeader>
                    <CardTitle>Prévisions</CardTitle>
                    <CardDescription>
                      Prévisions prochaines heures
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-6"></CardContent>
                </Card>
              </TabsContent>
            </Tabs> */}

						{/* Affichage des données météo */}
						{!meteoLoading && !meteoError && startLocation?.meteo && (
							<div className="grid grid-cols-2">
								{/* Section 1 : Météo actuelle */}
								<div className="col-span-2 flex items-center gap-2 my-6">
									<div className="h-px flex-1 bg-muted" />
									<span className="text-xs uppercase tracking-wide text-muted-foreground">
										Météo actuelle
									</span>
									<div className="h-px flex-1 bg-muted" />
								</div>

								<div className="col-span-2 grid grid-cols-2 gap-3 pl-2 pr-2">
									<div className="rounded-2xl border p-3 shadow-sm flex flex-col items-center text-center">
										<Thermometer className="w-5 h-5 mb-1 text-red-500" />
										<div className="text-xs text-muted-foreground">
											Température
										</div>
										<div className="text-xl font-semibold">
											{startLocation?.meteo?.temperature ?? "-"}
											{startLocation?.meteo?.temperature_unit
												? ` ${startLocation.meteo.temperature_unit}`
												: " °C"}
										</div>
									</div>

									<div className="rounded-2xl border p-3 shadow-sm flex flex-col items-center text-center">
										<Thermometer className="w-5 h-5 mb-1 text-red-500" />
										<div className="text-xs text-muted-foreground">
											Température ressentie
										</div>
										<div className="text-xl font-semibold">
											{startLocation?.meteo?.apparent_temperature ?? "-"}
											{startLocation?.meteo?.apparent_temperature_unit
												? ` ${startLocation.meteo.apparent_temperature_unit}`
												: " °C"}
										</div>
									</div>

									<div className="rounded-2xl border p-3 shadow-sm flex flex-col items-center text-center">
										<Droplets className="w-5 h-5 mb-1 text-cyan-500" />
										<div className="text-xs text-muted-foreground">
											Humidité
										</div>
										<div className="text-xl font-semibold">
											{startLocation?.meteo?.humidity ?? "-"}
											{startLocation?.meteo?.humidity_unit
												? ` ${startLocation.meteo.humidity_unit}`
												: " %"}
										</div>
									</div>

									<div className="rounded-2xl border p-3 shadow-sm flex flex-col items-center text-center">
										<Wind className="w-5 h-5 mb-1 text-gray-500" />
										<div className="text-xs text-muted-foreground">Vent</div>
										<div className="text-xl font-semibold">
											{startLocation?.meteo?.windSpeed ?? "-"}
											{startLocation?.meteo?.windSpeed_unit
												? ` ${startLocation.meteo.windSpeed_unit}`
												: " km/h"}
										</div>
									</div>

									<div className="rounded-2xl border p-3 shadow-sm flex flex-col items-center text-center">
										<CloudRainWind className="w-5 h-5 mb-1 text-blue-500" />
										<div className="text-xs text-muted-foreground">Pluie</div>
										<div className="text-xl font-semibold">
											{startLocation?.meteo?.rain ?? "-"}
											{startLocation?.meteo?.rain_unit
												? ` ${startLocation.meteo.rain_unit}`
												: " mm"}
										</div>
									</div>

									<div className="rounded-2xl border p-3 shadow-sm flex flex-col items-center text-center">
										<CloudDrizzle className="w-5 h-5 mb-1 text-blue-500" />
										<div className="text-xs text-muted-foreground">
											Précipitations
										</div>
										<div className="text-xl font-semibold">
											{startLocation?.meteo?.precipitation ?? "-"}
											{startLocation?.meteo?.precipitation_unit
												? ` ${startLocation.meteo.precipitation_unit}`
												: " mm"}
										</div>
									</div>

									<div className="rounded-2xl border p-3 shadow-sm flex flex-col items-center text-center">
										<Cloud className="w-5 h-5 mb-1 text-sky-500" />
										<div className="text-xs text-muted-foreground">
											Couverture nuageuse
										</div>
										<div className="text-xl font-semibold">
											{startLocation?.meteo?.cloudCover ?? "-"}
											{startLocation?.meteo?.cloudCover_unit
												? ` ${startLocation.meteo.cloudCover_unit}`
												: " %"}
										</div>
									</div>

									<div className="rounded-2xl border p-3 shadow-sm flex flex-col items-center text-center">
										<CloudFog className="w-5 h-5 mb-1 text-sky-500" />
										<div className="text-xs text-muted-foreground">
											Visibilité
										</div>
										<div className="text-xl font-semibold">
											{startLocation?.meteo?.visibility ?? "-"}
											{startLocation?.meteo?.visibility_unit
												? ` ${startLocation.meteo.visibility_unit}`
												: " m"}
										</div>
									</div>
								</div>

								{/* Section 2 : Prévisions prochaines heures */}
								<div className="col-span-2 flex items-center gap-2 my-6">
									<div className="h-px flex-1 bg-muted" />
									<span className="text-xs uppercase tracking-wide text-muted-foreground">
										Prévisions prochaines heures
									</span>
									<div className="h-px flex-1 bg-muted" />
								</div>
								{/* ...infos prévisionnelles à ajouter ici... */}
							</div>
						)}
					</div>
				</SheetContent>
			</Sheet>

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
