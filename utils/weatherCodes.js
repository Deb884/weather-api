// utils/weatherCodes.js
// Friendly text + Lucide icon for each Open-Meteo WMO weather code
export const WEATHER_CODES = {
  0: { text: "Clear Sky", icon: "sun" },
  1: { text: "Partly Cloudy", icon: "cloud-sun" },
  2: { text: "Partly Cloudy", icon: "cloud-sun" },
  3: { text: "Overcast", icon: "cloud" },
  45: { text: "Fog", icon: "cloud-fog" },
  48: { text: "Fog", icon: "cloud-fog" },
  51: { text: "Drizzle", icon: "cloud-drizzle" },
  53: { text: "Drizzle", icon: "cloud-drizzle" },
  55: { text: "Drizzle", icon: "cloud-drizzle" },
  56: { text: "Freezing Drizzle", icon: "cloud-drizzle" },
  57: { text: "Freezing Drizzle", icon: "cloud-drizzle" },
  61: { text: "Light Rain", icon: "cloud-rain" },
  63: { text: "Rain", icon: "cloud-rain" },
  65: { text: "Heavy Rain", icon: "cloud-rain" },
  66: { text: "Freezing Rain", icon: "cloud-rain" },
  67: { text: "Freezing Rain", icon: "cloud-rain" },
  71: { text: "Snow", icon: "cloud-snow" },
  73: { text: "Snow", icon: "cloud-snow" },
  75: { text: "Heavy Snow", icon: "cloud-snow" },
  77: { text: "Snow Grains", icon: "cloud-snow" },
  80: { text: "Rain Showers", icon: "cloud-rain" },
  81: { text: "Rain Showers", icon: "cloud-rain" },
  82: { text: "Violent Rain Showers", icon: "cloud-rain" },
  85: { text: "Snow Showers", icon: "cloud-snow" },
  86: { text: "Snow Showers", icon: "cloud-snow" },
  95: { text: "Thunderstorm", icon: "cloud-lightning" },
  96: { text: "Thunderstorm with Hail", icon: "cloud-lightning" },
  99: { text: "Thunderstorm with Hail", icon: "cloud-lightning" },
};

export function weatherInfo(code) {
  return WEATHER_CODES[code] || { text: "Weather", icon: "cloud-sun" };
}

export function uvLabel(uv) {
  if (uv == null) return "—";
  if (uv <= 2) return "Low";
  if (uv <= 5) return "Moderate";
  if (uv <= 7) return "High";
  if (uv <= 10) return "Very High";
  return "Extreme";
}
