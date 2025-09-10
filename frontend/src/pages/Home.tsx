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
import { Suggestion, useLocationSuggestions } from "../hooks/useLocationSuggestions";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { fetchMeteoFromLocation } from "@/api/weather";
import { fetchRoutingWeatherAware } from "@/api/routing";

/// ---- Types ----
// Types pour une localisation
export type LocationData = {
  name?: string | null;
  // Si l'object n'est pas null, alors ces deux champs sont définis
  latitude: number;
  longitude: number;
  meteo?: MeteoData;
};

// Types pour la météo
type MeteoData = {
  latitude?: number;
  longitude?: number;
  temperature?: number;
  temperature_unit?: string;
  apparent_temperature?: number;
  apparent_temperature_unit?: string;
  humidity?: number;
  humidity_unit?: string;
  windSpeed?: number;
  windSpeed_unit?: string;
  rain?: number;
  rain_unit?: string;
  precipitation?: number;
  precipitation_unit?: string;
  cloudCover?: number;
  cloudCover_unit?: string;
  visibility?: number;
  visibility_unit?: string;
};

const Home: React.FC = () => {
  /// ---- États ----
  // Map
  const [center, setCenter] = useState<LatLngExpression>([48.86, 2.33]);
  const [zoom, setZoom] = useState(12);
  // Filtre de la map
  const [isTempMapSelected, setIsTempMapSelected] = useState(0);
  const [isRainMapSelected, setIsRainMapSelected] = useState(0);

  // Recherche et Search bar
  const [isSearchBarOpen, setIsSearchBarOpen] = useState(true);
  const [query, setQuery] = useState("");
  const suggestions = useLocationSuggestions(query);

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
  const [meteo, setMeteo] = useState<MeteoData | null>(null);
  const [meteoLoading, setMeteoLoading] = useState(false);
  const [meteoError, setMeteoError] = useState<string | null>(null);

  const [startCoord, setStartCoord] = useState<LatLngExpression | null>(null);
  const [endCoord, setEndCoord] = useState<LatLngExpression | null>(null);

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

	const onSelectSuggestion = async (s: Suggestion) => {
		// Ferme les suggestions
		setIsSearchBarOpen(false);
		setQuery(s.label);
		setStartLocation({
			name: s.label,
			latitude: s.coordinates[0],
			longitude: s.coordinates[1],
		});

		setCenter(s.coordinates as LatLngExpression);
		setZoom(13);

		// Ouvre la sheet et prépare affichage
		setIsSheetOpen(true);
		setMeteo(null);
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

  // Appel au backend pour calculer l'itinéraire quand les deux pins sont définis
  useEffect(() => {
    if (startLocation && endLocation) fetchRoute();
  }, [startLocation, endLocation]); // FIXME Déclencher uniquement si les coords changent ?

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

  // Mis à jour de la météo quand la localisation de départ change
  const fetchMeteo = async (loc: LocationData) => {
    try {
      setMeteo(null);
      setMeteoError(null);
      setMeteoLoading(true);
      const data: MeteoData = await fetchMeteoFromLocation(
        loc.latitude,
        loc.longitude
      );
      setMeteo(data);
    } catch (e) {
      console.error(e);
      setMeteoError("Impossible de récupérer la météo.");
    } finally {
      setMeteoLoading(false);
    }
  };

  useEffect(() => {
    if (startLocation) fetchMeteo(startLocation);
  }, [startLocation]);

  useEffect(() => {
    if (endLocation) fetchMeteo(endLocation);
  }, [endLocation]);

  // ---------- RENDER ----------
  return (
    <div className="relative w-full h-full">
      {/* Bouton toggle pour la barre de recherche */}
      <Button
        variant="secondary"
        size="icon"
        className="size-8 absolute top-4 left-4 z-10"
        onClick={() => setIsSearchBarOpen((prev) => !prev)}
      >
        <ChevronRightIcon
          className={`transition-transform duration-300 ${
            isSearchBarOpen ? "rotate-90" : ""
          }`}
        />
      </Button>

      {/* Barre de recherche en haut à gauche */}
      <div
        className={`absolute top-4 left-16 z-10 transition-all duration-300 ${
          isSearchBarOpen ? "w-64 opacity-100" : "w-0 opacity-0"
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
                  onSelect={
                    () => onSelectSuggestion(s)
                  }
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
              disabled={!meteoLoading && !meteoError && !meteo}
              onClick={() => {
                // TODO Gérer le clic sur le bouton "Itinéraire"
                console.log("3- StartLocation:", startLocation);
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
            {!meteoLoading && !meteoError && !meteo && (
              <div className="text-sm text-muted-foreground p-2">
                <TriangleAlert className="inline-block mr-1 mb-1 text-yellow-500" />
                Sélectionner une localisation pour afficher la météo.
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
            {!meteoLoading && !meteoError && meteo && (
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
                      {meteo.temperature ?? "-"}
                      {meteo.temperature_unit
                        ? ` ${meteo.temperature_unit}`
                        : " °C"}
                    </div>
                  </div>

                  <div className="rounded-2xl border p-3 shadow-sm flex flex-col items-center text-center">
                    <Thermometer className="w-5 h-5 mb-1 text-red-500" />
                    <div className="text-xs text-muted-foreground">
                      Température ressentie
                    </div>
                    <div className="text-xl font-semibold">
                      {meteo.apparent_temperature ?? "-"}
                      {meteo.apparent_temperature_unit
                        ? ` ${meteo.apparent_temperature_unit}`
                        : " °C"}
                    </div>
                  </div>

                  <div className="rounded-2xl border p-3 shadow-sm flex flex-col items-center text-center">
                    <Droplets className="w-5 h-5 mb-1 text-cyan-500" />
                    <div className="text-xs text-muted-foreground">
                      Humidité
                    </div>
                    <div className="text-xl font-semibold">
                      {meteo.humidity ?? "-"}
                      {meteo.humidity_unit ? ` ${meteo.humidity_unit}` : " %"}
                    </div>
                  </div>

                  <div className="rounded-2xl border p-3 shadow-sm flex flex-col items-center text-center">
                    <Wind className="w-5 h-5 mb-1 text-gray-500" />
                    <div className="text-xs text-muted-foreground">Vent</div>
                    <div className="text-xl font-semibold">
                      {meteo.windSpeed ?? "-"}
                      {meteo.windSpeed_unit
                        ? ` ${meteo.windSpeed_unit}`
                        : " km/h"}
                    </div>
                  </div>

                  <div className="rounded-2xl border p-3 shadow-sm flex flex-col items-center text-center">
                    <CloudRainWind className="w-5 h-5 mb-1 text-blue-500" />
                    <div className="text-xs text-muted-foreground">Pluie</div>
                    <div className="text-xl font-semibold">
                      {meteo.rain ?? "-"}
                      {meteo.rain_unit ? ` ${meteo.rain_unit}` : " mm"}
                    </div>
                  </div>

                  <div className="rounded-2xl border p-3 shadow-sm flex flex-col items-center text-center">
                    <CloudDrizzle className="w-5 h-5 mb-1 text-blue-500" />
                    <div className="text-xs text-muted-foreground">
                      Précipitations
                    </div>
                    <div className="text-xl font-semibold">
                      {meteo.precipitation ?? "-"}
                      {meteo.precipitation_unit
                        ? ` ${meteo.precipitation_unit}`
                        : " mm"}
                    </div>
                  </div>

                  <div className="rounded-2xl border p-3 shadow-sm flex flex-col items-center text-center">
                    <Cloud className="w-5 h-5 mb-1 text-sky-500" />
                    <div className="text-xs text-muted-foreground">
                      Couverture nuageuse
                    </div>
                    <div className="text-xl font-semibold">
                      {meteo.cloudCover ?? "-"}
                      {meteo.cloudCover_unit
                        ? ` ${meteo.cloudCover_unit}`
                        : " %"}
                    </div>
                  </div>

                  <div className="rounded-2xl border p-3 shadow-sm flex flex-col items-center text-center">
                    <CloudFog className="w-5 h-5 mb-1 text-sky-500" />
                    <div className="text-xs text-muted-foreground">
                      Visibilité
                    </div>
                    <div className="text-xl font-semibold">
                      {meteo.visibility ?? "-"}
                      {meteo.visibility_unit
                        ? ` ${meteo.visibility_unit}`
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
      {!isSheetOpen && startLocation && (
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
