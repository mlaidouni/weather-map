export async function fetchLocationSuggestions(query: string) {
  if (!query) return { features: [] };
  const res = await fetch(
    `/api/location/search?query=${encodeURIComponent(query)}`
  );
  if (!res.ok) throw new Error(`Erreur API: ${res.status}`);
  return res.json();
}
