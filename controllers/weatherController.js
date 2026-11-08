// controllers/weatherController.js
import { getWeather as getOpenMeteoWeather, WeatherError as MeteoWeatherError } from "../services/openMeteoService.js";
import { getWeather as getOpenWeatherWeather, WeatherError as OpenWeatherError } from "../services/openWeatherService.js";

// Backward-compatible: ?provider=openmeteo (default) keeps existing behavior.
// New: ?provider=openweathermap uses OpenWeatherMap (requires OPENWEATHER_API_KEY in .env).
// Both providers return the same response shape so the frontend works unchanged.
export async function getWeatherHandler(req, res) {
  const { city = "", latitude, longitude, name, country, provider } = req.query;
  const normalizedProvider = (provider || "openmeteo").toString().toLowerCase();

  if (!["openmeteo", "open-meteo", "openweathermap", "openweather"].includes(normalizedProvider)) {
    return res.status(400).json({ success: false, error: "Invalid provider. Use provider=openmeteo (default) or provider=openweathermap." });
  }

  const useOpenWeather = ["openweathermap", "openweather"].includes(normalizedProvider);
  const getWeather = useOpenWeather ? getOpenWeatherWeather : getOpenMeteoWeather;
  const WeatherErrorClass = useOpenWeather ? OpenWeatherError : MeteoWeatherError;

  try {
    const data = await getWeather({ city, latitude, longitude, name, country });
    res.json(data);
  } catch (err) {
    if (err instanceof WeatherErrorClass || err instanceof MeteoWeatherError || err instanceof OpenWeatherError) {
      return res.status(err.status).json({ success: false, error: err.message });
    }
    console.error("Weather API error:", err.message);
    return res.status(502).json({ success: false, error: "Weather service temporarily unavailable. Please try again." });
  }
}
