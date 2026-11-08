/* ============ Settings (edit these) ============ */
const GITHUB_USER = "angelgonzalez98";
// Repo names to leave out of the Projects page, e.g. ["old-practice-repo"]
const HIDDEN_REPOS = [];
const MAX_REPOS = 12;
const QUAKE_COLOR = "#e4572e";
// Cities shown as air quality pins on the GIS Lab map. The first one is also
// used for the "Air quality at Cal Poly Pomona" card.
const CAMPUS = { name: "Cal Poly Pomona", lat: 34.0575, lng: -117.821 };
const CITIES = [
  CAMPUS,
  { name: "Los Angeles", lat: 34.0522, lng: -118.2437 },
  { name: "Long Beach", lat: 33.7701, lng: -118.1937 },
  { name: "Santa Ana", lat: 33.7455, lng: -117.8677 },
  { name: "Riverside", lat: 33.9533, lng: -117.3962 },
  { name: "San Bernardino", lat: 34.1083, lng: -117.2898 },
  { name: "Palm Springs", lat: 33.8303, lng: -116.5453 },
  { name: "San Diego", lat: 32.7157, lng: -117.1611 },
  { name: "Santa Barbara", lat: 34.4208, lng: -119.6982 },
  { name: "Bakersfield", lat: 35.3733, lng: -119.0187 },
];

