export async function fetchRoutingWeatherAware(
	startLatLng: L.LatLng,
	endLatLng: L.LatLng,
	signal?: AbortSignal,
	avoidCondition: string = '',
	dynamic: boolean = false
) {
	const url = `/api/routing/weather-aware?startLat=${startLatLng.lat}&startLng=${startLatLng.lng}&endLat=${endLatLng.lat}&endLng=${endLatLng.lng}&avoidConditions=${avoidCondition}&dynamic=${dynamic}`;
	const res = await fetch(url, { signal });
	if (!res.ok) throw new Error(`Erreur API: ${res.status}`);
	return res.json();
}