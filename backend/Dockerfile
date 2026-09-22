FROM eclipse-temurin:21-jdk AS build
WORKDIR /build
COPY .mvn/ .mvn/
COPY mvnw pom.xml ./
RUN ./mvnw -B dependency:go-offline
COPY src/ src/
RUN ./mvnw -B -DskipTests package

FROM eclipse-temurin:21-jre
WORKDIR /app
COPY --from=build /build/target/backend-*.jar app.jar
EXPOSE 8080
# The JVM gets a share of the container's memory rather than a fixed heap, so the same
# image fits the 1GB t3.micro of ADR-0009 and a roomier machine without re-tuning.
ENV JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=70.0"
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
