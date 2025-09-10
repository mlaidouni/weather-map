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
  CloudRain,
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

// Import Sheet shadcn/ui
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { fetchMeteoFromLocation } from "@/api/meteo";

// ---- Types pour la météo ----
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

const markerIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const Home: React.FC = () => {
  const [center, setCenter] = useState<LatLngExpression>([48.86, 2.33]);
  const [zoom, setZoom] = useState(12);
  const [open, setOpen] = useState(true); // toggle barre de recherche
  const [query, setQuery] = useState("");

  const [tempselected, setTempSelected] = useState(0);
  const [rainselected, setRainSelected] = useState(0);

  // état pour la Sheet
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  // ---- états météo ----
  const [meteo, setMeteo] = useState<MeteoData | null>(null);
  const [meteoLoading, setMeteoLoading] = useState(false);
  const [meteoError, setMeteoError] = useState<string | null>(null);

  const suggestions = useLocationSuggestions(query);
  const [startCoord, setStartCoord] = useState<LatLngExpression | null>(null);
  const [endCoord, setEndCoord] = useState<LatLngExpression | null>(null);
  const [routePath, setRoutePath] = useState<LatLngExpression[]>([]);
  const [routeInfo, setRouteInfo] = useState<{
    distance?: number;
    duration?: number;
  }>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleMapClick = (e: any) => {
    const { lat, lng } = e.latlng;

    // Si le point de départ n'est pas défini, on le définit
    if (!startCoord) {
      setStartCoord([lat, lng]);
    }
    // Sinon, si le point d'arrivée n'est pas défini, on le définit
    else if (!endCoord) {
      setEndCoord([lat, lng]);
    }
    // Si les deux sont définis, on réinitialise le point de départ et on efface le point d'arrivée
    else {
      clearPoints();
    }
  };

  const clearPoints = () => {
    setStartCoord(null);
    setEndCoord(null);
    setRoutePath([]);
    setRouteInfo({});
    setError(null);
  };

  // Appel au backend pour calculer l'itinéraire quand les deux pins sont définis
  useEffect(() => {
    if (startCoord && endCoord) {
      fetchRoute();
    }
  }, [startCoord, endCoord]);

  const fetchRoute = async () => {
    if (!startCoord || !endCoord) return;

    setLoading(true);
    setError(null);

    try {
      // Conversion des pins en coordonnées lat/lng pour l'API
      const startLatLng = L.latLng(startCoord);
      const endLatLng = L.latLng(endCoord);

      // Construction de l'URL avec les paramètres
      const url = `/api/routing/weather-aware?startLat=${startLatLng.lat}&startLng=${startLatLng.lng}&endLat=${endLatLng.lat}&endLng=${endLatLng.lng}`;

      const response = await fetch(url);
      if (!response.ok) throw new Error(`Erreur API: ${response.status}`);

      const data = await response.json();

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
        setError("Format de données invalide");
      }
    } catch (err) {
      console.error("Erreur lors de la récupération de l'itinéraire:", err);
      setError("Impossible de calculer l'itinéraire");
    } finally {
      setLoading(false);
    }
  };

  // ---------- RENDER ----------
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
          className={`transition-transform duration-300 ${
            open ? "rotate-90" : ""
          }`}
        />
      </Button>

      {/* Barre de recherche en haut à gauche */}
      <div
        className={`absolute top-4 left-16 z-10 transition-all duration-300 ${
          open ? "w-64 opacity-100" : "w-0 opacity-0"
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
                  onSelect={async () => {
                    // Ferme les suggestions
                    setOpen(false);

                    // Centre la carte
                    const coord = s.coordinates as LatLngExpression; // [lat, lon]
                    setCenter(coord);
                    setZoom(13);
                    setQuery(s.label);

                    // Ouvre la sheet et prépare affichage
                    setIsSheetOpen(true);
                    setMeteo(null);
                    setMeteoError(null);
                    setMeteoLoading(true);

                    try {
                      const [lat, lon] = s.coordinates as [number, number];
                      const data: MeteoData = await fetchMeteoFromLocation(
                        lat,
                        lon
                      );
                      setMeteo(data);
                    } catch (e) {
                      console.error(e);
                      setMeteoError("Impossible de récupérer la météo.");
                    } finally {
                      setMeteoLoading(false);
                    }

                    // (Optionnel) définir le point de départ
                    // setStartPin(coord);
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
          listStops={routePath.length > 0 ? routePath : []}
          startCoord={startCoord}
          endCoord={endCoord}
          onMapClick={handleMapClick}
        />
      </div>

      {/* Sheet avec récap météo */}
      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent side="left" className="w-[380px] sm:w-[420px]">
          {/* Header : Informations générales */}
          <SheetHeader>
            <SheetTitle>{query || "Informations"}</SheetTitle>
            <SheetDescription>
              {/* Coordonnées */}
              {meteo && meteo.latitude && meteo.longitude && (
                <div className="text-sm text-muted-foreground">
                  Coordonnées: {meteo.latitude.toFixed(4)},{" "}
                  {meteo.longitude.toFixed(4)}
                </div>
              )}
            </SheetDescription>
          </SheetHeader>

          <div className="mt-4 space-y-3">
            {/* Chargement */}
            {meteoLoading && (
              <div className="text-sm text-muted-foreground p-2">
                <Loader2 className="inline-block mr-1 mb-1 animate-spin" />
                Chargement des données météo…
              </div>
            )}

            {/* Cas d'erreur */}
            {meteoError && (
              <div className="text-sm text-red-600 p-2">
                <CircleX className="inline-block mr-1 mb-1 text-red-500" />
                {meteoError || "Météo erreur"}
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

            {!meteoLoading && !meteoError && !meteo && (
              <div className="text-sm text-muted-foreground p-2">
                <TriangleAlert className="inline-block mr-1 mb-1 text-yellow-500" />
                Sélectionner une localisation pour afficher la météo.
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default Home;
