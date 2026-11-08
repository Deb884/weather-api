import "dotenv/config";
import express from "express";
import path from "path";
import helmet from "helmet";
import cors from "cors";
import { fileURLToPath } from "url";
import swaggerUi from "swagger-ui-express";
import weatherRoutes from "./routes/weatherRoutes.js";
import favoritesRoutes from "./routes/favoritesRoutes.js";
import { requestLogger, globalErrorHandler, notFoundHandler } from "./middleware/errorHandler.js";

// Setup for ES Modules (__dirname equivalent)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create the Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Security + Cross-Origin (helmet adds 15+ security headers, cors allows the frontend to call this API)
app.use(helmet());
app.use(cors());
app.use(express.json());

// Request logger
app.use(requestLogger);

// Serve static files from the public folder
app.use(express.static(path.join(__dirname, "public")));

// Health check endpoint to confirm the server is running
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", message: "Server is running" });
});

// ---- Swagger / OpenAPI docs (view at /api/docs) ----
const swaggerSpec = {
  openapi: "3.0.0",
  info: {
    title: "WeatherNow Weather Forecast System API",
    version: "1.1.0",
    description: "Beginner-friendly weather API for Philippine cities. Default provider is Open-Meteo (free, no API key). Optionally use OpenWeatherMap via provider=openweathermap (requires OPENWEATHER_API_KEY). Both providers return the same response shape.",
  },
  servers: [{ url: `http://localhost:${PORT}` }],
  paths: {
    "/api/health": {
      get: {
        summary: "Health check",
        description: "Confirm the server is running.",
        responses: {
          200: {
            description: "Server is running",
            content: {
              "application/json": {
                example: { status: "ok", message: "Server is running" },
              },
            },
          },
        },
      },
    },
    "/api/weather": {
      get: {
        summary: "Get weather for a Philippine city",
        description: "Provide `?city=Cebu City` (or coordinates). Default provider is Open-Meteo (no key). Add `?provider=openweathermap` to use OpenWeatherMap (requires OPENWEATHER_API_KEY in server .env). Both return current, hourly, daily, sunrise/sunset & UV.",
        parameters: [
          {
            in: "query",
            name: "city",
            schema: { type: "string", example: "Mati City" },
            description: "Philippine city name, e.g. `Mati City`, `Butuan City`, `Cebu City`, `Manila`.",
          },
          {
            in: "query",
            name: "provider",
            schema: { type: "string", enum: ["openmeteo", "openweathermap"], example: "openweathermap" },
            description: "Data provider: `openmeteo` (default, no key needed) or `openweathermap` (requires OPENWEATHER_API_KEY).",
          },
          {
            in: "query",
            name: "latitude",
            schema: { type: "number", example: 8.94917 },
            description: "Latitude (alternative to city).",
          },
          {
            in: "query",
            name: "longitude",
            schema: { type: "number", example: 125.54361 },
            description: "Longitude (alternative to city).",
          },
        ],
        responses: {
          200: {
            description: "Weather data",
            content: {
              "application/json": {
                example: {
                  success: true,
                  provider: "openmeteo",
                  location: { name: "Mati City", country: "Philippines", admin1: "Davao Oriental", latitude: 7.475, longitude: 126.216 },
                  current: { time: "2026-11-06T19:30", temperature: 27.1, feelsLike: 31.2, humidity: 82, windSpeed: 10.5, windUnit: "km/h", pressure: 1012.1, visibility: 10, weatherCode: 1, condition: "Partly Cloudy", icon: "cloud-sun" },
                  today: { sunrise: "2026-11-06T05:28", sunset: "2026-11-06T17:14", uvIndexMax: 7.75, uvLabel: "High", tempMax: 32.1, tempMin: 25.4 },
                  timezone: "Asia/Manila",
                },
              },
            },
          },
          400: { description: "Missing city / coordinates, or invalid provider" },
          404: { description: "City not found in the Philippines" },
          429: { description: "OpenWeatherMap rate limit reached" },
          502: { description: "Upstream weather provider temporarily unavailable" },
          503: { description: "OPENWEATHER_API_KEY not configured (only for provider=openweathermap)" },
        },
      },
    },
    "/api/favorites": {
      get: {
        summary: "List favorite cities",
        description: "Returns all saved favorite cities (newest first).",
        responses: {
          200: {
            description: "Favorite cities",
            content: {
              "application/json": {
                example: { success: true, data: [{ id: 1, city: "Butuan", country: "Philippines", admin1: "Agusan del Norte", latitude: 8.94917, longitude: 125.54361, created_at: "2026-11-08 10:00:00" }] },
              },
            },
          },
        },
      },
      post: {
        summary: "Add a favorite city (name-only)",
        description: "Send only city (the name). The server auto-resolves Philippines coordinates (and country/region) via Open-Meteo geocoding and saves the favorite. ID is assigned by the server. Older clients may still send latitude/longitude/country/admin1 and they are used as-is instead of geocoding. Duplicate cities (same name + coordinates) are ignored.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["city"],
                properties: {
                  city: { type: "string", example: "Cebu City" },
                },
              },
            },
          },
        },
        responses: {
          200: { description: "Updated favorites list" },
          400: { description: "city is required" },
          404: { description: "City not found in the Philippines" },
          502: { description: "Geocoding provider temporarily unavailable" },
        },
      },
    },
    "/api/favorites/{id}": {
      get: {
        summary: "Get a favorite city by id",
        parameters: [{ in: "path", name: "id", required: true, schema: { type: "integer", example: 1 } }],
        responses: {
          200: { description: "The favorite city" },
          404: { description: "Favorite not found" },
        },
      },
      put: {
        summary: "Rename a favorite city (name-only)",
        description: "Send only city in the body; the ID is the path param. Only the name is updated — coordinates/region stay unchanged. For advanced updates (coordinates/region), use PATCH.",
        parameters: [{ in: "path", name: "id", required: true, schema: { type: "integer", example: 1 } }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["city"],
                properties: {
                  city: { type: "string", example: "Cebu City" },
                },
              },
            },
          },
        },
        responses: {
          200: { description: "The updated favorite city" },
          400: { description: "city is required" },
          404: { description: "Favorite not found" },
          409: { description: "Another favorite already has the same city and coordinates" },
        },
      },
      patch: {
        summary: "Partially update a favorite city (e.g. rename)",
        description: "Updates only the provided fields (city, latitude, longitude, country, admin1) — at least one is required. Returns the updated favorite including its updated_at timestamp.",
        parameters: [{ in: "path", name: "id", required: true, schema: { type: "integer", example: 1 } }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  city: { type: "string", example: "Mati City" },
                  country: { type: "string", example: "Philippines" },
                  admin1: { type: "string", example: "Davao Oriental" },
                  latitude: { type: "number", example: 7.475 },
                  longitude: { type: "number", example: 126.216 },
                },
              },
            },
          },
        },
        responses: {
          200: { description: "The updated favorite city" },
          400: { description: "No valid fields provided" },
          404: { description: "Favorite not found" },
          409: { description: "Another favorite already has the same city and coordinates" },
        },
      },
      delete: {
        summary: "Remove a favorite city",
        parameters: [{ in: "path", name: "id", required: true, schema: { type: "integer", example: 1 } }],
        responses: {
          200: { description: "Updated favorites list" },
        },
      },
    },
  },
};

app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec, { customSiteTitle: "WeatherNow API Docs" }));

// API routes (weather logic lives in routes/ -> controllers/ -> services/)
app.use("/api", weatherRoutes);
app.use("/api", favoritesRoutes);

// 404 + central error handling (must be last)
app.use("/api", notFoundHandler);
app.use(globalErrorHandler);

// Start the server
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log(`API docs at http://localhost:${PORT}/api/docs`);
});
