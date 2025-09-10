package fr.weathermap.services;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.http.*;
import java.io.IOException;
import java.net.URI;
import java.time.Instant;
import java.util.*;

public class RainViewerCatalog {

    private static final String CATALOG_URL =
            "https://api.rainviewer.com/public/weather-maps.json";

    private final HttpClient http = HttpClient.newHttpClient();
    private final ObjectMapper om = new ObjectMapper();

    public static class Frame {
        public long time;
        public String path;
    }

    public static class Catalog {
        public String host;
        public List<Frame> past = new ArrayList<>();
        public List<Frame> nowcast = new ArrayList<>();
    }

    public Catalog fetch() throws IOException, InterruptedException {
        HttpRequest req = HttpRequest.newBuilder().uri(URI.create(CATALOG_URL)).build();
        HttpResponse<String> resp = http.send(req, HttpResponse.BodyHandlers.ofString());
        JsonNode root = om.readTree(resp.body());
        Catalog c = new Catalog();
        c.host = root.get("host").asText();
        JsonNode radar = root.get("radar");
        if (radar != null) {
            JsonNode past = radar.get("past");
            if (past != null) {
                for (JsonNode n : past) {
                    Frame f = new Frame();
                    f.time = n.get("time").asLong();
                    f.path = n.get("path").asText();
                    c.past.add(f);
                }
            }
            JsonNode nowcast = radar.get("nowcast");
            if (nowcast != null) {
                for (JsonNode n : nowcast) {
                    Frame f = new Frame();
                    f.time = n.get("time").asLong();
                    f.path = n.get("path").asText();
                    c.nowcast.add(f);
                }
            }
        }
        return c;
    }

    public String buildTileUrl(String host, Frame frame,
                               int z, int x, int y,
                               int tileSize, int colorScheme,
                               int smooth, int snow,
                               String ext) {
        return host + frame.path + "/" + tileSize + "/" + z + "/" + x + "/" + y + "/" +
                colorScheme + "/" + smooth + "_" + snow + "." + ext;
    }

    public static void main(String[] args) throws Exception {
        RainViewerCatalog r = new RainViewerCatalog();
        Catalog c = r.fetch();
        Frame latest = c.past.get(c.past.size() - 1);
        String sample = r.buildTileUrl(c.host, latest, 6, 33, 22, 256, 2, 1, 1, "png");
        System.out.println("Sample tile: " + sample);
        System.out.println("Frame time: " + Instant.ofEpochSecond(latest.time));
    }
}