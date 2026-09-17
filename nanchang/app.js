const KEY = "nanchang-itinerary-checks";

function load() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
}

function save(values) {
  localStorage.setItem(KEY, JSON.stringify(values));
}

const boxes = [...document.querySelectorAll("#checks input[type=checkbox]")];
const saved = load();
boxes.forEach((box, i) => {
  box.checked = Boolean(saved[i]);
  box.addEventListener("change", () => save(boxes.map((b) => b.checked)));
});

const STOPS = [
  {
    id: "hotel",
    n: 0,
    name: "瑞颐大酒店",
    when: "住",
    group: "day",
    lat: 28.687715,
    lng: 115.877512,
    note: "起点 / 夜景回酒店",
    amap: "南昌瑞颐大酒店",
  },
  {
    id: "dashi",
    n: 1,
    name: "大士院过早",
    when: "09:00",
    group: "day",
    lat: 28.689093,
    lng: 115.87994,
    note: "小罗子汤店 · 白糖糕",
    amap: "大士院街",
  },
  {
    id: "wanshou",
    n: 2,
    name: "万寿宫街区",
    when: "10:30",
    group: "day",
    lat: 28.677191,
    lng: 115.882298,
    note: "逛吃 · 小柴米午饭",
    amap: "万寿宫历史文化街区",
  },
  {
    id: "tengwang",
    n: 3,
    name: "滕王阁",
    when: "14:30",
    group: "day",
    lat: 28.6841,
    lng: 115.8758,
    note: "主打卡 · 九大碗可顺路",
    amap: "滕王阁",
  },
  {
    id: "bridge",
    n: 4,
    name: "八一大桥 / 沿江",
    when: "18:00 A",
    group: "day",
    lat: 28.694694,
    lng: 115.874657,
    note: "省事夜景，走回酒店",
    amap: "八一大桥",
  },
  {
    id: "qiushui",
    n: "B",
    name: "秋水广场",
    when: "18:00 B",
    group: "night",
    lat: 28.684522,
    lng: 115.854773,
    note: "过江喷泉备选",
    amap: "秋水广场",
  },
  {
    id: "bayi",
    n: "+",
    name: "八一广场",
    when: "半天",
    group: "extra",
    lat: 28.678302,
    lng: 115.898024,
    note: "英雄城地标 · 堂瓦里在附近",
    amap: "八一广场",
  },
  {
    id: "shengjin",
    n: "+",
    name: "绳金塔",
    when: "半天",
    group: "extra",
    lat: 28.661492,
    lng: 115.897248,
    note: "古塔 + 美食街",
    amap: "绳金塔",
  },
];

function pinIcon(stop) {
  const cls = `pin pin-${stop.group}`;
  return L.divIcon({
    className: "",
    html: `<span class="${cls}"><b>${stop.n}</b></span>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -18],
  });
}

function popupHtml(stop) {
  const q = encodeURIComponent(stop.amap);
  return `<strong>${stop.name}</strong><br>${stop.when} · ${stop.note}<br>
    <a href="https://uri.amap.com/search?keyword=${q}&city=360100" target="_blank" rel="noreferrer">高德导航</a>`;
}

function initMap() {
  const el = document.getElementById("route-map");
  const list = document.getElementById("map-stops");
  const toggle = document.getElementById("toggle-half");
  if (!el || typeof L === "undefined") return;

  const map = L.map(el, { scrollWheelZoom: false, zoomControl: true });
  L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
    attribution: "&copy; OpenStreetMap &copy; CARTO",
    maxZoom: 19,
  }).addTo(map);

  const markers = {};
  const layers = { day: L.layerGroup(), night: L.layerGroup(), extra: L.layerGroup() };

  STOPS.forEach((stop) => {
    const m = L.marker([stop.lat, stop.lng], { icon: pinIcon(stop), title: stop.name });
    m.bindPopup(popupHtml(stop));
    m.addTo(layers[stop.group]);
    markers[stop.id] = m;

    if (stop.group !== "extra") {
      const li = document.createElement("li");
      li.dataset.id = stop.id;
      li.innerHTML = `<span class="n n-${stop.group}">${stop.n}</span><span><b>${stop.name}</b><small>${stop.when} · ${stop.note}</small></span>`;
      li.addEventListener("click", () => {
        map.setView([stop.lat, stop.lng], 16);
        m.openPopup();
        list.querySelectorAll("li").forEach((x) => x.classList.remove("on"));
        li.classList.add("on");
      });
      list.appendChild(li);
    }
  });

  layers.day.addTo(map);
  layers.night.addTo(map);

  const dayLine = STOPS.filter((s) => s.group === "day").map((s) => [s.lat, s.lng]);
  L.polyline(dayLine, { color: "#c23b22", weight: 4, opacity: 0.9 }).addTo(layers.day);
  L.polyline(
    [
      [28.6841, 115.8758],
      [28.684522, 115.854773],
    ],
    { color: "#2f5d56", weight: 3, opacity: 0.85, dashArray: "8 8" },
  ).addTo(layers.night);

  function fit() {
    const shown = STOPS.filter((s) => s.group !== "extra" || toggle.checked);
    map.fitBounds(
      shown.map((s) => [s.lat, s.lng]),
      { padding: [28, 28], maxZoom: 14 },
    );
  }

  toggle.addEventListener("change", () => {
    if (toggle.checked) {
      layers.extra.addTo(map);
    } else {
      map.removeLayer(layers.extra);
    }
    fit();
  });

  fit();
  setTimeout(() => map.invalidateSize(), 200);
  window.addEventListener("resize", () => map.invalidateSize());
}

initMap();
