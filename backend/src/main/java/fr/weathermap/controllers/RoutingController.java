package fr.weathermap.controllers;

import fr.weathermap.services.RoutingService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/routing")
public class RoutingController {

	@Autowired
	private RoutingService routingService;

	@GetMapping("/weather-aware")
	public Map<String, Object> getWeatherAwareRoute(
			@RequestParam double startLat,
			@RequestParam double startLng,
			@RequestParam double endLat,
			@RequestParam double endLng,
			@RequestParam(required = false, defaultValue = "") List<String> avoidConditions) {

		return routingService.calculateWeatherAwareRoute(
				startLat, startLng, endLat, endLng, avoidConditions);
	}
}
