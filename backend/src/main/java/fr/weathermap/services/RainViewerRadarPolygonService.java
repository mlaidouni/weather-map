package fr.weathermap.services;

import org.springframework.stereotype.Service;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.IOException;
import java.net.URI;
import java.net.http.*;
import java.util.*;

/**
 * Génère des polygones approximatifs de zones de pluie (rectangles fusionnés) depuis les tuiles RainViewer.
 * Stratégie:
 * 1. Récupère le catalogue (frames radar).
 * 2. Sélectionne la dernière frame "past".
 * 3. Calcule la plage de tuiles couvrant la bounding box au zoom choisi.
 * 4. Télécharge les tuiles (PNG, colorScheme=2 Universal Blue).
 * 5. Construit un masque binaire (alpha > 0 => pluie).
 * 6. Regroupe en rectangles maximalement étendus.
 * 7. Convertit en polygones (lon/lat) (4 points, non fermé).
 *
 * Améliorations possibles: seuil par palette, marching squares, simplification RDP, union shapely (si ajout lib).
 */
@Service
public class RainViewerRadarPolygonService {

    private final RainViewerCatalog catalog = new RainViewerCatalog();
    private final HttpClient http = HttpClient.newBuilder()
            .version(HttpClient.Version.HTTP_2)
            .build();

    // Limiter le nombre de tuiles max pour éviter surcharge (ex: 160 = 10x16)
    private static final int MAX_TILES = 180;
    private static final int TILE_SIZE = 256;
    private static final int COLOR_SCHEME = 2;      // Universal Blue
    private static final int SMOOTH = 1;
    private static final int SNOW = 1;
    private static final String EXT = "png";

    /**
     * @param topLat    latitude du coin haut-gauche
     * @param leftLon   longitude du coin haut-gauche
     * @param bottomLat latitude du coin bas-droit
     * @param rightLon  longitude du coin bas-droit
     * @return Liste de polygones: List<Polygon> où Polygon = List<[lon, lat]>
     * @throws InterruptedException 
     * @throws IOException 
     */
    public List<List<List<Double>>> fetchRainPolygons(double topLat,
                                                      double leftLon,
                                                      double bottomLat,
                                                      double rightLon) throws IOException, InterruptedException{

        // Normalisation
        if (bottomLat > topLat) {
            double tmp = bottomLat; bottomLat = topLat; topLat = tmp;
        }
        if (leftLon > rightLon) {
            double tmp = leftLon; leftLon = rightLon; rightLon = tmp;
        }

        RainViewerCatalog.Catalog cat = catalog.fetch();
        if (cat.past.isEmpty()) return List.of();
        RainViewerCatalog.Frame latest = cat.past.get(cat.past.size() - 1);

        int zoom = chooseZoom(topLat, leftLon, bottomLat, rightLon);
        int xMin = lonToTileX(leftLon, zoom);
        int xMax = lonToTileX(rightLon, zoom);
        int yMin = latToTileY(topLat, zoom);
        int yMax = latToTileY(bottomLat, zoom);

        int tiles = (xMax - xMin + 1) * (yMax - yMin + 1);
        if (tiles > MAX_TILES) {
            // Réduire le zoom si trop de tuiles
            while (tiles > MAX_TILES && zoom > 3) {
                zoom--;
                xMin = lonToTileX(leftLon, zoom);
                xMax = lonToTileX(rightLon, zoom);
                yMin = latToTileY(topLat, zoom);
                yMax = latToTileY(bottomLat, zoom);
                tiles = (xMax - xMin + 1) * (yMax - yMin + 1);
            }
        }

        int totalWidth = (xMax - xMin + 1) * TILE_SIZE;
        int totalHeight = (yMax - yMin + 1) * TILE_SIZE;
        boolean[][] mask = new boolean[totalHeight][totalWidth];

        for (int xt = xMin; xt <= xMax; xt++) {
            for (int yt = yMin; yt <= yMax; yt++) {
                String url = catalog.buildTileUrl(
                        cat.host, latest, zoom, xt, yt,
                        TILE_SIZE, COLOR_SCHEME, SMOOTH, SNOW, EXT
                );
                BufferedImage img = downloadTile(url);
                if (img == null) continue;
                int offsetX = (xt - xMin) * TILE_SIZE;
                int offsetY = (yt - yMin) * TILE_SIZE;

                for (int py = 0; py < TILE_SIZE; py++) {
                    for (int px = 0; px < TILE_SIZE; px++) {
                        int argb = img.getRGB(px, py);
                        int alpha = (argb >> 24) & 0xFF;
                        if (alpha == 0) continue; // Transparent => pas de pluie
                        mask[offsetY + py][offsetX + px] = true;
                    }
                }
            }
        }

        List<Rect> rects = rasterToRectangles(mask);
        if (rects.isEmpty()) return List.of();

        // Conversion rectangles -> polygones lon/lat
        List<List<List<Double>>> polygons = new ArrayList<>();
        for (Rect r : rects) {
            polygons.add(rectToPolygon(r, zoom, xMin, yMin));
        }
        return polygons;
    }

