# WeatherMap

## Contributeurs

- PARIS Albin
- 
- LAÏDOUNI Mohamed

## Prérequis

- Docker installé sur votre machine (<https://docs.docker.com/get-docker/>)
- API Key OpenWeather (<https://openweathermap.org/api>)

## Installation

1. Cloner le dépôt

   ```bash
   git clone git@moule.informatique.univ-paris-diderot.fr:paris/weathermap.git
   cd weathermap
   ```

2. Créer un fichier `.env` à la racine du projet et y ajouter votre clé API OpenWeather

   ```env
   OPEN_WEATHER_API_KEY=your_api_key_here
   ```

3. Construire et lancer les conteneurs Docker

   ```bash
   docker compose -f 'docker-compose.yml' up -d --build
   ```

## Accès

- Accéder à <http://localhost:3000>

## Sources de données

- [OpenWeather (API)](https://openweathermap.org/api)
- [Open-Meteo (API)](https://open-meteo.com/)
- [Adresses (API)](https://geoservices.ign.fr/documentation/services/services-geoplateforme/geocodage)
