// Types pour la météo
type MeteoData = {
	latitude?: number;
	longitude?: number;
	temperature?: number;
	temperature_unit?: string;
	apparent_temperature?: number;
	apparent_temperature_unit?: string;
	humidity?: number;
	humidity_unit?: string;
	windSpeed?: number;
	windSpeed_unit?: string;
	rain?: number;
	rain_unit?: string;
	precipitation?: number;
	precipitation_unit?: string;
	cloudCover?: number;
	cloudCover_unit?: string;
	visibility?: number;
	visibility_unit?: string;
};
