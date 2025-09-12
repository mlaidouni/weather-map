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
import {
  SidebarInset,
  SidebarTrigger,
  SidebarProvider,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { AppSidebar } from "@/components/app-sidebar";
import { AreaPrevisionRoute } from "@/types/areaPrevisionRoute";

import { useRef } from "react";

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

  //Localisation du véhicule
  const [vehicleLocation, setVehicleLocation] =
    useState<LatLngExpression | null>(null);

  // Itinéraire
  const [routes, setRoutes] = useState<RouteData[]>([]);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [areas, setAreas] = useState<Area[]>([]);
  const [routeSearch, setRouteSearch] = useState(false);

  //Zone de pluie en fonction de l'itinéraire
  const [areaPrevisionRoute, setAreaPrevisionRoute] = useState<
    AreaPrevisionRoute[]
  >([]);
  const [indexPositionInStep, setIndexPositionInStep] = useState(0);
  const [stepIndex, setStepIndex] = useState(0);
  const [sliderValue, setSliderValue] = useState(0);

  // Sheet
  const [isSideBarOpen, setIsSideBarOpen] = useState(false);

  // Météo
  const [meteoLoading, setMeteoLoading] = useState(false);
  const [meteoError, setMeteoError] = useState<string | null>(null);
  const [selectedMeteoView, setSelectedMeteoView] = useState<"start" | "end">(
    "start"
  );

  // Pour annuler les appels fetch
  const routeAbortControllerRef = useRef<AbortController | null>(null);
  const meteoAbortControllerRef = useRef<AbortController | null>(null);

  /// ---- Fonctions ----
  // Nettoie les points sur la carte ET les données de localisation
  const clearPoints = () => {
    if (routeAbortControllerRef.current) {
      routeAbortControllerRef.current.abort();
      routeAbortControllerRef.current = null;
    }

    if (meteoAbortControllerRef.current) {
      meteoAbortControllerRef.current.abort();
      meteoAbortControllerRef.current = null;
    }

    // FIXME: Doit gérer aussi l'affichage des barre, sheet, etc.
    setStartLocation(null);
    setEndLocation(null);
    setRoutes([]);
    setAreas([]);
    setRouteError(null);
    setRouteLoading(false);
    setAreaPrevisionRoute([]);
    setVehicleLocation(null);

	setQueryStart("");
	setQueryEnd("");
	setShowSuggestionStart(false);
	setShowSuggestionEnd(false);
	setIsRouteSearchBarOpen(false)
  };

  // Appel au backend pour calculer l'itinéraire
  const fetchRoute = async () => {
    if (!startLocation || !endLocation) return;

    // Abort any previous routing request
    if (routeAbortControllerRef.current) {
      routeAbortControllerRef.current.abort();
    }

    // Create a new AbortController for this routing request
    routeAbortControllerRef.current = new AbortController();
    const signal = routeAbortControllerRef.current.signal;

    setRouteLoading(true);
    setRouteError(null);

    try {
      // Conversion des pins en coordonnées lat/lng pour l'API
      const startLatLng = L.latLng(
        startLocation.latitude,
        startLocation.longitude
      );
      const endLatLng = L.latLng(endLocation.latitude, endLocation.longitude);

      const rainingZonesMap = await fetchRainZones(
        startLatLng,
        endLatLng,
        signal
      );
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

      const data = await fetchRoutingWeatherAware(
        startLatLng,
        endLatLng,
        signal
      );

      // If there is an error, show a popup
      if (data.error) {
        alert("Error: " + data.error);
        return;
      }

      if (data.steps && Array.isArray(data.steps)) {
        const routeWithRainAreas: AreaPrevisionRoute[] = data.steps.map(
          (step, stepIndex) => {
            // Traiter les polygones de pluie pour ce segment
            const rainingPolygons: Area[] = step.rain_polygons
              .map((polygon: number[][], polyIndex: number) => {
                if (!Array.isArray(polygon) || polygon.length === 0)
                  return null;

                // Convertir les coordonnées
                const coords = polygon
                  .map((pt: number[]) => {
                    if (Array.isArray(pt) && pt.length >= 2) {
                      const lat = Number(pt[0]);
                      const lng = Number(pt[1]);
                      if (!isNaN(lat) && !isNaN(lng))
                        return [lat, lng] as LatLngExpression;
                    }
                    return null;
                  })
                  .filter(Boolean) as LatLngExpression[];

                if (coords.length === 0) return null;

                // Vérifier si le polygone est fermé, sinon le fermer
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

            // Traiter le segment de route
            const routeSegment = step.route
              .map((coord: number[]) => {
                if (Array.isArray(coord) && coord.length >= 2) {
                  const lat = Number(coord[0]);
                  const lng = Number(coord[1]);
                  if (!isNaN(lat) && !isNaN(lng))
                    return [lat, lng] as LatLngExpression;
                }
                return null;
              })
              .filter(Boolean) as LatLngExpression[];

            // Retourner l'objet AreaPrevisionRoute pour ce segment
            return {
              rainingArea: rainingPolygons,
              route: routeSegment,
            };
          }
        );

        // Mettre à jour l'état avec les données traitées
        setAreaPrevisionRoute(routeWithRainAreas);
        setVehicleLocation(startLatLng);

        //Création de la route principale
        const allCoordinates: LatLngExpression[] = [];
        routeWithRainAreas.forEach((segment) => {
          if (segment.route && segment.route.length > 0) {
            allCoordinates.push(...segment.route);
          }
        });

        if (allCoordinates.length > 0) {
          const completeRoute: RouteData = {
            id: "route-main",
            coordinates: allCoordinates,
            distance: 0,
            duration: 0,
          };
          setRoutes([completeRoute]);
        }
      } else {
        // Réinitialiser si aucune donnée valide
        setAreaPrevisionRoute([]);
      }
    } catch (e: any) {
      alert("Erreur lors du calcul de l'itinéraire : " + e.message);
      // Don't show error if the request was aborted
      if (e.name === "AbortError") {
        console.log("Request was aborted");
      } else {
        console.error(e);
        setRouteError("Impossible de calculer l'itinéraire.");
      }
    } finally {
      // Only clear loading state if this is still the current request
      if (
        routeAbortControllerRef.current &&
        routeAbortControllerRef.current.signal === signal
      ) {
        setRouteLoading(false);
      }
    }
  };

  // Mis à jour de la météo quand la localisation change
  const fetchMeteo = async (
    loc: LocationData,
    setLoc: React.Dispatch<React.SetStateAction<LocationData | null>>
  ) => {
    // Abort any previous meteo request
    if (meteoAbortControllerRef.current) {
      meteoAbortControllerRef.current.abort();
    }

    // Create a new AbortController for this meteo request
    meteoAbortControllerRef.current = new AbortController();
    const signal = meteoAbortControllerRef.current.signal;

    try {
      setLoc((prev) => (prev ? { ...prev, meteo: undefined } : prev));
      setMeteoError(null);
      setMeteoLoading(true);

      const data: MeteoData = await fetchMeteoFromLocation(
        loc.latitude,
        loc.longitude,
        signal
      );

      setLoc((prev) => (prev ? { ...prev, meteo: data } : prev));
    } catch (e: any) {
      // Don't show error if the request was aborted
      if (e.name !== "AbortError") {
        console.error(e);
        setMeteoError("Impossible de récupérer la météo.");
      }
    } finally {
      // Only clear loading state if this is still the current request
      if (
        meteoAbortControllerRef.current &&
        meteoAbortControllerRef.current.signal === signal
      ) {
        setMeteoLoading(false);
      }
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
  };

  //Fonction pour mettre à jour les zones de pluie
  const updateRainingAreas = (stepIdx: number) => {
    if (
      !areaPrevisionRoute ||
      areaPrevisionRoute.length === 0 ||
      stepIdx >= areaPrevisionRoute.length
    ) {
      setAreas([]);
      return;
    }

    // Récupérer les zones de pluie de l'étape actuelle
    const currentStepRainingAreas = areaPrevisionRoute[stepIdx].rainingArea;

    // Mettre à jour l'état areas avec ces zones
    setAreas(currentStepRainingAreas);
  };

  //Cette fonction pour mettre à jour la position du véhicule
  const updateVehiclePosition = (value: number) => {
    if (
      !routes.length ||
      !routes[0].coordinates ||
      routes[0].coordinates.length === 0
    ) {
      return;
    }

    const coordinates = routes[0].coordinates;
    const totalPoints = coordinates.length;

    // Calculez l'index dans le tableau de coordonnées en fonction de la valeur du slider
    const pointIndex = Math.min(
      Math.floor((value / 100) * (totalPoints - 1)),
      totalPoints - 1
    );

    // Mettez à jour la position du véhicule
    setVehicleLocation(coordinates[pointIndex]);

    // Si vous avez besoin de suivre l'étape actuelle pour areaPrevisionRoute
    if (areaPrevisionRoute.length > 0) {
      // Déterminez à quelle étape appartient ce point
      let cumulativePoints = 0;
      let currentStepIndex = 0;

      for (let i = 0; i < areaPrevisionRoute.length; i++) {
        const stepPointCount = areaPrevisionRoute[i].route.length;
        if (pointIndex < cumulativePoints + stepPointCount) {
          currentStepIndex = i;
          setIndexPositionInStep(pointIndex - cumulativePoints);
          break;
        }
        cumulativePoints += stepPointCount;
      }

      // Mise à jour de l'étape actuelle
      setStepIndex(currentStepIndex);

      // Mise à jour des zones de pluie correspondant à l'étape actuelle
      updateRainingAreas(currentStepIndex);
    }
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
    setIsSideBarOpen(true); // FIXME: Utile ?
  };

  /// ---- Effets ----
  const handleMapClick = (e: any) => {
    const { lat, lng } = e.latlng;

    // Si le point de départ n'est pas défini
    if (!startLocation) {
      const newLoc: LocationData = {
        latitude: lat,
        longitude: lng,
        name: `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
      };
      setStartLocation(newLoc);
      setQueryStart(`${lat.toFixed(5)}, ${lng.toFixed(5)}`); // on met les coordonnées dans la barre
    }
    // Sinon, si le point d'arrivée n'est pas défini
    else if (!endLocation) {
      const newLoc: LocationData = {
        latitude: lat,
        longitude: lng,
        name: `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
      };
      setEndLocation(newLoc);
      setQueryEnd(`${lat.toFixed(5)}, ${lng.toFixed(5)}`); // coordonnées dans la barre arrivée
      setIsRouteSearchBarOpen(true); // on ouvre la barre de recherche itinéraire
    }
    // Si les deux sont déjà définis → on réinitialise
    else {
      clearPoints();
    }
  };

  // Calculer l'itinéraire quand les deux pins sont définis
  // useEffect(() => {
  // 	if (startLocation && endLocation) fetchRoute();
  // }, [
  // 	startLocation?.latitude,
  // 	startLocation?.longitude,
  // 	endLocation?.latitude,
  // 	endLocation?.longitude,
  // ]);

  // Meteo effects
  useEffect(() => {
    if (startLocation) fetchMeteo(startLocation, setStartLocation);
    else {
      // Abort any ongoing requests if the location is cleared
      if (meteoAbortControllerRef.current) {
        meteoAbortControllerRef.current.abort();
        meteoAbortControllerRef.current = null;
      }
      setStartLocation((prev) => (prev ? { ...prev, meteo: undefined } : prev));
    }

    return () => {
      if (meteoAbortControllerRef.current) {
        meteoAbortControllerRef.current.abort();
      }
    };
  }, [startLocation?.latitude, startLocation?.longitude]);

  useEffect(() => {
    if (endLocation) fetchMeteo(endLocation, setEndLocation);
    else {
      // Abort any ongoing requests if the location is cleared
      if (meteoAbortControllerRef.current) {
        meteoAbortControllerRef.current.abort();
        meteoAbortControllerRef.current = null;
      }
      setEndLocation((prev) => (prev ? { ...prev, meteo: undefined } : prev));
    }

    return () => {
      if (meteoAbortControllerRef.current) {
        meteoAbortControllerRef.current.abort();
      }
    };
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

  // Effet pour mettre à jour les zones de pluie quand l'étape change
  useEffect(() => {
    if (areaPrevisionRoute.length > 0) {
      updateRainingAreas(stepIndex);
    }
  }, [stepIndex, areaPrevisionRoute]);

  // Final cleanup
  useEffect(() => {
    return () => {
      if (routeAbortControllerRef.current)
        routeAbortControllerRef.current.abort();
      if (meteoAbortControllerRef.current)
        meteoAbortControllerRef.current.abort();
    };
  }, []);

  /// ---- Rendu ----

  function sideBarHeader(location: LocationData | null) {
    return (
      <div className="mb-2">
        <div className="text-2xl font-semibold">
          {location?.name ||
            (location?.latitude
              ? `${location.latitude.toFixed(10)}, 
				  ${location.longitude.toFixed(10)}`
              : "Aucune information disponible.")}
        </div>
        {/* Coordonnées */}
        {location && (
          <div className="text-sm text-muted-foreground">
            Coordonnées: {location.latitude.toFixed(4)},{" "}
            {location.longitude.toFixed(4)}
          </div>
        )}
      </div>
    );
  }

  function meteoInfoCard(
    title: string,
    icon: React.ReactNode,
    data: number | undefined,
    unit: string | undefined
  ) {
    return (
      <div className="rounded-2xl border p-3 shadow-sm flex flex-col items-center text-center">
        {icon}
        <div className="text-xs text-muted-foreground">{title}</div>
        <div className="text-xl font-semibold">
          {data ?? "-"}
          {unit ? ` ${unit}` : " ??"}
        </div>
      </div>
    );
  }

  function meteoComponentFor(location: LocationData | null) {
    return (
      <div className="mt-6 space-y-3">
        {/* Meteo Info Header */}

        <div className="col-span-2 flex items-center gap-2 my-4">
          <div className="h-px flex-1 bg-muted" />
          <span className="text-xs uppercase tracking-wide text-muted-foreground">
            Météo actuelle
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
          header={sideBarHeader(
            selectedMeteoView == "start" && startLocation
              ? startLocation
              : endLocation
          )}
          content={
            <>
              {startLocation && endLocation ? (
                <>
                  {/* Toggle de sélection */}
                  <div className="flex justify-center gap-2 my-3">
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
                    meteoComponentFor(startLocation)}
                  {selectedMeteoView === "end" &&
                    meteoComponentFor(endLocation)}
                </>
              ) : (
                // Sinon, seulement la météo du départ
                meteoComponentFor(startLocation)
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
              <div className="absolute inset-0 z-0">{mapComponent()}</div>

              {/* Bouton toggle la barre de recherche d'itinéraire */}
              <div className="absolute top-4 left-4 z-30">
                {buttonToggleSearchBar()}
              </div>

              {/* Barre de recherche en haut à gauche */}
              <div className="absolute top-4 left-16 z-30">{searchBar()}</div>

              {/* Filtres en haut à droite */}
              <div className="absolute top-4 right-20 z-30">
                {filterLayer()}
              </div>

              {/* Slider au centre en bas */}
              <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-30 w-[30%] flex justify-center">
                <Slider
                  className="absolute bottom-5 left-1/2 -translate-x-1/2 w-[30%] z-10"
                  value={[sliderValue]}
                  onValueChange={(values) => {
                    const newValue = values[0];
                    setSliderValue(newValue);
                    updateVehiclePosition(newValue);
                  }}
                  max={100}
                  step={1}
                />
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
          className={`transition-transform duration-300 ${
            isRouteSearchBarOpen ? "rotate-90" : ""
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
          <>
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
            <Button
              disabled={!startLocation || !endLocation || routeLoading}
              onClick={fetchRoute}
              className="w-full"
            >
              {routeLoading ? "Calcul en cours..." : "Rechercher l’itinéraire"}
            </Button>
          </>
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
        vehicleLocation={vehicleLocation}
        areaPrevisionRoute={areaPrevisionRoute}
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
