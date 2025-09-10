export async function fetchLocationSuggestions(query: string) {
  if (!query) return { features: [] };
  const res = await fetch(
    `/api/location/search?query=${encodeURIComponent(query)}`
  );
  return res.json();
}
