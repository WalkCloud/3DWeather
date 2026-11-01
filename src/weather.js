export const WEATHER = {
  sunny: {
    label: "晴",
    temperature: 24,
    feelsLike: 25,
    wind: 2.4,
    humidity: 62,
    uv: 5,
    precipitation: 8,
    direction: "东南风",
    message: "微风吹过小牧场",
    sky: "#8fb6d7",
    clouds: 0.25,
  },
  cloudy: {
    label: "阴",
    temperature: 21,
    feelsLike: 21,
    wind: 3.1,
    humidity: 72,
    uv: 2,
    precipitation: 24,
    direction: "东风",
    message: "云朵慢慢走，日子慢慢过",
    sky: "#9eafbf",
    clouds: 0.8,
  },
  rain: {
    label: "小雨",
    temperature: 19,
    feelsLike: 18,
    wind: 4.2,
    humidity: 88,
    uv: 1,
    precipitation: 86,
    direction: "东北风",
    message: "听，雨落在小屋旁",
    sky: "#859eaf",
    clouds: 1,
  },
  moderateRain: {
    label: "中雨",
    temperature: 18,
    feelsLike: 16,
    wind: 4.8,
    humidity: 91,
    uv: 1,
    precipitation: 92,
    direction: "东北风",
    message: "雨声渐密，草木静静喝水",
    sky: "#7c92a6",
    clouds: 1,
  },
  heavyRain: {
    label: "大雨",
    temperature: 17,
    feelsLike: 15,
    wind: 6.0,
    humidity: 95,
    uv: 0,
    precipitation: 98,
    direction: "东北风",
    message: "雨幕落下，小屋守着暖光",
    sky: "#667e94",
    clouds: 1,
  },
  storm: {
    label: "雷阵雨",
    temperature: 18,
    feelsLike: 17,
    wind: 6.8,
    humidity: 91,
    uv: 1,
    precipitation: 94,
    direction: "东北风",
    message: "雨声里的小屋，依然暖暖的",
    sky: "#667f95",
    clouds: 1,
  },
  snow: {
    label: "小雪",
    temperature: -2,
    feelsLike: -5,
    wind: 2.1,
    humidity: 86,
    uv: 1,
    precipitation: 83,
    direction: "东北风",
    message: "雪慢慢落，小屋暖暖的",
    sky: "#b9d0e2",
    clouds: 0.65,
  },
  fog: {
    label: "薄雾",
    temperature: 16,
    feelsLike: 15,
    wind: 0.8,
    humidity: 95,
    uv: 1,
    precipitation: 12,
    direction: "北风",
    message: "山间的雾，把清晨放慢",
    sky: "#b8c9ce",
    clouds: 0.35,
  },
  windy: {
    label: "有风",
    temperature: 22,
    feelsLike: 20,
    wind: 9.2,
    humidity: 48,
    uv: 4,
    precipitation: 6,
    direction: "西北风",
    message: "风经过草地，带来一点自由",
    sky: "#b7d3e5",
    clouds: 0.4,
  },
  night: {
    label: "晴夜",
    temperature: 17,
    feelsLike: 17,
    wind: 1.2,
    humidity: 68,
    uv: 0,
    precipitation: 3,
    direction: "东南风",
    message: "星光亮了，小屋也亮了",
    sky: "#263f5d",
    clouds: 0.1,
  },
};

export const CITIES = ["杭州", "上海", "北京", "成都", "苏州", "大理"];

/** Seasons and daylight phases are local environment state, not weather codes. */
export function seasonFor(date = new Date()) {
  const month = date.getMonth();
  if (month >= 2 && month <= 4) return "spring";
  if (month >= 5 && month <= 7) return "summer";
  if (month >= 8 && month <= 10) return "autumn";
  return "winter";
}

export function dayPhaseFor(date = new Date()) {
  const hour = date.getHours() + date.getMinutes() / 60;
  if (hour >= 5 && hour < 8) return "dawn";
  if (hour >= 8 && hour < 17) return "day";
  if (hour >= 17 && hour < 19.5) return "dusk";
  return "night";
}

export function demoWeather(condition = "sunny", city = "杭州") {
  return {
    ...WEATHER[condition],
    condition,
    city,
    source: "demo",
    observedAt: new Date().toISOString(),
  };
}

const numeric = (value, fallback, min, max) =>
  Number.isFinite(Number(value)) && value !== null && value !== ""
    ? Math.min(max, Math.max(min, Number(value)))
    : fallback;

/** Stable provider boundary: adapt your forecast response to this shape. */
export function normalizeWeather(input = {}) {
  const condition = Object.hasOwn(WEATHER, input.condition)
    ? input.condition
    : "sunny";
  const base = demoWeather(
    condition,
    typeof input.city === "string" && input.city.trim()
      ? input.city.trim()
      : "杭州",
  );
  return {
    ...base,
    temperature: numeric(input.temperature, base.temperature, -60, 60),
    feelsLike: numeric(input.feelsLike, base.feelsLike, -80, 80),
    wind: numeric(input.wind, base.wind, 0, 70),
    humidity: numeric(input.humidity, base.humidity, 0, 100),
    uv: numeric(input.uv, base.uv, 0, 15),
    precipitation: numeric(input.precipitation, base.precipitation, 0, 100),
    direction:
      typeof input.direction === "string" ? input.direction : base.direction,
    observedAt: Number.isFinite(Date.parse(input.observedAt))
      ? input.observedAt
      : base.observedAt,
    source: input.source === "api" ? "api" : "demo",
  };
}

const SNOW_KEY = "pocket-meadow:snow:v1";
export function snowRemaining(record, at = Date.now()) {
  if (
    !record ||
    !Number.isFinite(record.updatedAt) ||
    !Number.isFinite(record.amount)
  )
    return 0;
  const elapsedHours = Math.max(0, at - record.updatedAt) / 3600000;
  return Math.max(0, Math.min(1, record.amount - elapsedHours * 0.012));
}

export function readSnow(city, at = Date.now()) {
  try {
    return snowRemaining(
      JSON.parse(localStorage.getItem(SNOW_KEY) || "{}")[city],
      at,
    );
  } catch {
    return 0;
  }
}

export function accumulateSnow(city) {
  try {
    const saved = JSON.parse(localStorage.getItem(SNOW_KEY) || "{}");
    saved[city] = { amount: 0.94, updatedAt: Date.now() };
    localStorage.setItem(SNOW_KEY, JSON.stringify(saved));
  } catch {
    /* A private browser still supports the current session. */
  }
  return 0.94;
}

export function clearSnow(city) {
  try {
    const saved = JSON.parse(localStorage.getItem(SNOW_KEY) || "{}");
    delete saved[city];
    localStorage.setItem(SNOW_KEY, JSON.stringify(saved));
  } catch {
    /* The in-memory preview still resets if storage is unavailable. */
  }
}
