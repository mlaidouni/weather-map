import React, { useState } from "react";
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

      {/* <Marker position={coord} icon={markerIcon} />; */}

      {/* Carte */}
      <div className="w-full h-full">
        <MapCard
          center={center}
          zoom={zoom}
          showTempLayer={!!tempselected}
          showRainLayer={!!rainselected}
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