/* ============ Helpers ============ */
function timeAgo(isoDate) {
  const seconds = (new Date(isoDate) - Date.now()) / 1000;
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  const units = [
    ["year", 31536000],
    ["month", 2592000],
    ["day", 86400],
    ["hour", 3600],
    ["minute", 60],
  ];
  for (const [unit, size] of units) {
    if (Math.abs(seconds) >= size) {
      return rtf.format(Math.round(seconds / size), unit);
    }
  }
  return "just now";
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function externalLink(text, href) {
  const a = el("a", "", text);
  a.href = href;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  return a;
}

/* ============ About tabs ============ */
const tabLinks = document.querySelectorAll(".tab-links");
const tabContents = document.querySelectorAll(".tab-contents");

tabLinks.forEach((link) => {
  link.addEventListener("click", () => {
    tabLinks.forEach((l) => {
      l.classList.remove("active-link");
      l.setAttribute("aria-selected", "false");
    });
    tabContents.forEach((c) => c.classList.remove("active-tab"));

    link.classList.add("active-link");
    link.setAttribute("aria-selected", "true");
    document.getElementById(link.dataset.tab).classList.add("active-tab");
  });
});

/* ============ Air quality ============ */
const AQI_LEVELS = [
  { max: 50, range: "0-50", label: "Good", color: "#3ddc84", text: "#0d1512" },
  { max: 100, range: "51-100", label: "Moderate", color: "#ffd23f", text: "#0d1512" },
  { max: 150, range: "101-150", label: "Unhealthy for sensitive groups", color: "#ff9f1c", text: "#0d1512" },
  { max: 200, range: "151-200", label: "Unhealthy", color: "#ff6b6b", text: "#0d1512" },
  { max: 300, range: "201-300", label: "Very unhealthy", color: "#b266ff", text: "#0d1512" },
  { max: Infinity, range: "301+", label: "Hazardous", color: "#c2284f", text: "#ffffff" },
];

function aqiLevel(aqi) {
  return AQI_LEVELS.find((l) => aqi <= l.max);
}

// Takes [{lat, lng}, ...] and returns one result (or null) per point.
async function fetchAir(points) {
  const lats = points.map((p) => p.lat).join(",");
  const lngs = points.map((p) => p.lng).join(",");
  const url =
    "https://air-quality-api.open-meteo.com/v1/air-quality" +
    `?latitude=${lats}&longitude=${lngs}` +
    "&current=us_aqi,pm2_5,ozone&timezone=auto";
  const res = await fetch(url);
  if (!res.ok) throw new Error("Air quality request failed");
  const json = await res.json();
  return (Array.isArray(json) ? json : [json]).map((item) => {
    const c = item.current || {};
    if (c.us_aqi == null) return null;
    const aqi = Math.round(c.us_aqi);
    return { aqi, level: aqiLevel(aqi), pm25: c.pm2_5, ozone: c.ozone };
  });
}

function airDetail(air) {
  return `PM2.5: ${air.pm25} µg/m³. Ozone: ${air.ozone} µg/m³.`;
}

function renderAqiLegend() {
  const list = document.getElementById("aqi-legend");
  if (!list) return;
  AQI_LEVELS.forEach((level) => {
    const item = el("li");
    const dot = el("span", "dot");
    dot.style.background = level.color;
    item.append(dot, `${level.label} (${level.range})`);
    list.append(item);
  });
}

/* ============ GIS Lab map ============ */
const USGS_TILES = (name) =>
  `https://basemap.nationalmap.gov/arcgis/rest/services/${name}/MapServer/tile/{z}/{y}/{x}`;
const USGS_CREDIT =
  'Tiles courtesy of the <a href="https://www.usgs.gov/">U.S. Geological Survey</a>';

function buildQuakePopup({ mag, place, time, url }) {
  const popup = el("div");
  popup.append(el("strong", "", `M ${mag.toFixed(1)}`), el("br"));
  popup.append(document.createTextNode(`${place}, ${timeAgo(time)}`), el("br"));
  popup.append(externalLink("USGS details", url));
  return popup;
}

let quakeRequest = 0;
async function loadQuakes(layer) {
  const days = Number(document.getElementById("quake-days").value);
  const mag = document.getElementById("quake-mag").value;
  const countEl = document.getElementById("quake-count");
  const detailEl = document.getElementById("quake-detail");
  document.getElementById("quake-label").textContent = `magnitude ${mag}+, last ${days} days`;

  const requestId = ++quakeRequest;
  countEl.textContent = "--";
  detailEl.textContent = "Loading...";

  try {
    const start = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
    const url =
      "https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson" +
      `&starttime=${start}&minmagnitude=${mag}&orderby=time&limit=1000` +
      "&minlatitude=32&maxlatitude=37&minlongitude=-122&maxlongitude=-114";
    const res = await fetch(url);
    if (!res.ok) throw new Error("Earthquake request failed");
    const data = await res.json();
    if (requestId !== quakeRequest) return; // a newer request replaced this one

    layer.clearLayers();
    let largest = null;
    data.features.forEach((feature) => {
      const [lng, lat] = feature.geometry.coordinates;
      const props = feature.properties;
      if (!largest || props.mag > largest.mag) largest = props;

      L.circleMarker([lat, lng], {
        radius: Math.max(4, props.mag * 3),
        color: "#ffffff",
        weight: 1,
        fillColor: QUAKE_COLOR,
        fillOpacity: 0.65,
        bubblingMouseEvents: false,
      })
        .bindPopup(buildQuakePopup(props))
        .addTo(layer);
    });

    countEl.textContent = data.features.length;
    detailEl.textContent = largest
      ? `Largest: M ${largest.mag.toFixed(1)}, ${largest.place}.`
      : "No earthquakes of this size in the region.";
  } catch (error) {
    if (requestId !== quakeRequest) return;
    countEl.textContent = "--";
    detailEl.textContent = "Earthquake data couldn't load right now.";
  }
}

function airPin(city, air) {
  const pin = el("div", "aqi-pin" + (city === CAMPUS ? " campus" : ""), String(air.aqi));
  pin.style.background = air.level.color;
  pin.style.color = air.level.text;

  const popup = el("div");
  popup.append(el("strong", "", city.name), el("br"));
  popup.append(`Air quality index: ${air.aqi} (${air.level.label})`, el("br"));
  popup.append(airDetail(air));

  return L.marker([city.lat, city.lng], {
    icon: L.divIcon({
      html: pin,
      className: "aqi-pin-wrap",
      iconSize: [36, 36],
      iconAnchor: [18, 18],
    }),
    title: `${city.name}: air quality index ${air.aqi}`,
  })
    .bindTooltip(city.name)
    .bindPopup(popup);
}

async function loadAirLayer(layer) {
  const valueEl = document.getElementById("aqi-value");
  const labelEl = document.getElementById("aqi-label");
  const detailEl = document.getElementById("aqi-detail");
  try {
    const results = await fetchAir(CITIES);
    results.forEach((air, i) => {
      if (air) airPin(CITIES[i], air).addTo(layer);
    });

    const campusAir = results[0];
    if (!campusAir) throw new Error("No campus data");
    valueEl.textContent = campusAir.aqi;
    labelEl.textContent = "";
    const dot = el("span", "dot");
    dot.style.background = campusAir.level.color;
    labelEl.append(dot, campusAir.level.label);
    detailEl.textContent = airDetail(campusAir);
  } catch (error) {
    valueEl.textContent = "--";
    labelEl.textContent = "Unavailable";
    detailEl.textContent = "Air quality data couldn't load right now.";
  }
}

function initMap() {
  const container = document.getElementById("live-map");
  if (!container) return;
  if (typeof L === "undefined") {
    container.textContent = "The map couldn't load. Check your connection.";
    return;
  }
  container.textContent = "";
  renderAqiLegend();

  const map = L.map(container, { scrollWheelZoom: false }).setView([34.1, -118.0], 8);

  const topo = L.tileLayer(USGS_TILES("USGSTopo"), {
    maxZoom: 16,
    attribution: USGS_CREDIT,
  });
  const imagery = L.tileLayer(USGS_TILES("USGSImageryTopo"), {
    maxZoom: 16,
    attribution: USGS_CREDIT,
  });
  const streets = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  });
  const water = L.tileLayer(USGS_TILES("USGSHydroCached"), {
    maxZoom: 16,
    opacity: 0.85,
    attribution: USGS_CREDIT,
  });
  const quakeLayer = L.layerGroup();
  const airLayer = L.layerGroup();

  topo.addTo(map);
  quakeLayer.addTo(map);
  airLayer.addTo(map);

  // If the USGS tiles can't load, fall back to OpenStreetMap once.
  let usedFallback = false;
  topo.on("tileerror", () => {
    if (usedFallback) return;
    usedFallback = true;
    map.removeLayer(topo);
    streets.addTo(map);
  });

  L.control
    .layers(
      { "Topo (USGS)": topo, "Imagery (USGS)": imagery, "Streets (OpenStreetMap)": streets },
      { Earthquakes: quakeLayer, "Air quality": airLayer, "Rivers and lakes": water }
    )
    .addTo(map);

  // Click anywhere to check air quality at that spot.
  map.on("click", async (event) => {
    const popup = L.popup()
      .setLatLng(event.latlng)
      .setContent("Checking air quality...")
      .openOn(map);
    try {
      const [air] = await fetchAir([{ lat: event.latlng.lat, lng: event.latlng.lng }]);
      if (!air) throw new Error("No data");
      const content = el("div");
      content.append(el("strong", "", `Air quality here: ${air.aqi}`), el("br"));
      content.append(air.level.label, el("br"), airDetail(air));
      popup.setContent(content);
    } catch (error) {
      popup.setContent("Air quality isn't available for this spot.");
    }
  });

  document.getElementById("quake-days").addEventListener("change", () => loadQuakes(quakeLayer));
  document.getElementById("quake-mag").addEventListener("change", () => loadQuakes(quakeLayer));

  loadQuakes(quakeLayer);
  loadAirLayer(airLayer);
}

