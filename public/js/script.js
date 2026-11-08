// WeatherNow — frontend (live weather via /api/weather, Open-Meteo default + optional OpenWeatherMap)

document.addEventListener("DOMContentLoaded", () => {
  // Render Lucide icons
  if (window.lucide) {
    lucide.createIcons();
  }

  const ICON_MAP = {
    sun: "sun",
    "cloud-sun": "cloud-sun",
    cloud: "cloud",
    "cloud-fog": "cloud-fog",
    "cloud-drizzle": "cloud-drizzle",
    "cloud-rain": "cloud-rain",
    "cloud-snow": "cloud-snow",
    "cloud-lightning": "cloud-lightning",
  };

  const form = document.querySelector("#search-form");
  const input = document.querySelector("#city-input");
  const button = document.querySelector("#search-btn");
  const providerSelect = document.querySelector("#provider-select");
  const providerNote = document.querySelector("#provider-note");
  const providerLabel = document.querySelector("#provider-label");
  const footerProvider = document.querySelector("#footer-provider");
  const loadingOverlay = document.querySelector("#loading-overlay");
  const toast = document.querySelector("#toast");
  const displayCity = document.querySelector("#display-city");
  const displayCountry = document.querySelector("#display-country");
  const displayCondition = document.querySelector("#display-condition");
  const displayFeels = document.querySelector("#display-feels");
  const displayHigh = document.querySelector("#display-high");
  const displayLow = document.querySelector("#display-low");
  const displayTemp = document.querySelector("#display-temp");
  const displayIcon = document.querySelector("#display-icon");
  const dateEl = document.querySelector("#current-date");
  const detailHumidity = document.querySelector("#detail-humidity");
  const detailWind = document.querySelector("#detail-wind");
  const detailVisibility = document.querySelector("#detail-visibility");
  const detailPressure = document.querySelector("#detail-pressure");
  const extraSunrise = document.querySelector("#extra-sunrise");
  const extraSunset = document.querySelector("#extra-sunset");
  const extraUV = document.querySelector("#extra-uv");
  const hourlyTrack = document.querySelector("#hourly-track");
  const dailyList = document.querySelector("#daily-list");
  const menuToggle = document.querySelector("#menu-toggle");
  const navLinks = document.querySelector("#nav-links");
  const navAnchors = document.querySelectorAll(".nav-link");
  const favoriteBtn = document.querySelector("#favorite-btn");
  const favoritesSection = document.querySelector("#favorites-section");
  const favoritesList = document.querySelector("#favorites-list");
  let currentCity = "";

  let toastTimer;

  // Wait for Lucide (loaded via defer) to be available before first render
  const renderIcons = () => {
    if (window.lucide) window.lucide.createIcons();
  };

  // Provider: openmeteo (default) or openweathermap — persisted in localStorage
  const PROVIDER_STORAGE_KEY = "weathernow-provider";
  const PROVIDER_LABELS = {
    openmeteo: "Open-Meteo",
    openweathermap: "OpenWeatherMap",
  };
  const PROVIDER_NOTES = {
    openmeteo: "Open-Meteo · no key needed · free",
    openweathermap: "OpenWeatherMap · API key · weather data © OpenWeather",
  };

  function getProvider() {
    return (providerSelect?.value || localStorage.getItem(PROVIDER_STORAGE_KEY) || "openmeteo").toLowerCase();
  }

  function updateProviderUI() {
    const provider = getProvider();
    const label = PROVIDER_LABELS[provider] || PROVIDER_LABELS.openmeteo;
    if (providerNote) providerNote.textContent = PROVIDER_NOTES[provider] || PROVIDER_NOTES.openmeteo;
    if (providerLabel) providerLabel.textContent = `Live from ${label}`;
    if (footerProvider) footerProvider.textContent = label;
  }

  if (providerSelect) {
    const stored = localStorage.getItem(PROVIDER_STORAGE_KEY) || "openmeteo";
    if (stored === "openweathermap" || stored === "openmeteo") {
      providerSelect.value = stored;
    }
    updateProviderUI();
    providerSelect.addEventListener("change", () => {
      localStorage.setItem(PROVIDER_STORAGE_KEY, providerSelect.value);
      updateProviderUI();
      const cityName = input?.value?.trim();
      if (cityName) loadWeather(cityName);
    });
  }

  // ---- Favorites (star button, persisted via /api/favorites with a localStorage fallback) ----
  const FAVORITES_STORAGE_KEY = "weathernow-favorites";
  const FAVORITES_SYNCED_KEY = "weathernow-favorites-synced";
  let favorites = []; // [{ id?, city, country?, admin1?, latitude?, longitude? }]
  let currentLocation = null; // latest weather location { name, country, admin1, latitude, longitude }

  const escapeHtml = (s) =>
    String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const getStoredNames = () => {
    try {
      const raw = localStorage.getItem(FAVORITES_STORAGE_KEY);
      const arr = JSON.parse(raw || "[]");
      return Array.isArray(arr) ? [...new Set(arr.filter(Boolean).map(String))] : [];
    } catch {
      return [];
    }
  };

  const setStoredNames = (names) => {
    try { localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(names)); } catch { /* storage unavailable — ignore */ }
  };

  const isFavorite = (city) =>
    Boolean(city) && favorites.some((f) => String(f.city).toLowerCase() === String(city).toLowerCase());

  const findFavorite = (city) =>
    favorites.find((f) => String(f.city).toLowerCase() === String(city).toLowerCase());

  function updateFavoriteBtn() {
    if (!favoriteBtn) return;
    const fav = currentCity ? isFavorite(currentCity) : false;
    favoriteBtn.classList.toggle("is-favorite", fav);
    favoriteBtn.setAttribute("aria-pressed", String(fav));
    favoriteBtn.setAttribute("aria-label", fav ? `Remove ${currentCity} from favorites` : `Add ${currentCity || "city"} to favorites`);
    favoriteBtn.title = fav ? "Remove from favorites" : "Add to favorites";
    const labelEl = favoriteBtn.querySelector(".fav-btn__label");
    if (labelEl) labelEl.textContent = fav ? "Favorited" : "Add to favorites";
  }

  function renderFavorites() {
    const navBadge = document.querySelector("#nav-fav-count");
    if (navBadge) {
      navBadge.hidden = favorites.length === 0;
      navBadge.textContent = favorites.length || "";
    }
    if (!favoritesSection || !favoritesList) return;
    favoritesSection.hidden = favorites.length === 0;
    favoritesList.innerHTML = favorites
      .map((fav) => {
        const city = escapeHtml(fav.city);
        const removeAttrs = fav.id != null ? `data-remove-id="${fav.id}"` : `data-remove-city="${city}"`;
        return `<span class="fav-chip"><button type="button" class="fav-chip__goto" data-city="${city}"><i data-lucide="star"></i> ${city}</button><button type="button" class="fav-chip__remove" ${removeAttrs} title="Remove ${city}" aria-label="Remove ${city} from favorites">×</button></span>`;
      })
      .join("");
    renderIcons();
    updateFavoriteBtn();
  }

  // Load favorites from the server database (source of truth), falling back to
  // localStorage when the server is unreachable. Old localStorage-only favorites
  // are migrated to the server once (resolved via /api/weather to get coordinates).
  async function loadFavorites() {
    let serverList = null;
    try {
      const res = await fetch("/api/favorites");
      if (!res.ok) throw new Error(`Server returned ${res.status}`);
      const data = await res.json();
      serverList = Array.isArray(data?.data) ? data.data : [];
    } catch {
      serverList = null; // server unreachable — offline fallback
    }

    if (serverList) {
      favorites = serverList;
      // One-time migration of pre-backend (localStorage-only) favorites
      if (!localStorage.getItem(FAVORITES_SYNCED_KEY)) {
        const legacyNames = getStoredNames();
        for (const name of legacyNames) {
          if (isFavorite(name)) continue;
          try {
            const wRes = await fetch(`/api/weather?city=${encodeURIComponent(name)}&provider=${encodeURIComponent(getProvider())}`);
            const wData = wRes.ok ? await wRes.json() : null;
            const loc = wData?.location;
            if (loc?.name && Number.isFinite(loc.latitude) && Number.isFinite(loc.longitude)) {
              const pRes = await fetch("/api/favorites", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ city: loc.name, country: loc.country, admin1: loc.admin1, latitude: loc.latitude, longitude: loc.longitude }),
              });
              if (pRes.ok) {
                const pData = await pRes.json();
                if (Array.isArray(pData?.data)) favorites = pData.data;
              }
            }
          } catch { /* skip — favorite stays in localStorage backup */ }
        }
        localStorage.setItem(FAVORITES_SYNCED_KEY, "1");
      }
      setStoredNames(favorites.map((f) => f.city));
    } else {
      favorites = getStoredNames().map((city) => ({ city }));
    }
    renderFavorites();
  }

  async function toggleFavorite() {
    if (!currentCity) return;
    const city = currentCity;
    const existing = findFavorite(city);

    if (existing) {
      favorites = favorites.filter((f) => f !== existing);
      renderFavorites();
      showToast(`${city} removed from favorites`);
      if (existing.id != null) {
        try {
          const res = await fetch(`/api/favorites/${existing.id}`, { method: "DELETE" });
          if (!res.ok) throw new Error(`Server returned ${res.status}`);
          const data = await res.json();
          if (Array.isArray(data?.data)) { favorites = data.data; renderFavorites(); }
        } catch {
          showToast("Saved locally — server unreachable, will sync on reload.", true);
        }
      }
      setStoredNames(favorites.map((f) => f.city));
      return;
    }

    const loc = currentLocation || {};
    const entry = {
      city,
      country: loc.country || "",
      admin1: loc.admin1 || "",
      latitude: loc.latitude,
      longitude: loc.longitude,
    };
    favorites.push(entry);
    renderFavorites();
    showToast(`${city} added to favorites ⭐`);

    if (Number.isFinite(entry.latitude) && Number.isFinite(entry.longitude)) {
      try {
        const res = await fetch("/api/favorites", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(entry),
        });
        if (!res.ok) throw new Error(`Server returned ${res.status}`);
        const data = await res.json();
        if (Array.isArray(data?.data)) { favorites = data.data; renderFavorites(); }
      } catch {
        showToast("Saved locally — server unreachable, will sync on reload.", true);
      }
    }
    setStoredNames(favorites.map((f) => f.city));
  }

  if (favoriteBtn) favoriteBtn.addEventListener("click", toggleFavorite);

  favoritesList?.addEventListener("click", (e) => {
    const removeEl = e.target.closest(".fav-chip__remove");
    if (removeEl) {
      if (removeEl.dataset.removeId) {
        const target = favorites.find((f) => String(f.id) === removeEl.dataset.removeId);
        favorites = favorites.filter((f) => String(f.id) !== removeEl.dataset.removeId);
        renderFavorites();
        showToast(`${target?.city || "Favorite"} removed from favorites`);
        fetch(`/api/favorites/${encodeURIComponent(removeEl.dataset.removeId)}`, { method: "DELETE" })
          .then((r) => (r.ok ? r.json() : null))
          .then((data) => { if (Array.isArray(data?.data)) { favorites = data.data; renderFavorites(); } })
          .catch(() => showToast("Saved locally — server unreachable, will sync on reload.", true));
      } else if (removeEl.dataset.removeCity) {
        const city = removeEl.dataset.removeCity;
        favorites = favorites.filter((f) => String(f.city).toLowerCase() !== city.toLowerCase());
        renderFavorites();
        showToast(`${city} removed from favorites`);
      }
      setStoredNames(favorites.map((f) => f.city));
      return;
    }
    const gotoBtn = e.target.closest(".fav-chip__goto");
    if (gotoBtn?.dataset.city && input) {
      input.value = gotoBtn.dataset.city;
      if (form) {
        if (typeof form.requestSubmit === "function") form.requestSubmit();
        else form.dispatchEvent(new Event("submit", { cancelable: true }));
      }
    }
  });

  loadFavorites();

  function showToast(message, isError = false) {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.toggle("toast--error", isError);
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), 3500);
  }

  function setLoading(isLoading) {
    if (button) button.classList.toggle("is-loading", isLoading);
    if (loadingOverlay) {
      loadingOverlay.classList.toggle("show", isLoading);
      loadingOverlay.setAttribute("aria-hidden", String(!isLoading));
    }
    if (input) input.disabled = isLoading;
    if (button) button.disabled = isLoading;
  }

  function formatHourLabel(isoString) {
    const d = new Date(isoString);
    let h = d.getHours();
    const suffix = h >= 12 ? "PM" : "AM";
    h = h % 12;
    if (h === 0) h = 12;
    return `${h} ${suffix}`;
  }

  function formatDayLabel(isoDate, index) {
    if (index === 0) return "Today";
    const d = new Date(isoDate + "T12:00:00");
    return d.toLocaleDateString("en-US", { weekday: "long" });
  }

  function formatTimeLabel(isoString) {
    const d = new Date(isoString);
    return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  }

  function formatDateLabel(isoString) {
    if (!isoString) return "—";
    const d = new Date(isoString);
    return d.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
  }

  function setIcon(container, iconName) {
    if (!container) return;
    container.innerHTML = `<i data-lucide="${ICON_MAP[iconName] || "cloud-sun"}"></i>`;
  }

  function updateWeather(data) {
    const c = data.current || {};
    const t = data.today || {};
    currentCity = data.location?.name || input?.value?.trim() || "";
    currentLocation = data.location || null;
    if (input && currentCity) input.value = currentCity;
    updateFavoriteBtn();

    if (displayCity) displayCity.textContent = data.location?.name || "—";
    if (displayCountry) displayCountry.textContent = data.location?.country || "";
    if (displayCondition) displayCondition.textContent = c.condition || "—";
    if (displayFeels) displayFeels.textContent = c.feelsLike != null ? `${Math.round(c.feelsLike)}°C` : "—";
    if (displayTemp) displayTemp.textContent = c.temperature != null ? Math.round(c.temperature) : "—";
    if (displayHigh) displayHigh.textContent = t.tempMax != null ? `${Math.round(t.tempMax)}°C` : "—";
    if (displayLow) displayLow.textContent = t.tempMin != null ? `${Math.round(t.tempMin)}°C` : "—";
    if (dateEl) dateEl.textContent = formatDateLabel(c.time);
    if (displayIcon) setIcon(displayIcon, c.icon);

    if (detailHumidity) detailHumidity.innerHTML = c.humidity != null ? `${c.humidity}<span>%</span>` : "—";
    if (detailWind) detailWind.innerHTML = c.windSpeed != null ? `${Math.round(c.windSpeed)} <span>km/h</span>` : "—";
    if (detailVisibility) detailVisibility.innerHTML = c.visibility != null ? `${c.visibility} <span>km</span>` : "—";
    if (detailPressure) detailPressure.innerHTML = c.pressure != null ? `${Math.round(c.pressure)} <span>hPa</span>` : "—";

    if (extraSunrise) extraSunrise.innerHTML = t.sunrise ? `${formatTimeLabel(t.sunrise)}` : "—";
    if (extraSunset) extraSunset.innerHTML = t.sunset ? `${formatTimeLabel(t.sunset)}` : "—";
    if (extraUV) extraUV.innerHTML = t.uvIndexMax != null ? `${Math.round(t.uvIndexMax)} <span>${t.uvLabel || ""}</span>` : "—";

    // Hourly forecast (next 11 hours from now)
    if (hourlyTrack && Array.isArray(data.hourly)) {
      hourlyTrack.innerHTML = data.hourly.map((h) => {
        const label = h.isNow ? "Now" : formatHourLabel(h.time);
        return `<li class="hour-item${h.isNow ? " active" : ""}">
          <span class="hour-time">${label}</span>
          <span class="hour-icon"><i data-lucide="${ICON_MAP[h.icon] || "cloud-sun"}"></i></span>
          <span class="hour-temp">${Math.round(h.temp)}°C</span>
        </li>`;
      }).join("");
    }

    // 7-day forecast
    if (dailyList && Array.isArray(data.daily)) {
      dailyList.innerHTML = data.daily.map((d, i) => {
        const label = formatDayLabel(d.date, i);
        return `<li class="day-item">
          <span class="day-name">${label}</span>
          <span class="day-icon"><i data-lucide="${ICON_MAP[d.icon] || "cloud-sun"}"></i></span>
          <span class="day-condition">${d.condition || ""}</span>
          <span class="day-temps"><strong>${Math.round(d.tempMax)}°</strong> / ${Math.round(d.tempMin)}°</span>
        </li>`;
      }).join("");
    }

    // Re-render icons for the new content
    renderIcons();
  }

  async function loadWeather(city) {
    setLoading(true);
    try {
      let res, data;
      try {
        res = await fetch(`/api/weather?city=${encodeURIComponent(city)}&provider=${encodeURIComponent(getProvider())}`);
        const text = await res.text();
        try {
          data = JSON.parse(text);
        } catch {
          throw new Error("Server returned an unexpected response. Make sure you opened http://localhost:3000 (not the file directly) and the server is running.");
        }
      } catch (networkErr) {
        // TypeError: Failed to fetch — usually server stopped, offline, or page opened via file://
        if (networkErr instanceof TypeError) {
          throw new Error("Cannot connect to the server. Make sure to run `npm start` and open http://localhost:3000, then try again.");
        }
        throw networkErr;
      }

      if (!res.ok || !data.success) {
        throw new Error(data.error || "City not found. Try a Philippine city like Cebu, Davao, or Manila.");
      }

      updateWeather(data);
      return true;
    } catch (err) {
      showToast(err.message || "Something went wrong. Please try again.", true);
      return false;
    } finally {
      setLoading(false);
    }
  }

  // Search: click + Enter (form submit covers both, Enter included)
  async function handleSearch(event) {
    event.preventDefault();
    const city = input ? input.value.trim() : "";

    if (!city) {
      if (form) {
        form.classList.add("has-error");
        setTimeout(() => form.classList.remove("has-error"), 450);
      }
      showToast("Please enter a city name to search.", true);
      if (input) input.focus();
      return;
    }

    const ok = await loadWeather(city);
    if (ok && input) input.select();
  }

  if (form) form.addEventListener("submit", handleSearch);

  // ---- Search filter: live autocomplete for Philippine cities ----
  const PHILIPPINE_CITIES = [
    "Manila", "Quezon City", "Makati", "Pasig", "Taguig", "Mandaluyong",
    "Mati City", "Cebu City", "Davao City", "Butuan City", "Zamboanga City",
    "Tagbilaran City", "Tacloban City", "Puerto Princesa", "Baguio",
    "Angeles City", "San Fernando City", "Olongapo City",
    "Bacolod City", "Iloilo City", "Roxas City",
    "Cagayan de Oro", "Cotabato City", "Kidapawan", "Dumaguete",
    "Dipolog City", "Surigao City", "Legazpi City", "Naga City",
    "Sorsogon City", "Laoag City", "Tuguegarao City",
    "Batangas City", "Lipa City", "Calamba", "Santa Rosa",
    "Balanga", "Cabanatuan City", "Dagupan City", "San Pablo",
    "Tanauan City", "Iriga City", "Masbate City", "Passi City",
    "Kabankalan", "La Carlota", "Talisay City", "Ormoc City",
    "Baybay City", "Valencia City", "Pagadian City", "Ozamis City",
    "Oroquieta City", "Tandag", "Bislig City", "Malaybalay City",
    "El Salvador City", "Catbalogan City", "Calbayog City",
  ].map((c) => c.trim());

  const autocompleteList = document.querySelector("#autocomplete-list");
  let filteredCities = [];
  let activeIndex = -1;

  function escapeRegExp(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  // Filter: starts-with matches first, then contains, max 6, case-insensitive
  function filterCities(query) {
    const q = query.trim().toLowerCase();
    if (q.length < 1) return [];
    const starts = PHILIPPINE_CITIES.filter((c) => c.toLowerCase().startsWith(q));
    const contains = PHILIPPINE_CITIES.filter(
      (c) => !c.toLowerCase().startsWith(q) && c.toLowerCase().includes(q)
    );
    return [...starts, ...contains].slice(0, 6);
  }

  function hideSuggestions() {
    activeIndex = -1;
    filteredCities = [];
    if (autocompleteList) autocompleteList.classList.remove("show");
    if (input) {
      input.setAttribute("aria-expanded", "false");
      input.setAttribute("aria-activedescendant", "");
    }
  }

  function renderSuggestions() {
    if (!autocompleteList || !input) return;
    if (filteredCities.length === 0) {
      const q = input.value.trim();
      if (q.length > 0) {
        autocompleteList.innerHTML = `<li class="autocomplete-empty">No matches for "${q}"</li>`;
        autocompleteList.classList.add("show");
      } else {
        hideSuggestions();
      }
      return;
    }

    const q = input.value.trim();
    const pattern = new RegExp(`(${escapeRegExp(q)})`, "gi");
    autocompleteList.innerHTML = filteredCities
      .map((city, i) => {
        const highlighted = city.replace(pattern, "<mark>$1</mark>");
        return `<li class="autocomplete-item${i === activeIndex ? " is-active" : ""}" role="option" id="suggest-${i}" data-city="${city}" aria-selected="${i === activeIndex}">
          <i data-lucide="map-pin"></i><span>${highlighted}</span>
        </li>`;
      })
      .join("");
    autocompleteList.classList.add("show");
    input.setAttribute("aria-expanded", "true");
    if (activeIndex >= 0) input.setAttribute("aria-activedescendant", `suggest-${activeIndex}`);
    renderIcons();
  }

  function updateActive(newIndex) {
    if (filteredCities.length === 0) return;
    activeIndex = (newIndex + filteredCities.length) % filteredCities.length;
    [...autocompleteList.querySelectorAll(".autocomplete-item")].forEach((el, i) => {
      el.classList.toggle("is-active", i === activeIndex);
      el.setAttribute("aria-selected", String(i === activeIndex));
      el.scrollIntoView({ block: "nearest" });
    });
    input.setAttribute("aria-activedescendant", `suggest-${activeIndex}`);
  }

  function selectCity(city) {
    if (!input) return;
    input.value = city;
    hideSuggestions();
    // Trigger the same search flow as pressing Search / Enter
    if (form) {
      if (typeof form.requestSubmit === "function") form.requestSubmit();
      else form.dispatchEvent(new Event("submit", { cancelable: true }));
    }
  }

  let debounceTimer;
  function handleInput() {
    if (form) form.classList.remove("has-error");
    const q = input ? input.value : "";
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      filteredCities = filterCities(q);
      activeIndex = -1;
      renderSuggestions();
    }, 120);
  }

  // Clear error state as the user types AND filter suggestions
  if (input) {
    input.addEventListener("input", handleInput);

    // Keyboard navigation for the dropdown
    input.addEventListener("keydown", (e) => {
      const isOpen = autocompleteList?.classList.contains("show") && filteredCities.length > 0;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        updateActive(activeIndex + 1);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        updateActive(activeIndex - 1);
      } else if (e.key === "Escape") {
        hideSuggestions();
      } else if (e.key === "Enter" && isOpen && activeIndex >= 0) {
        // Enter selects highlighted suggestion instead of submitting empty query
        e.preventDefault();
        selectCity(filteredCities[activeIndex]);
      }
    });

    // Click-away closes the dropdown
    document.addEventListener("click", (e) => {
      if (!autocompleteList?.contains(e.target) && !input?.contains(e.target)) {
        hideSuggestions();
      }
    });

    // Click a suggestion
    autocompleteList?.addEventListener("mousedown", (e) => {
      const item = e.target.closest(".autocomplete-item");
      if (item?.dataset.city) {
        e.preventDefault();
        selectCity(item.dataset.city);
      }
    });

    // Hover highlights
    autocompleteList?.addEventListener("mouseover", (e) => {
      const item = e.target.closest(".autocomplete-item");
      if (!item) return;
      const idx = [...autocompleteList.querySelectorAll(".autocomplete-item")].indexOf(item);
      if (idx >= 0) updateActive(idx);
    });
  }

  // Load default city on page load (supports ?city=... links, e.g. from favorites.html)
  const initialCity = new URLSearchParams(window.location.search).get("city")?.trim() || "Butuan City";
  loadWeather(initialCity);

  // Mobile menu toggle
  if (menuToggle && navLinks) {
    menuToggle.addEventListener("click", () => {
      const isOpen = navLinks.classList.toggle("open");
      menuToggle.setAttribute("aria-expanded", String(isOpen));
      menuToggle.setAttribute("aria-label", isOpen ? "Close menu" : "Open menu");
    });
  }

  // Smooth scroll (CSS handles smoothness) + close mobile menu + active state
  navAnchors.forEach((link) => {
    link.addEventListener("click", () => {
      navLinks?.classList.remove("open");
      menuToggle?.setAttribute("aria-expanded", "false");
      navAnchors.forEach((a) => a.classList.remove("is-active"));
      link.classList.add("is-active");
    });
  });
});
