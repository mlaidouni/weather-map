package fr.weathermap.controllers;

import java.util.List;
import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import fr.weathermap.services.InterestPointService;

@RestController
@RequestMapping("/api/interest-point")
public class InterestPointController {

    private int RADIUS = 1000; // en mètres

    @Autowired
    private InterestPointService interestPointService;

    @GetMapping("/get")
    public Map<String,List<Map<String, Object>>> getInterestPoints(
            @RequestParam List<Double> lat,
            @RequestParam List<Double> lng) {
        
        System.out.println("Je suis dans le controller des points d'intérêt");

        if (lat.size() != lng.size()) {
            throw new IllegalArgumentException("Les listes de latitudes et longitudes doivent avoir la même taille");
        }
        Map<String, List<Map<String, Object>>> pois = interestPointService.getAllSuggestions(lat, lng, RADIUS);
        System.out.println("Je suis a la fin de la réponse");
        return pois;
    }
}