/* ============ GitHub projects ============ */
const LANG_COLORS = [
  "#f2b33d",
  "#7fd8c4",
  "#e4572e",
  "#4da3ff",
  "#b266ff",
  "#3ddc84",
  "#ff9ec7",
  "#c9d6cc",
];

function renderLanguages(repos) {
  const summary = document.getElementById("lang-summary");
  const counts = {};
  repos.forEach((r) => {
    if (r.language) counts[r.language] = (counts[r.language] || 0) + 1;
  });
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  if (!entries.length) return {};

  const total = entries.reduce((sum, [, n]) => sum + n, 0);
  const colors = {};
  const bar = el("div", "lang-bar");
  const legend = el("ul", "lang-legend");

  entries.forEach(([name, n], i) => {
    const color = LANG_COLORS[i % LANG_COLORS.length];
    colors[name] = color;
    const pct = Math.round((n / total) * 100);

    const seg = el("span");
    seg.style.width = `${(n / total) * 100}%`;
    seg.style.background = color;
    seg.title = `${name}: ${n} ${n === 1 ? "repo" : "repos"}`;
    bar.append(seg);

    const item = el("li");
    const dot = el("span", "dot");
    dot.style.background = color;
    item.append(dot, `${name} ${pct}%`);
    legend.append(item);
  });

  summary.replaceChildren(el("h2", "", "Languages across my repos"), bar, legend);
  summary.hidden = false;
  return colors;
}

