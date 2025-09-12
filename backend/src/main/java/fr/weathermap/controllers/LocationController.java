package fr.weathermap.controllers;

import java.util.ArrayList;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import org.springframework.web.client.RestTemplate;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/location")
public class LocationController {

	private final RestTemplate restTemplate;

	public LocationController(RestTemplate restTemplate) {
		this.restTemplate = restTemplate;
	}

	// FIXME: déplacer la logique de toSuggestion ici

	@GetMapping("/search")
	public Map<String, Object> getLocationSuggestion(
			@RequestParam(required = true, defaultValue = "") String query) {

		final String url = "https://data.geopf.fr/geocodage/search?q=" + query
				+ "&autocomplete=1&index=address,poi&limit=10";

		Map<String, Object> response = restTemplate.getForObject(url, Map.class);

		Map<String, Object> result = new HashMap<>();
		if (response != null && response.containsKey("features")) {
			var features = (Iterable<Map<String, Object>>) response.get("features");
			var filteredFeatures = new ArrayList<Map<String, Object>>();

			for (Map<String, Object> feature : features) {
				Map<String, Object> properties = (Map<String, Object>) feature.get("properties");
				Map<String, Object> geometry = (Map<String, Object>) feature.get("geometry");

				if (properties != null && geometry != null && geometry.containsKey("coordinates")) {
					Map<String, Object> filteredFeature = new HashMap<>();
					filteredFeature.put("label", properties.get("label"));
					filteredFeature.put("coordinates", geometry.get("coordinates"));
					filteredFeatures.add(filteredFeature);
				}
			}
			result.put("features", filteredFeatures);
		}
		return result;
	}
}
