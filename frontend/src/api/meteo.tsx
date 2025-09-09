export async function fetchMeteoFromLocation(lat: number, lon : number) {
  if (!lat || !lon) return { features: [] };
  const res = await fetch(
    `/api/weather/current?latitude=${(lat)}&longitude=${(lon)}`
  );
  return res.json();
}
