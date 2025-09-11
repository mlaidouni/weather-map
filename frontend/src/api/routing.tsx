export async function fetchRoutingWeatherAware(startLatLng: L.LatLng, endLatLng: L.LatLng) {
	const url = `/api/routing/weather-aware?startLat=${startLatLng.lat}&startLng=${startLatLng.lng}&endLat=${endLatLng.lat}&endLng=${endLatLng.lng}&avoidConditions=rain`;
	const res = await fetch(url);
	if (!res.ok) throw new Error(`Erreur API: ${res.status}`);
	return res.json();
}