function repoCard(repo, colors) {
  const card = el("article", "repo-card");

  const title = el("h3");
  title.append(externalLink(repo.name, repo.html_url));

  const desc = el("p", "repo-desc", repo.description || "No description yet.");

  const meta = el("div", "repo-meta");
  if (repo.language) {
    const lang = el("span");
    const dot = el("span", "dot");
    dot.style.background = colors[repo.language] || "#888";
    lang.append(dot, repo.language);
    meta.append(lang);
  }
  meta.append(el("span", "", `Updated ${timeAgo(repo.pushed_at)}`));

  const links = el("div", "repo-links");
  links.append(externalLink("View code", repo.html_url));
  if (repo.homepage) links.append(externalLink("Live site", repo.homepage));

  card.append(title, desc, meta, links);
  return card;
}

function showRepos(list, repos, colors, language) {
  const shown = repos
    .filter((r) => !language || r.language === language)
    .slice(0, MAX_REPOS);
  list.replaceChildren(...shown.map((r) => repoCard(r, colors)));
}

function renderFilters(repos, colors, list) {
  const box = document.getElementById("repo-filters");
  const languages = Object.keys(colors);
  if (!box || languages.length < 2) return;

  const chips = [];
  const select = (chip, language) => {
    chips.forEach((c) => c.setAttribute("aria-pressed", String(c === chip)));
    showRepos(list, repos, colors, language);
  };

  ["All", ...languages].forEach((name, i) => {
    const chip = el("button", "chip", name);
    chip.type = "button";
    chip.setAttribute("aria-pressed", String(i === 0));
    chip.addEventListener("click", () => select(chip, i === 0 ? null : name));
    chips.push(chip);
  });
  box.replaceChildren(...chips);
  box.hidden = false;
}

async function loadRepos() {
  const list = document.getElementById("repo-list");
  if (!list) return;
  try {
    const res = await fetch(
      `https://api.github.com/users/${GITHUB_USER}/repos?per_page=100&sort=pushed`
    );
    if (!res.ok) throw new Error("GitHub request failed");
    const repos = (await res.json())
      .filter((r) => !r.fork && !HIDDEN_REPOS.includes(r.name))
      .sort((a, b) => new Date(b.pushed_at) - new Date(a.pushed_at));

    if (!repos.length) {
      list.replaceChildren(el("p", "map-message", "No public projects yet."));
      return;
    }
    const colors = renderLanguages(repos);
    showRepos(list, repos, colors, null);
    renderFilters(repos, colors, list);
  } catch (error) {
    list.replaceChildren(
      el("p", "map-message", "Projects couldn't load right now. You can still see them on GitHub.")
    );
  }
}

/* ============ Contact form ============ */
const form = document.getElementById("contact-form");
if (form) {
  const statusEl = document.getElementById("form-status");
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    statusEl.textContent = "Sending...";
    try {
      const response = await fetch(form.action, {
        method: "POST",
        body: new FormData(form),
        headers: { Accept: "application/json" },
      });
      if (!response.ok) throw new Error("Request failed");
      form.reset();
      statusEl.textContent = "Message sent. Thanks for reaching out!";
    } catch (error) {
      statusEl.textContent =
        "The message didn't send. Please try again or email me directly.";
    }
  });
}

/* ============ Footer year + page start ============ */
const yearEl = document.getElementById("year");
if (yearEl) yearEl.textContent = new Date().getFullYear();
initMap();
loadRepos();
