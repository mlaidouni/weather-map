package fr.weathermap.services;

public enum PointOfInterestType {
    RESTAURANT("amenity", "restaurant", "Restaurant"),
    MUSEUM("tourism", "museum", "Musée"),
    TOILETS("amenity", "toilets", "Toilettes"),
    ATTRACTION("tourism", "attraction", "Attraction"),
    HOTEL("tourism", "hotel", "Hôtel"),
    SUPERMARKET("shop", "supermarket", "Supermarché");

    private final String key;
    private final String value;
    private final String label;

    PointOfInterestType(String key, String value, String label) {
        this.key = key;
        this.value = value;
        this.label = label;
    }

    public String getKey() {
        return key;
    }

    public String getValue() {
        return value;
    }

    public String getLabel() {
        return label;
    }
}
