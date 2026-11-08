// services/openWeatherService.js
// Talks to the free OpenWeatherMap API (requires OPENWEATHER_API_KEY) and returns the same clean shape as openMeteoService.js
import { uvLabel } from "../utils/weatherCodes.js";

const CURRENT_URL = "https://api.openweathermap.org/data/2.5/weather";
const FORECAST_URL = "https://api.openweathermap.org/data/2.5/forecast";

class WeatherError extends Error {
  constructor(message, status = 502) {
    super(message);
    this.status = status;
  }
}

// Map an OpenWeatherMap condition ID to friendly text + Lucide icon (compatible with frontend ICON_MAP)
function openWeatherInfo(id) {
  if (id >= 200 && id <= 232) return { text: "Thunderstorm", icon: "cloud-lightning" };
  if (id >= 300 && id <= 321) return { text: "Drizzle", icon: "cloud-drizzle" };
  if (id >= 500 && id <= 531) return { text: "Rain", icon: "cloud-rain" };
  if (id >= 600 && id <= 622) return { text: "Snow", icon: "cloud-snow" };
  if (id >= 701 && id <= 804) {
    if (id === 800) return { text: "Clear Sky", icon: "sun" };
    if (id === 801 || id === 802) return { text: "Partly Cloudy", icon: "cloud-sun" };
    if (id === 803) return { text: "Broken Clouds", icon: "cloud-sun" };
    if (id === 804) return { text: "Overcast", icon: "cloud" };
    return { text: "Fog", icon: "cloud-fog" };
  }
  return { text: "Weather", icon: "cloud-sun" };
}

function mainDescription(weatherArray, fallback = "") {
  if (Array.isArray(weatherArray) && weatherArray.length > 0) return weatherArray[0].description || fallback;
  return fallback;
}

function getDateInManila(dtSeconds) {
  // Returns YYYY-MM-DD in Asia/Manila timezone for proper daily grouping
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(new Date(dtSeconds * 1000));
}

function buildLocationQuery(city) {
  // Bias to Philippines: "Mati City" -> "Mati City,PH", if user already added ",PH" or ",Philippines" keep as is
  if (/,\s*(ph|philippines|phil)$/i.test(city)) return city;
  return `${city},PH`;
}

async function fetchJson(url) {
  let response;
  try {
    response = await fetch(url);
  } catch {
    throw new WeatherError("OpenWeatherMap request failed (network). Please try again.", 502);
  }

  let data;
  try {
    data = await response.json();
  } catch {
    throw new WeatherError("Invalid response from OpenWeatherMap.", 502);
  }

  // OpenWeatherMap returns { cod: 404, message: "city not found" } with HTTP 404
  const cod = String(data.cod ?? response.status);
  if (!response.ok) {
    if (cod === "404") {
      throw new WeatherError(`City "${data.message || "not found"}". Try a Philippine city like Mati City, Cebu, Davao, or Manila.`, 404);
    }
    if (cod === "401") {
      throw new WeatherError("Invalid OpenWeatherMap API key.", 503);
    }
    if (cod === "429") {
      throw new WeatherError("OpenWeatherMap rate limit reached. Please try again later.", 429);
    }
    throw new WeatherError("OpenWeatherMap request failed.", 502);
  }

  return data;
}

