import React, { useState } from "react";
import MapCard from "../components/card/MapCard";
import { LatLngExpression } from "leaflet";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { ChevronRightIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import MapFilterCard from "@/components/card/MapFilterCard";
import { useLocationSuggestions } from "../hooks/useLocationSuggestions";

const cities: Record<string, LatLngExpression> = {
  paris: [48.8566, 2.3522],
  lyon: [45.764, 4.8357],
  marseille: [43.2965, 5.3698],
};

const Home: React.FC = () => {
  const [center, setCenter] = useState<LatLngExpression>([48.86, 2.33]);
  const [zoom, setZoom] = useState(12);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [tempselected, setTempSelected] = useState(0);
  const [rainselected, setRainSelected] = useState(0);

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
          {/* Suggestions */}
          <CommandList>
            <CommandGroup heading="Suggestions">
              {suggestions.map((s, idx) => (
                <CommandItem
                  key={idx}
                  value={s.label}
                  onSelect={() => {
                    setCenter(s.coordinates as LatLngExpression); 
                    setZoom(13);
                    setQuery(s.label);
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

      <div className="w-full h-full">
        <MapCard
          center={center}
          zoom={zoom}
          showTempLayer={!!tempselected}
          showRainLayer={!!rainselected}
        />
      </div>
    </div>
  );
};

export default Home;
