// WeatherNow — Favorites page (live weather for saved cities via /api/favorites + /api/weather)
document.addEventListener("DOMContentLoaded", () => {
  if (window.lucide) lucide.createIcons();
  const renderIcons = () => { if (window.lucide) window.lucide.createIcons(); };

  const ICON_MAP = {
    sun: "sun", "cloud-sun": "cloud-sun", cloud: "cloud", "cloud-fog": "cloud-fog",
    "cloud-drizzle": "cloud-drizzle", "cloud-rain": "cloud-rain",
    "cloud-snow": "cloud-snow", "cloud-lightning": "cloud-lightning",
  };

  const grid = document.querySelector("#favorites-grid");
  const emptyState = document.querySelector("#favorites-empty");
  const countLabel = document.querySelector("#favorites-count-label");
  const refreshBtn = document.querySelector("#favorites-refresh");
  const toast = document.querySelector("#toast");
  const menuToggle = document.querySelector("#menu-toggle");
  const navLinks = document.querySelector("#nav-links");
  const navBadge = document.querySelector("#nav-fav-count");

  let toastTimer;
  function showToast(message, isError = false) {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.toggle("toast--error", isError);
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), 3500);
  }

  const getProvider = () => (localStorage.getItem("weathernow-provider") || "openmeteo").toLowerCase();

  const escapeHtml = (s) =>
    String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  function updateProviderLabel() {
    const el = document.querySelector("#footer-provider");
    if (el) el.textContent = getProvider() === "openweathermap" ? "OpenWeatherMap" : "Open-Meteo";
  }

  async function loadFavorites() {
    try {
      const res = await fetch("/api/favorites");
      if (!res.ok) throw new Error(`Server returned ${res.status}`);
      const data = await res.json();
      return Array.isArray(data?.data) ? data.data : [];
    } catch {
      // Offline fallback: localStorage only stores names (no coordinates)
      try {
        const arr = JSON.parse(localStorage.getItem("weathernow-favorites") || "[]");
        return (Array.isArray(arr) ? arr : []).filter(Boolean).map((city) => ({ city: String(city) }));
      } catch {
        return [];
      }
    }
  }

  async function fetchWeatherFor(fav) {
    const params = new URLSearchParams({ provider: getProvider() });
    if (Number.isFinite(fav.latitude) && Number.isFinite(fav.longitude)) {
      params.set("latitude", String(fav.latitude));
      params.set("longitude", String(fav.longitude));
      if (fav.city) params.set("city", fav.city);
    } else {
      params.set("city", fav.city);
    }
    const res = await fetch(`/api/weather?${params.toString()}`);
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.success) {
      throw new Error(data?.error || `Could not load weather for ${fav.city}`);
    }
    return data;
  }

  function cardHtml(fav, weather) {
    const city = escapeHtml(fav.city);
    const region = [fav.admin1, fav.country].filter(Boolean).map(escapeHtml).join(", ");
    const removeAttrs = fav.id != null ? `data-remove-id="${fav.id}"` : `data-remove-city="${city}"`;
    const starBtn = `<button type="button" class="fav-card__star is-favorite" ${removeAttrs} aria-label="Remove ${city} from favorites" aria-pressed="true" title="Remove from favorites (tap the star)"><img class="fav-star-asset" src="assets/star.svg" alt="" /></button>`;
    const editBtn = `<button type="button" class="fav-card__edit" aria-label="Rename ${city}" title="Rename favorite"><img class="fav-edit-asset" src="assets/edit.svg" alt="" /></button>`;
    const editForm = `<form class="fav-card__edit-form" hidden>
      <label class="fav-card__edit-label">New name
        <input class="fav-card__edit-input" type="text" value="${city}" maxlength="80" />
      </label>
      <p class="fav-card__edit-hint">Auto-saves when you press Enter or click away — Esc to cancel.</p>
    </form>`;
    if (!weather) {
      return `<article class="fav-card glass" data-city="${city}" data-id="${fav.id ?? ""}">
        <div class="fav-card__head"><h3>${city}</h3>
          <span class="fav-card__actions">${starBtn}${editBtn}<button type="button" class="fav-card__remove" ${removeAttrs} aria-label="Remove ${city} from favorites" title="Remove">×</button></span></div>
        ${editForm}
        <p class="fav-card__region">${region}</p>
        <p class="fav-card__error">Weather unavailable right now.</p>
        <a class="fav-card__cta" href="index.html?city=${encodeURIComponent(fav.city)}">View forecast <i data-lucide="arrow-right"></i></a>
      </article>`;
    }
    const c = weather.current || {};
    const t = weather.today || {};
    return `<article class="fav-card glass" data-city="${city}" data-id="${fav.id ?? ""}">
      <div class="fav-card__head"><h3>${city}</h3>
        <span class="fav-card__actions">${starBtn}${editBtn}<button type="button" class="fav-card__remove" ${removeAttrs} aria-label="Remove ${city} from favorites" title="Remove">×</button></span></div>
      ${editForm}
      <p class="fav-card__region">${region}</p>
      <div class="fav-card__main">
        <span class="fav-card__icon"><i data-lucide="${ICON_MAP[c.icon] || "cloud-sun"}"></i><button type="button" class="fav-card__circle-star" ${removeAttrs} aria-label="Remove ${city} from favorites" aria-pressed="true" title="Favorite — tap to remove"><i data-lucide="star"></i></button></span>
        <div>
          <p class="fav-card__temp">${c.temperature != null ? Math.round(c.temperature) : "—"}°C</p>
          <p class="fav-card__condition">${escapeHtml(c.condition || "")}</p>
        </div>
      </div>
      <p class="fav-card__hilo">H: ${t.tempMax != null ? Math.round(t.tempMax) : "—"}° · L: ${t.tempMin != null ? Math.round(t.tempMin) : "—"}°</p>
      <a class="fav-card__cta" href="index.html?city=${encodeURIComponent(fav.city)}">View forecast <i data-lucide="arrow-right"></i></a>
    </article>`;
  }

  async function renderFavoritesPage() {
    if (!grid) return;
    updateProviderLabel();
    const favorites = await loadFavorites();

    if (navBadge) {
      navBadge.hidden = favorites.length === 0;
      navBadge.textContent = favorites.length || "";
    }
    if (countLabel) {
      countLabel.textContent = favorites.length
        ? `${favorites.length} saved ${favorites.length === 1 ? "city" : "cities"}`
        : "No saved cities yet";
    }
    if (emptyState) emptyState.hidden = favorites.length > 0;
    if (!favorites.length) { grid.innerHTML = ""; return; }

    grid.innerHTML = `<p class="favorites-loading">Loading weather for ${favorites.length} ${favorites.length === 1 ? "city" : "cities"}…</p>`;

    const results = await Promise.allSettled(favorites.map((fav) => fetchWeatherFor(fav)));
    grid.innerHTML = favorites
      .map((fav, i) => cardHtml(fav, results[i].status === "fulfilled" ? results[i].value : null))
      .join("");
    renderIcons();
  }

  // Rename (edit) flow: pencil opens an inline form; auto-saves on Enter or blur
  // Name-only rename: coordinates / forecast stay the same, only the city name changes.
  // PATCH /api/favorites/:id -> SQLite (data/weather.db) -> re-render everywhere.
  function syncStoredNames(oldCity, newName) {
    try {
      const names = JSON.parse(localStorage.getItem("weathernow-favorites") || "[]");
      const list = (Array.isArray(names) ? names : []).map((n) =>
        String(n).toLowerCase() === String(oldCity).toLowerCase() ? newName : n
      );
      localStorage.setItem("weathernow-favorites", JSON.stringify(list));
    } catch { /* storage unavailable — ignore */ }
  }

  async function saveRename(card, form, input) {
    if (!card || !form || !input || form.dataset.saving === "1") return false;
    const newName = input.value.trim();
    const oldCity = card.dataset.city || "";
    if (!newName) {
      showToast("Please enter a new name for this favorite.", true);
      input.focus();
      return false;
    }
    if (newName.toLowerCase() === oldCity.toLowerCase()) {
      form.hidden = true;
      input.value = oldCity;
      return true;
    }
    form.dataset.saving = "1";
    form.classList.add("is-saving");
    input.disabled = true;
    try {
      const id = card.dataset.id;
      if (id) {
        const res = await fetch(`/api/favorites/${encodeURIComponent(id)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ city: newName }),
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => null);
          throw new Error(errData?.error || `Server returned ${res.status}`);
        }
        syncStoredNames(oldCity, newName);
        showToast(`Renamed "${oldCity}" to "${newName}"`);
      } else {
        syncStoredNames(oldCity, newName);
        showToast(`Renamed "${oldCity}" to "${newName}" (saved locally)`);
      }
      await renderFavoritesPage();
      return true;
    } catch (err) {
      showToast(err.message || "Could not save the new name. Please try again.", true);
      delete form.dataset.saving;
      form.classList.remove("is-saving");
      input.disabled = false;
      input.focus();
      return false;
    }
  }

  grid?.addEventListener("click", async (e) => {
    const editToggle = e.target.closest(".fav-card__edit");
    if (editToggle) {
      const form = editToggle.closest(".fav-card")?.querySelector(".fav-card__edit-form");
      if (form) {
        form.hidden = false;
        const input = form.querySelector(".fav-card__edit-input");
        if (input) { input.focus(); input.select(); }
      }
      return;
    }

    const removeBtn = e.target.closest(".fav-card__remove, .fav-card__star, .fav-card__circle-star");
    if (!removeBtn) return;
    const label = removeBtn.getAttribute("aria-label")?.replace(/^Remove | from favorites$/g, "") || "Favorite";
    removeBtn.disabled = true;
    try {
      if (removeBtn.dataset.removeId) {
        const res = await fetch(`/api/favorites/${encodeURIComponent(removeBtn.dataset.removeId)}`, { method: "DELETE" });
        if (!res.ok) throw new Error(`Server returned ${res.status}`);
      } else {
        // LocalStorage-only favorite: remove by name locally
        const names = JSON.parse(localStorage.getItem("weathernow-favorites") || "[]");
        localStorage.setItem("weathernow-favorites", JSON.stringify((Array.isArray(names) ? names : []).filter((n) => n.toLowerCase() !== removeBtn.dataset.removeCity.toLowerCase())));
      }
      showToast(`${label} removed from favorites`);
      await renderFavoritesPage();
    } catch (err) {
      showToast(err.message || "Could not remove favorite. Please try again.", true);
      removeBtn.disabled = false;
    }
  });

  // Auto-save on Enter (form submit) and on blur (click away); Esc cancels
  grid?.addEventListener("submit", (e) => {
    const form = e.target.closest(".fav-card__edit-form");
    if (!form) return;
    e.preventDefault();
    const card = form.closest(".fav-card");
    const input = form.querySelector(".fav-card__edit-input");
    saveRename(card, form, input);
  });

  grid?.addEventListener("keydown", (e) => {
    const input = e.target.closest(".fav-card__edit-input");
    if (!input) return;
    const form = input.closest(".fav-card__edit-form");
    const card = input.closest(".fav-card");
    if (e.key === "Enter") {
      e.preventDefault();
      saveRename(card, form, input);
    } else if (e.key === "Escape") {
      e.preventDefault();
      if (card?.dataset.city) input.value = card.dataset.city;
      if (form) form.hidden = true;
      input.blur();
    }
  });

  grid?.addEventListener("focusout", (e) => {
    const input = e.target.closest(".fav-card__edit-input");
    if (!input) return;
    const form = input.closest(".fav-card__edit-form");
    const card = input.closest(".fav-card");
    if (e.relatedTarget && form?.contains(e.relatedTarget)) return;
    saveRename(card, form, input);
  });
  refreshBtn?.addEventListener("click", () => {
    renderFavoritesPage().then(() => showToast("Favorites refreshed"));
  });

  if (menuToggle && navLinks) {
    menuToggle.addEventListener("click", () => {
      const isOpen = navLinks.classList.toggle("open");
      menuToggle.setAttribute("aria-expanded", String(isOpen));
      menuToggle.setAttribute("aria-label", isOpen ? "Close menu" : "Open menu");
    });
  }

  renderFavoritesPage();
});
