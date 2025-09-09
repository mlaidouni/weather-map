import { useState, useEffect } from "react";
import { fetchLocationSuggestions } from "../api/location";

export type Suggestion = { label: string; coordinates: [number, number] };

// FIXME: déplacer toSuggestion dans LocationController
function toSuggestion(f: any): Suggestion | null {
  const label = f?.label ?? null;

  let coords: [number, number] | null = null;

  if (Array.isArray(f?.coordinates) && f.coordinates.length >= 2) {
    const [a, b] = f.coordinates;
    coords = [Number(b), Number(a)];
  }

  if (!label || !coords || !isFinite(coords[0]) || !isFinite(coords[1])) {
    return null;
  }
  return { label: String(label), coordinates: coords };
}

export function useLocationSuggestions(query: string) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);

  useEffect(() => {
    let cancelled = false;
    const q = query.trim();

    if (q.length < 3) {
      setSuggestions([]);
      return;
    }

    (async () => {
      try {
        const data = await fetchLocationSuggestions(q);
        const raw = Array.isArray(data?.features) ? data.features : data ?? [];
        const normalized: Suggestion[] = (raw as any[])
          .map(toSuggestion)
          .filter(Boolean) as Suggestion[];

        if (!cancelled) setSuggestions(normalized);
      } catch {
        if (!cancelled) setSuggestions([]);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [query]);

  return suggestions;
}
