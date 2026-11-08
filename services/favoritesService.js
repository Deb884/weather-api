// services/favoritesService.js
// Data access for the favorites table (SQLite via sql.js)
import db, { saveDb } from "../db/database.js";

function all(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

function run(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  stmt.step();
  stmt.free();
  saveDb(); // write changes back to data/weather.db
  return db.getRowsModified(); // number of rows changed (0 = nothing matched)
}

// Shared coordinate validation: latitude -90..90, longitude -180..180
export function isValidCoordinates(latitude, longitude) {
  const lat = Number(latitude);
  const lon = Number(longitude);
  return Number.isFinite(lat) && lat >= -90 && lat <= 90 && Number.isFinite(lon) && lon >= -180 && lon <= 180;
}

export function getFavorites() {
  return all("SELECT * FROM favorites ORDER BY created_at DESC");
}

export function getFavoriteById(id) {
  return all("SELECT * FROM favorites WHERE id = ?", [id])[0] || null;
}

export function addFavorite({ city, country, admin1, latitude, longitude }) {
  run(
    `INSERT OR IGNORE INTO favorites (city, country, admin1, latitude, longitude)
     VALUES (?, ?, ?, ?, ?)`,
    [city, country || "", admin1 || "", latitude, longitude]
  );
  return getFavorites();
}

function applyUpdate(id, fields) {
  const existing = getFavoriteById(id);
  if (!existing) return null; // not found

  const merged = {
    city: fields.city ?? existing.city,
    country: fields.country ?? existing.country,
    admin1: fields.admin1 ?? existing.admin1,
    latitude: fields.latitude ?? existing.latitude,
    longitude: fields.longitude ?? existing.longitude,
  };

  // Guard against the UNIQUE(city, latitude, longitude) constraint
  const clash = all(
    "SELECT id FROM favorites WHERE city = ? AND latitude = ? AND longitude = ? AND id != ?",
    [merged.city, merged.latitude, merged.longitude, id]
  )[0];
  if (clash) {
    const err = new Error("A favorite with the same city and coordinates already exists");
    err.code = "DUPLICATE";
    throw err;
  }

  run(
    `UPDATE favorites
        SET city = ?, country = ?, admin1 = ?, latitude = ?, longitude = ?,
            updated_at = CURRENT_TIMESTAMP
      WHERE id = ?`,
    [merged.city, merged.country, merged.admin1, merged.latitude, merged.longitude, id]
  );
  return getFavoriteById(id);
}

// PUT = full replacement (caller validates all fields are present)
export function updateFavorite(id, fields) {
  return applyUpdate(id, fields);
}

// PATCH = partial update (only provided fields change)
export function patchFavorite(id, fields) {
  return applyUpdate(id, fields);
}

export function removeFavorite(id) {
  run("DELETE FROM favorites WHERE id = ?", [id]);
  return getFavorites();
}