export async function getWeather({ city = "", latitude, longitude, name, country }) {
  const apiKey = process.env.OPENWEATHER_API_KEY;

  if (!apiKey) {
    throw new WeatherError("OPENWEATHER_API_KEY is not configured on the server. Add it to the .env file or use provider=openmeteo (no key needed).", 503);
  }

  const lat = parseFloat(latitude);
  const lon = parseFloat(longitude);
  const hasCoords = Number.isFinite(lat) && Number.isFinite(lon);

  if (!city && !hasCoords) {
    throw new WeatherError("Please provide a city name, e.g. ?city=Mati City", 400);
  }

  const commonParams = new URLSearchParams({
    appid: apiKey,
    units: "metric",
  });

  if (hasCoords) {
    commonParams.set("lat", String(lat));
    commonParams.set("lon", String(lon));
  } else {
    commonParams.set("q", buildLocationQuery(city));
  }

  const [currentData, forecastData] = await Promise.all([
    fetchJson(`${CURRENT_URL}?${commonParams.toString()}`),
    fetchJson(`${FORECAST_URL}?${commonParams.toString()}`),
  ]);

  const place = {
    name: currentData.name || name || city || "Custom Location",
    country: currentData.sys?.country || country || "",
    admin1: "",
    // Use current weather coords (canonical) if available, else the requested coords
    // Do NOT leak API key — only return location data
    latitude: currentData.coord?.lat ?? lat,
    longitude: currentData.coord?.lon ?? lon,
  };

  const currentInfo = openWeatherInfo(currentData.weather?.[0]?.id);
  const sunriseIso = currentData.sys?.sunrise ? new Date(currentData.sys.sunrise * 1000).toISOString() : null;
  const sunsetIso = currentData.sys?.sunset ? new Date(currentData.sys.sunset * 1000).toISOString() : null;

  const windKmh = currentData.wind?.speed != null ? Math.round(currentData.wind.speed * 3.6 * 10) / 10 : null;
  const visibilityKm = currentData.visibility != null ? Math.round((currentData.visibility / 1000) * 10) / 10 : null;

  // --- Hourly: next 11 entries (3-hourly on free tier) ---
  const rawList = Array.isArray(forecastData.list) ? forecastData.list : [];
  const hourly = rawList.slice(0, 11).map((entry, idx) => {
    const info = openWeatherInfo(entry.weather?.[0]?.id);
    return {
      time: new Date(entry.dt * 1000).toISOString(),
      temp: entry.main?.temp,
      code: entry.weather?.[0]?.id,
      condition: info.text,
      icon: info.icon,
      isNow: idx === 0,
    };
  });

  // --- Daily: group 3-hourly entries by Manila date and compute min/max ---
  const byDate = new Map();
  for (const entry of rawList) {
    const dateKey = getDateInManila(entry.dt);
    const info = openWeatherInfo(entry.weather?.[0]?.id);
    if (!byDate.has(dateKey)) {
      byDate.set(dateKey, {
        date: dateKey,
        temps: [],
        entries: [],
        code: entry.weather?.[0]?.id,
        condition: info.text,
        icon: info.icon,
      });
    }
    const bucket = byDate.get(dateKey);
    bucket.temps.push(entry.main?.temp);
    bucket.entries.push(entry);
  }

  const daily = [...byDate.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(0, 7)
    .map(([date, bucket]) => {
      // Use the midday entry's condition as the representative for the day
      const midEntry = bucket.entries[Math.floor(bucket.entries.length / 2)] || bucket.entries[0];
      const midInfo = openWeatherInfo(midEntry?.weather?.[0]?.id);
      return {
        date,
        code: midEntry?.weather?.[0]?.id ?? bucket.code,
        condition: midInfo.text,
        icon: midInfo.icon,
        tempMax: bucket.temps.length ? Math.max(...bucket.temps) : null,
        tempMin: bucket.temps.length ? Math.min(...bucket.temps) : null,
        sunrise: date === getDateInManila(currentData.sys?.sunrise ?? 0) ? sunriseIso : undefined,
        sunset: date === getDateInManila(currentData.sys?.sunset ?? 0) ? sunsetIso : undefined,
        uvIndexMax: null,
      };
    });

  const firstDay = daily[0] || {};

  return {
    success: true,
    provider: "openweathermap",
    location: {
      name: place.name,
      country: place.country || "Philippines",
      admin1: place.admin1 || "",
      latitude: place.latitude,
      longitude: place.longitude,
    },
    current: {
      time: new Date(currentData.dt * 1000).toISOString(),
      temperature: currentData.main?.temp,
      feelsLike: currentData.main?.feels_like,
      humidity: currentData.main?.humidity,
      windSpeed: windKmh,
      windUnit: "km/h",
      pressure: currentData.main?.pressure,
      visibility: visibilityKm,
      weatherCode: currentData.weather?.[0]?.id,
      condition: currentInfo.text,
      description: mainDescription(currentData.weather, currentInfo.text),
      icon: currentInfo.icon,
    },
    daily,
    hourly,
    today: {
      sunrise: sunriseIso,
      sunset: sunsetIso,
      uvIndexMax: null,
      uvLabel: uvLabel(null),
      tempMax: firstDay.tempMax ?? null,
      tempMin: firstDay.tempMin ?? null,
    },
    timezone: "Asia/Manila",
  };
}

export { WeatherError };
