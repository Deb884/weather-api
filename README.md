# Weather Forecast System (WeatherNow)

A beginner-friendly weather forecast web application built with HTML, CSS, Vanilla JavaScript, Node.js, and Express.js. It uses the [Open-Meteo Weather API](https://open-meteo.com/) (free, no API key required) by default, with an optional [OpenWeatherMap](https://openweathermap.org/api) provider you can switch to.

## Tech Stack

- **Frontend:** HTML, CSS, Vanilla JavaScript
- **Backend:** Node.js + Express.js
- **External APIs:**
  - **Open-Meteo** (default, `provider=openmeteo`, no key, free)
  - **OpenWeatherMap** (optional, `provider=openweathermap`, requires `OPENWEATHER_API_KEY`, free tier 1M calls/month)

## Project Structure

```text
weather-forecast-system/
├── controllers/
│   └── weatherController.js      # routes provider parameter to the right service
├── services/
│   ├── openMeteoService.js       # Open-Meteo (default provider)
│   ├── openWeatherService.js     # OpenWeatherMap (optional provider)
│   └── favoritesService.js       # favorites data access (SQLite)
├── routes/
│   ├── weatherRoutes.js          # GET /api/weather
│   └── favoritesRoutes.js        # GET/POST/DELETE /api/favorites
├── db/
│   └── database.js               # SQLite (sql.js) setup, data/weather.db
├── middleware/
│   └── errorHandler.js
├── data/
│   └── weather.db                # created automatically on first run
├── public/
│   ├── index.html
│   ├── favorites.html            # favorites page (live weather cards)
│   ├── css/
│   │   └── style.css
│   ├── js/
│   │   ├── script.js             # provider dropdown + city search + favorites
│   │   └── favorites.js          # favorites page logic
│   └── assets/
│       ├── logo.svg              # brand logo (header + empty state)
│       ├── favicon.svg           # browser tab icon
│       ├── hero-art.svg          # hero illustration artwork
│       ├── humidity.svg          # Humidity card icon
│       ├── wind.svg              # Wind Speed card icon
│       ├── visibility.svg        # Visibility card icon
│       ├── pressure.svg          # Pressure card icon
│       ├── sunrise.svg           # Sunrise card icon
│       ├── sunset.svg            # Sunset card icon
│       ├── uv.svg                # UV Index card icon
│       ├── star.svg              # filled gold star (favorites page star button)
│       └── edit.svg              # pencil asset (favorites page rename button)
├── server.js
├── package.json
├── .env.example                  # copy to .env
├── .gitignore
└── README.md
```

## Setup Instructions

### Prerequisites

- [Node.js](https://nodejs.org/) installed (includes npm)
- (Optional) A free OpenWeatherMap API key — only needed for `provider=openweathermap`

### 1. Install dependencies

From inside the `weather-forecast-system` folder:

```bash
npm install
```

### 2. Configure environment (required for OpenWeatherMap)

```bash
cp .env.example .env   # Windows: copy .env.example .env
```

Then edit `.env`:

```dotenv
PORT=3000
NODE_ENV=development
OPENWEATHER_API_KEY=your_openweathermap_key_here   # already filled if you shared your key
```

> `.env` is already in `.gitignore` — never commit your real key. Regenerate it at https://home.openweathermap.org/api_keys if you ever shared it publicly.

### 3. Start the server

```bash
npm start
```

Or directly with Node:

```bash
node server.js
```

Then open your browser at:

```text
http://localhost:3000
```

### Health Check

Visit `http://localhost:3000/api/health` to confirm the server is running.

## API Documentation

View interactive docs at:

```text
http://localhost:3000/api/docs
```

### `GET /api/weather`

Choose a provider with the `provider` query parameter. Both return the **same response shape** (`provider`, `location`, `current`, `hourly`, `daily`, `today`, `timezone`), so the frontend works with either.

| Query | Example |
|-------|---------|
| Open-Meteo (default, no key) | `/api/weather?city=Mati City` or `/api/weather?city=Mati City&provider=openmeteo` |
| OpenWeatherMap (key required) | `/api/weather?city=Mati City&provider=openweathermap` |
| By coordinates | `/api/weather?latitude=7.475&longitude=126.216&provider=openweathermap` |

Parameters:
- `city` (string) — Philippine city name, e.g. `Mati City`
- `latitude` / `longitude` (number) — alternative to `city`
- `provider` (string) — `openmeteo` (default) or `openweathermap`

### Manual test

```bash
# Open-Meteo, Mati City
curl "http://localhost:3000/api/weather?city=Mati%20City&provider=openmeteo"

# OpenWeatherMap, Mati City (requires OPENWEATHER_API_KEY in .env)
curl "http://localhost:3000/api/weather?city=Mati%20City&provider=openweathermap"
```

The frontend header has a provider dropdown (Open-Meteo / OpenWeatherMap). The choice is saved in `localStorage` and reapplied on page load. When OpenWeatherMap is selected, the UI shows `weather data © OpenWeather` attribution.

### Error responses

- `400` missing `city`/coordinates or invalid `provider`
- `404` city not found
- `429` OpenWeatherMap rate limit reached
- `502` upstream provider unavailable
- `503` `OPENWEATHER_API_KEY` not configured (only for `provider=openweathermap`)

### Favorites

Save cities with the star (☆) button next to the city name. Favorites are stored server-side (SQLite, `data/weather.db`) so they persist across browsers and devices, with a `localStorage` fallback when the server is unreachable. The **Favorites** page (`http://localhost:3000/favorites.html`, linked from the nav bar) shows live weather for every saved city.

| Endpoint | Description |
|----------|-------------|
| `GET /api/favorites` | List saved favorites (newest first) |
| `GET /api/favorites/:id` | Get one favorite by id (`404` if not found) |
| `POST /api/favorites` | Add a favorite — JSON body `{ city }` only (name-only; the server auto-resolves Philippines coordinates via Open-Meteo geocoding). Older clients may also send `latitude/longitude/country/admin1` and they are used as-is. `404` if the city can't be found. |
| `PUT /api/favorites/:id` | Rename a favorite — JSON body `{ city }` only (name-only update; the ID is the path param, coordinates stay unchanged; `404` if not found, `409` on duplicate) |
| `PATCH /api/favorites/:id` | Partially update a favorite — only the provided fields change (e.g. rename via `{ city: "New Name" }`, or coordinates/region; `404` if not found, `409` on duplicate) |
| `DELETE /api/favorites/:id` | Remove a favorite by id |

Coordinates (when provided) are validated: latitude must be between `-90` and `90`, longitude between `-180` and `180`. Updates stamp `updated_at` on the favorite. On the Favorites page, the ✏️ button renames a favorite and **auto-saves** when you press **Enter** or **click away** (Esc cancels) with a name-only `PATCH` — coordinates stay unchanged.

```bash
# Add Mati City as a favorite (name-only — coordinates auto-resolved)
curl -X POST http://localhost:3000/api/favorites \
  -H "Content-Type: application/json" \
  -d '{"city":"Mati City"}'

# List favorites
curl http://localhost:3000/api/favorites

# Get one favorite
curl http://localhost:3000/api/favorites/1

# Rename favorite 1 only (PUT — name-only, coordinates unchanged)
curl -X PUT http://localhost:3000/api/favorites/1 \
  -H "Content-Type: application/json" \
  -d '{"city":"Cebu City"}'

# Rename favorite 1 only (PATCH — partial update, coordinates unchanged)
curl -X PATCH http://localhost:3000/api/favorites/1 \
  -H "Content-Type: application/json" \
  -d '{"city":"Mati City"}'

# Remove favorite with id 1
curl -X DELETE http://localhost:3000/api/favorites/1
```

## License

ISC