    private BufferedImage downloadTile(String url) {
        try {
            HttpRequest req = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .timeout(java.time.Duration.ofSeconds(5))
                    .GET()
                    .build();
            HttpResponse<byte[]> resp = http.send(req, HttpResponse.BodyHandlers.ofByteArray());
            if (resp.statusCode() == 200) {
                return ImageIO.read(new java.io.ByteArrayInputStream(resp.body()));
            }
        } catch (IOException | InterruptedException e) {
            // Ignorer silencieusement cette tuile
        }
        return null;
    }

    // Choix de zoom heuristique pour limiter nombre de tuiles
    private int chooseZoom(double topLat, double leftLon, double bottomLat, double rightLon) {
        double lonSpan = Math.abs(rightLon - leftLon);
        // Commencer haut, descendre si trop large
        int z = 9;
        while (z > 3) {
            double tilesX = lonSpan / (360.0 / (1 << z));
            if (tilesX <= 12) break;
            z--;
        }
        return z;
    }

    // Rectangle interne (en indices pixels globaux)
    private static class Rect {
        int x1, y1, x2, y2; // x2,y2 exclusifs
        Rect(int x1,int y1,int x2,int y2){this.x1=x1;this.y1=y1;this.x2=x2;this.y2=y2;}
    }

    /**
     * Regroupement naïf en rectangles maximalement étendus (balayage).
     * Complexité O(W*H) ~ suffisant pour zones modérées.
     */
    private List<Rect> rasterToRectangles(boolean[][] mask) {
        int h = mask.length;
        int w = mask[0].length;
        boolean[][] used = new boolean[h][w];
        List<Rect> rects = new ArrayList<>();
        for (int y = 0; y < h; y++) {
            for (int x = 0; x < w; x++) {
                if (!mask[y][x] || used[y][x]) continue;
                int x2 = x;
                while (x2 + 1 < w && mask[y][x2 + 1] && !used[y][x2 + 1]) x2++;
                int y2 = y;
                outer:
                while (y2 + 1 < h) {
                    for (int xx = x; xx <= x2; xx++) {
                        if (!mask[y2 + 1][xx] || used[y2 + 1][xx]) break outer;
                    }
                    y2++;
                }
                for (int yy = y; yy <= y2; yy++)
                    for (int xx = x; xx <= x2; xx++)
                        used[yy][xx] = true;
                rects.add(new Rect(x, y, x2 + 1, y2 + 1));
            }
        }
        // Option: fusion de rectangles adjacents (non implémenté)
        return rects;
    }

    private List<List<Double>> rectToPolygon(Rect r, int zoom, int xTileMin, int yTileMin) {
        // Quatre sommets (lon, lat) (ordre horaire)
        List<List<Double>> poly = new ArrayList<>(4);
        poly.add(pixelToLonLat(r.x1, r.y1, zoom, xTileMin, yTileMin));
        poly.add(pixelToLonLat(r.x1, r.y2, zoom, xTileMin, yTileMin));
        poly.add(pixelToLonLat(r.x2, r.y2, zoom, xTileMin, yTileMin));
        poly.add(pixelToLonLat(r.x2, r.y1, zoom, xTileMin, yTileMin));
        return poly;
    }

    private List<Double> pixelToLonLat(int pxGlobal, int pyGlobal, int z,
                                       int xTileMin, int yTileMin) {
        double mapSize = TILE_SIZE * Math.pow(2, z);
        double globalX = xTileMin * TILE_SIZE + pxGlobal;
        double globalY = yTileMin * TILE_SIZE + pyGlobal;
        double lon = globalX / mapSize * 360.0 - 180.0;
        double n = Math.PI - 2.0 * Math.PI * globalY / mapSize;
        double lat = Math.toDegrees(Math.atan(Math.sinh(n)));
        return List.of(lon, lat);
    }

    private int lonToTileX(double lon, int z) {
        return (int)Math.floor((lon + 180.0) / 360.0 * (1 << z));
    }
    private int latToTileY(double lat, int z) {
        double rad = Math.toRadians(lat);
        return (int)Math.floor(
                (1 - Math.log(Math.tan(rad) + 1/Math.cos(rad)) / Math.PI) / 2 * (1 << z)
        );
    }

    public static void main(String[] args) {
        RainViewerRadarPolygonService service = new RainViewerRadarPolygonService();
        try {
            // Exemple: Paris et environs
            double topLat = 48.71947484130331;
            double leftLon = 6.123085711262381;
            double bottomLat = 48.63451636312914;
            double rightLon = 6.298848177085143;
            List<List<List<Double>>> polygons = service.fetchRainPolygons(
                    topLat, leftLon, bottomLat, rightLon
            );
            System.out.println("Detected rain polygons:");
            for (List<List<Double>> poly : polygons) {
                System.out.println(poly);
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}