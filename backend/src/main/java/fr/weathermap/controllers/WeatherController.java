package fr.weathermap.controllers;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestTemplate;

import fr.weathermap.services.RainViewerRadarPolygonService;
import fr.weathermap.services.RainViewerRadarPolygonService.TimeMode;
import fr.weathermap.utils.AreaUtils;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/weather")
public class WeatherController {

	private final RestTemplate restTemplate;

	@Autowired
	private RainViewerRadarPolygonService rainService;

	public WeatherController(RestTemplate restTemplate) {
		this.restTemplate = restTemplate;
	}

	@GetMapping("/current")
	public Map<String, Object> getCurrentWeather(
			@RequestParam double lat,
			@RequestParam double lng) {

		String url = "https://api.open-meteo.com/v1/forecast"
				+ "?latitude=" + lat
				+ "&longitude=" + lng
				+ "&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,rain,precipitation,cloud_cover,visibility";
		Map response = restTemplate.getForObject(url, Map.class);

		// On prépare un JSON simplifié
		Map<String, Object> filtered = new HashMap<>();
		filtered.put("latitude", lat);
		filtered.put("longitude", lng);

		if (response != null && response.containsKey("current") && response.containsKey("current_units")) {
			Map current = (Map) response.get("current");
			Map current_units = (Map) response.get("current_units");

			filtered.put("temperature", current.get("temperature_2m"));
			filtered.put("temperature_unit", current_units.get("temperature_2m"));
			filtered.put("apparent_temperature", current.get("apparent_temperature"));
			filtered.put("apparent_temperature_unit", current_units.get("apparent_temperature"));
			filtered.put("humidity", current.get("relative_humidity_2m"));
			filtered.put("humidity_unit", current_units.get("relative_humidity_2m"));
			filtered.put("windSpeed", current.get("wind_speed_10m"));
			filtered.put("windSpeed_unit", current_units.get("wind_speed_10m"));
			filtered.put("rain", current.get("rain"));
			filtered.put("rain_unit", current_units.get("rain"));
			filtered.put("precipitation", current.get("precipitation"));
			filtered.put("precipitation_unit", current_units.get("precipitation"));
			filtered.put("cloudCover", current.get("cloud_cover"));
			filtered.put("cloudCover_unit", current_units.get("cloud_cover"));
			filtered.put("visibility", current.get("visibility"));
			filtered.put("visibility_unit", current_units.get("visibility"));
		} else {
			filtered.put("error", "Impossible de lire la réponse de l'API");
		}

		return filtered;
	}

	/**
	 * Vérifie s'il pleut à un point donné par ses coordonnées.
	 * 
	 * @param lat Latitude du point
	 * @param lon Longitude du point
	 * @return Une réponse JSON contenant {isRaining: true/false}
	 */
	@GetMapping("/rain/check")
	public ResponseEntity<?> isRainingAtPoint(
			@RequestParam double lat,
			@RequestParam double lon) {

		Map<String, Object> response = new HashMap<>();
		response.put("latitude", lat);
		response.put("longitude", lon);

		try {
			boolean isRaining = rainService.isRainingAt(lat, lon);
			response.put("isRaining", isRaining);
			return ResponseEntity.ok(response);
		} catch (Exception e) {
			response.put("error", "Failed to check rain status: " + e.getMessage());
			return ResponseEntity.status(500).body(response);
		}
	}

	@GetMapping("/rain/zone")
	public Map<String, Object> getRainZone(
			@RequestParam double startLat,
			@RequestParam double startLng,
			@RequestParam double endLat,
			@RequestParam double endLng) {
		Map<String, Object> response = new HashMap<>();
		Map<String, Double> expandedArea = AreaUtils.expandedArea(startLat, startLng, endLat, endLng);
		List<List<List<Double>>> polygonsLonLat;
		try {
			polygonsLonLat = rainService.fetchRainPolygons(expandedArea.get("latMax"), expandedArea.get("lonMin"),
					expandedArea.get("latMin"), expandedArea.get("lonMax"), TimeMode.OLDEST_PAST, true);
		} catch (Exception e) {
			response.put("error", "Failed to fetch rain polygons: " + e.getMessage());
			return response;
		}
		response.put("polygons", AreaUtils.reverseLonLat(polygonsLonLat));
		return response;
	}

	@GetMapping("/forecast/12h")
	public Map<String, Object> getNext12HoursForecast(
			@RequestParam double lat,
			@RequestParam double lng) {

		// On demande à l'API Open-Meteo les prévisions horaires
		String url = "https://api.open-meteo.com/v1/forecast"
				+ "?latitude=" + lat
				+ "&longitude=" + lng
				+ "&hourly=temperature_2m,apparent_temperature,precipitation"
				+ "&forecast_hours=12";

		Map response = restTemplate.getForObject(url, Map.class);

		Map<String, Object> result = new HashMap<>();
		result.put("latitude", lat);
		result.put("longitude", lng);

		if (response != null && response.containsKey("hourly") && response.containsKey("hourly_units")) {
			Map hourly = (Map) response.get("hourly");
			Map hourly_units = (Map) response.get("hourly_units");


			// On récupère seulement les heures, températures et précipitations
			result.put("time", hourly.get("time"));
			result.put("temperature", hourly.get("temperature_2m"));
			result.put("temperature_unit", hourly_units.get("temperature_2m"));
			result.put("apparennt_temperature", hourly.get("apparent_temperature"));
			result.put("precipitation", hourly.get("precipitation"));
			result.put("precipitation_unit", hourly_units.get("precipitation"));
		} else {
			result.put("error", "Impossible de lire la réponse de l'API");
		}

		return result;
	}


	@GetMapping(value = "/rain/tile/oldest/{z}/{x}/{y}.png", produces = MediaType.IMAGE_PNG_VALUE)
    public ResponseEntity<byte[]> getOldestPastRainTile(
            @PathVariable int z,
            @PathVariable int x,
            @PathVariable int y,
            @RequestParam(required = false) Integer tileSize,
            @RequestParam(required = false) Integer colorScheme,
            @RequestParam(required = false) Integer smooth,
            @RequestParam(required = false) Integer snow) {

        try {
            byte[] data = rainService.fetchOldestPastTile(z, x, y, tileSize, colorScheme, smooth, snow);
            if (data == null) {
                return ResponseEntity.status(404).build();
            }
            HttpHeaders headers = new HttpHeaders();
            headers.setCacheControl(CacheControl.maxAge(java.time.Duration.ofMinutes(5)).cachePublic());
            return new ResponseEntity<>(data, headers, HttpStatus.OK);
        } catch (Exception e) {
            return ResponseEntity.status(500).build();
        }
    }
}
