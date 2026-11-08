// services/openMeteoService.js
// Talks to the free Open-Meteo API (no key needed) and returns a clean object
import { weatherInfo, uvLabel } from "../utils/weatherCodes.js";

const GEOCODE_URL = "https://geocoding-api.open-meteo.com/v1/search";
const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";

class WeatherError extends Error {
  constructor(message, status = 502) {
    super(message);
    this.status = status;
  }
}

// Step 1: city name -> lat/lon (Philippines only)
export async function resolvePlace(city, lat, lon, name, country) {
  if (Number.isFinite(lat) && Number.isFinite(lon)) {
    return { name: name || "Custom Location", country: country || "", latitude: lat, longitude: lon };
  }

  // Retry without trailing " City" ("Butuan City" -> "Butuan")
  const namesToTry = [city];
  if (/ city$/i.test(city)) namesToTry.push(city.replace(/ city$/i, ""));

  let geo = null;
  for (const lookupName of namesToTry) {
    const params = new URLSearchParams({
      name: lookupName,
      count: "5",
      language: "en",
      countryCode: "PH",
    });
    const geoRes = await fetch(`${GEOCODE_URL}?${params.toString()}`);
    if (!geoRes.ok) throw new WeatherError("Geocoding request failed", 502);
    geo = await geoRes.json();
    if (geo.results?.length > 0) break;
  }

  if (!geo?.results?.length) {
    throw new WeatherError(
      `City "${city}" not found in the Philippines. Try another Philippine city like Cebu, Davao, or Manila.`,
      404
    );
  }

  const best = geo.results[0];
  return {
    name: best.name,
    country: best.country || "Philippines",
    admin1: best.admin1 || "",
    latitude: best.latitude,
    longitude: best.longitude,
  };
}

// Step 2: lat/lon -> full weather payload
export async function getWeather({ city = "", latitude, longitude, name, country }) {
  const lat = parseFloat(latitude);
  const lon = parseFloat(longitude);

  if (!city && !Number.isFinite(lat)) {
    throw new WeatherError("Please provide a city name, e.g. ?city=Butuan", 400);
  }

  const place = await resolvePlace(city, lat, lon, name, country);

  const forecastParams = new URLSearchParams({
    latitude: String(place.latitude),
    longitude: String(place.longitude),
    current: "temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,pressure_msl,visibility",
    hourly: "temperature_2m,weather_code",
    daily: "weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,uv_index_max",
    timezone: "Asia/Manila",
    forecast_days: "7",
    temperature_unit: "celsius",
    wind_speed_unit: "kmh",
  });

  const forecastRes = await fetch(`${FORECAST_URL}?${forecastParams.toString()}`);
  if (!forecastRes.ok) throw new WeatherError("Forecast request failed", 502);
  const data = await forecastRes.json();
  const current = data.current || {};

  // Hourly: next 11 hours from now
  const nowHourIndex = Math.max(0, (data.hourly?.time || []).findIndex(
    (t) => t === (data.current?.time || "").slice(0, 13) + ":00"
  ));
  const hourlyStart = nowHourIndex >= 0 ? nowHourIndex : 0;
  const hourly = [];
  for (let i = 0; i < 11; i++) {
    const idx = hourlyStart + i;
    if (!data.hourly?.time?.[idx]) continue;
    const code = data.hourly.weather_code?.[idx];
    const info = weatherInfo(code);
    hourly.push({ time: data.hourly.time[idx], temp: data.hourly.temperature_2m?.[idx], code, condition: info.text, icon: info.icon, isNow: i === 0 });
  }

  // Daily: 7 days
  const daily = (data.daily?.time || []).slice(0, 7).map((date, i) => {
    const code = data.daily.weather_code?.[i];
    const info = weatherInfo(code);
    return {
      date,
      code,
      condition: info.text,
      icon: info.icon,
      tempMax: data.daily.temperature_2m_max?.[i],
      tempMin: data.daily.temperature_2m_min?.[i],
      sunrise: data.daily.sunrise?.[i],
      sunset: data.daily.sunset?.[i],
      uvIndexMax: data.daily.uv_index_max?.[i],
    };
  });

  const firstDay = daily[0] || {};
  const currentInfo = weatherInfo(current.weather_code);

  return {
    success: true,
    provider: "openmeteo",
    location: { name: place.name, country: place.country || "Philippines", admin1: place.admin1 || "", latitude: place.latitude, longitude: place.longitude },
    current: {
      time: current.time,
      temperature: current.temperature_2m,
      feelsLike: current.apparent_temperature,
      humidity: current.relative_humidity_2m,
      windSpeed: current.wind_speed_10m,
      windUnit: "km/h",
      pressure: current.pressure_msl,
      visibility: current.visibility != null ? Math.round((current.visibility / 1000) * 10) / 10 : null,
      weatherCode: current.weather_code,
      condition: currentInfo.text,
      icon: currentInfo.icon,
    },
    daily,
    hourly,
    today: {
      sunrise: firstDay.sunrise,
      sunset: firstDay.sunset,
      uvIndexMax: firstDay.uvIndexMax,
      uvLabel: uvLabel(firstDay.uvIndexMax),
      tempMax: firstDay.tempMax,
      tempMin: firstDay.tempMin,
    },
    timezone: data.timezone || "Asia/Manila",
  };
}

export { WeatherError };
