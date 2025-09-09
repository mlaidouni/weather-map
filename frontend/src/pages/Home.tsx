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
  const [routePath, setRoutePath] = useState<LatLngExpression[]>([]);
  const [routeInfo, setRouteInfo] = useState<{ distance?: number, duration?: number }>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    setStartPin(null);
    setEndPin(null);
    setRoutePath([]);
    setRouteInfo({});
    setError(null);
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

      // Construction de l'URL avec les paramètres
      const url = `/api/routing/weather-aware?startLat=${startLatLng.lat}&startLng=${startLatLng.lng}&endLat=${endLatLng.lat}&endLng=${endLatLng.lng}`;

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Erreur API: ${response.status}`);
      }

      const data = await response.json();

      // Traitement des données de l'itinéraire
      if (data.coordinates && Array.isArray(data.coordinates)) {
        // Conversion des coordonnées au format Leaflet (inversé par rapport à l'API)
        const path = data.coordinates.map((coord: number[]) => [coord[1], coord[0]] as LatLngExpression);
        setRoutePath(path);

        // Extraction des informations sur l'itinéraire
        setRouteInfo({
          distance: data.distance ? Math.round(data.distance / 1000 * 10) / 10 : undefined, // en km
          duration: data.duration ? Math.round(data.duration / 60) : undefined // en minutes
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
          listStops={routePath.length > 0 ? routePath : []}
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
