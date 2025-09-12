// Types pour une localisation
export type LocationData = {
	name?: string | null;
	// Si l'object n'est pas null, alors ces deux champs sont définis
	latitude: number;
	longitude: number;
	meteo?: MeteoData;
};
