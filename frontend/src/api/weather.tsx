export async function fetchRainZones(
	startLatLng: L.LatLng,
	endLatLng: L.LatLng,
	signal?: AbortSignal
) {
	const url = `/api/weather/rain/zone?startLat=${startLatLng.lat}&startLng=${startLatLng.lng}&endLat=${endLatLng.lat}&endLng=${endLatLng.lng}`;
	const res = await fetch(url, { signal });
	if (!res.ok) throw new Error(`Erreur API: ${res.status}`);
	return res.json();
}

export async function fetchMeteoFromLocation(
	lat: number,
	lon: number,
	signal?: AbortSignal
) {
	if (!lat || !lon) return { features: [] };
	const res = await fetch(
		`/api/weather/current?lat=${(lat)}&lng=${(lon)}`,
		{ signal }
	);
	if (!res.ok) throw new Error(`Erreur API: ${res.status}`);
	return res.json();
}