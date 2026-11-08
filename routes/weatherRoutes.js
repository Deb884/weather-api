// routes/weatherRoutes.js
import { Router } from "express";
import { getWeatherHandler } from "../controllers/weatherController.js";

const router = Router();

// GET /api/weather?city=Butuan%20City  (defaults to Open-Meteo, no key)
// GET /api/weather?city=Mati%20City&provider=openweathermap (uses OpenWeatherMap, requires OPENWEATHER_API_KEY)
router.get("/weather", getWeatherHandler);

export default router;
