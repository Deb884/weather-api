// routes/favoritesRoutes.js
import { Router } from "express";
import { getFavorites, getFavoriteById, addFavorite, updateFavorite, patchFavorite, removeFavorite, isValidCoordinates } from "../services/favoritesService.js";
import { resolvePlace, WeatherError } from "../services/openMeteoService.js";

const router = Router();

function validateFavoriteBody(body, { partial = false } = {}) {
  const input = body || {};
  const hasCity = input.city != null && String(input.city).trim() !== "";
  const hasCoords = input.latitude != null && input.longitude != null;

  if (partial) {
    if (!hasCity && !hasCoords && input.country == null && input.admin1 == null) return null;
  } else if (!hasCity || !hasCoords) {
    return null;
  }

  // Validate coordinates when provided (latitude -90..90, longitude -180..180)
  if (input.latitude != null || input.longitude != null) {
    if (!isValidCoordinates(input.latitude, input.longitude)) return null;
  }

  const payload = {};
  if (hasCity) payload.city = String(input.city).trim();
  if (input.country != null) payload.country = String(input.country);
  if (input.admin1 != null) payload.admin1 = String(input.admin1);
  if (input.latitude != null) payload.latitude = Number(input.latitude);
  if (input.longitude != null) payload.longitude = Number(input.longitude);
  return payload;
}

function handleUpdate(req, res, updateFn) {
  try {
    const updated = updateFn(req.params.id, req.validatedPayload);
    if (!updated) {
      return res.status(404).json({ success: false, error: "Favorite not found" });
    }
    res.json({ success: true, data: updated });
  } catch (err) {
    if (err.code === "DUPLICATE") {
      return res.status(409).json({ success: false, error: err.message });
    }
    throw err;
  }
}

// GET /api/favorites
router.get("/favorites", (req, res) => {
  res.json({ success: true, data: getFavorites() });
});

// GET /api/favorites/:id
router.get("/favorites/:id", (req, res) => {
  const favorite = getFavoriteById(req.params.id);
  if (!favorite) {
    return res.status(404).json({ success: false, error: "Favorite not found" });
  }
  res.json({ success: true, data: favorite });
});

// POST /api/favorites  { city } — name-only; coordinates auto-resolved via Open-Meteo geocoding.
// Backward compatible: callers may still send latitude/longitude/country/admin1 and they are used as-is.
router.post("/favorites", async (req, res) => {
  const city = typeof req.body?.city === "string" ? req.body.city.trim() : "";
  if (!city) {
    return res.status(400).json({ success: false, error: "city is required" });
  }
  try {
    let payload;
    if (req.body.latitude != null || req.body.longitude != null) {
      if (!isValidCoordinates(req.body.latitude, req.body.longitude)) {
        return res.status(400).json({
          success: false,
          error: "Invalid coordinates (latitude -90 to 90, longitude -180 to 180)",
        });
      }
      payload = {
        city,
        country: req.body.country != null ? String(req.body.country) : "",
        admin1: req.body.admin1 != null ? String(req.body.admin1) : "",
        latitude: Number(req.body.latitude),
        longitude: Number(req.body.longitude),
      };
    } else {
      // Name-only: auto-resolve Philippines coordinates (and canonical name/region)
      const place = await resolvePlace(city);
      payload = {
        city: place.name,
        country: place.country || "",
        admin1: place.admin1 || "",
        latitude: place.latitude,
        longitude: place.longitude,
      };
    }
    const data = addFavorite(payload);
    res.json({ success: true, data });
  } catch (err) {
    if (err instanceof WeatherError) {
      return res.status(err.status).json({ success: false, error: err.message });
    }
    throw err;
  }
});

// PUT /api/favorites/:id  { city } — name-only rename; ID is the path param, only city is editable.
// Coordinates/region stay unchanged. PATCH remains the advanced partial-update endpoint.
router.put("/favorites/:id", (req, res) => {
  const city = typeof req.body?.city === "string" ? req.body.city.trim() : "";
  if (!city) {
    return res.status(400).json({
      success: false,
      error: "city is required (name-only update)",
    });
  }
  handleUpdate(req, res, (id, _fields) => patchFavorite(id, { city }));
});

// PATCH /api/favorites/:id  { city?, latitude?, longitude?, country?, admin1? } — partial update
router.patch("/favorites/:id", (req, res) => {
  req.validatedPayload = validateFavoriteBody(req.body, { partial: true });
  if (!req.validatedPayload) {
    return res.status(400).json({
      success: false,
      error: "Provide at least one field to update: city, latitude, longitude, country, or admin1 (latitude -90 to 90, longitude -180 to 180)",
    });
  }
  handleUpdate(req, res, patchFavorite);
});

// DELETE /api/favorites/:id
router.delete("/favorites/:id", (req, res) => {
  const data = removeFavorite(req.params.id);
  res.json({ success: true, data });
});

export default router;
