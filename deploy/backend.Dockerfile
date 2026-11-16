# La API se compila fuera (en tu PC) y aquí solo se empaqueta el .jar: compilar en la VM
# gastaría memoria que necesita la base de datos.
FROM eclipse-temurin:25-jre

RUN useradd --system --no-create-home boysfire
WORKDIR /app
COPY backend/target/boysfire-api-0.1.0.jar app.jar
USER boysfire

EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
