export async function fetchMeteoFromLocation(lat: number, lon : number) {
  if (!lat || !lon) return { features: [] };
  const res = await fetch(
    `/api/weather/current?latitude=${(lat)}&longitude=${(lon)}`
  );
  if (!res.ok) throw new Error(`Erreur API: ${res.status}`);
  return res.json();
}