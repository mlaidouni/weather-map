# Utiliser une image Maven pour construire le projet
FROM maven:3.9.9-amazoncorretto-17-alpine AS build

# Définir le répertoire de travail
WORKDIR /app

# Copie du pom.xml et téléchargement des dépendances (mise en cache des dépendances)
COPY pom.xml .
RUN mvn dependency:go-offline

# Copie de l'ensemble du projet
COPY . ./

# Set environment variables for DevTools
ENV SPRING_DEVTOOLS_RESTART_ENABLED=true
ENV SPRING_DEVTOOLS_LIVERELOAD_ENABLED=true

# Run with spring-boot:run and enable file monitoring
CMD ["mvn", "spring-boot:run"]