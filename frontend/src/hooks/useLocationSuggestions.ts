import { useState, useEffect } from "react";
import { fetchLocationSuggestions } from "../api/location";

export function useLocationSuggestions(query: string) {
  const [suggestions, setSuggestions] = useState<
    { label: string; coordinates: [number, number] }[]
  >([]);

  useEffect(() => {
    let active = true;
    if (query.length > 2) {
      fetchLocationSuggestions(query).then((data) => {
        if (active) setSuggestions(data.features || []);
      });
    } else {
      setSuggestions([]);
    }
    return () => {
      active = false;
    };
  }, [query]);

  return suggestions;
}
