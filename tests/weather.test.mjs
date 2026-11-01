import test from "node:test";
import assert from "node:assert/strict";
import {
  demoWeather,
  normalizeWeather,
  snowRemaining,
  accumulateSnow,
  readSnow,
} from "../src/weather.js";

test("provider boundary preserves API data and bounds malformed numeric fields", () => {
  const result = normalizeWeather({
    condition: "storm",
    city: " 上海 ",
    source: "api",
    temperature: "18",
    humidity: 120,
    wind: -3,
    uv: null,
    feelsLike: NaN,
    precipitation: "94",
    observedAt: "2026-11-01T00:00:00Z",
  });
  assert.equal(result.city, "上海");
  assert.equal(result.condition, "storm");
  assert.equal(result.source, "api");
  assert.equal(result.temperature, 18);
  assert.equal(result.humidity, 100);
  assert.equal(result.wind, 0);
  assert.equal(result.uv, 1);
  assert.equal(result.feelsLike, 17);
  assert.equal(result.precipitation, 94);
  assert.equal(result.observedAt, "2026-11-01T00:00:00Z");
  assert.equal(
    normalizeWeather({ condition: "unknown", temperature: "" }).temperature,
    demoWeather().temperature,
  );
});

test("snow survives the following sunny day and melts gradually", () => {
  const at = Date.parse("2026-11-01T00:00:00Z");
  const snow = { amount: 0.94, updatedAt: at };
  assert.ok(Math.abs(snowRemaining(snow, at + 24 * 3600000) - 0.652) < 1e-9);
  assert.ok(Math.abs(snowRemaining(snow, at + 48 * 3600000) - 0.364) < 1e-9);
  assert.equal(snowRemaining(snow, at + 80 * 3600000), 0);
  assert.equal(snowRemaining(snow, at - 3600000), 0.94);
  assert.equal(snowRemaining({ amount: NaN, updatedAt: at }), 0);
});

test("snow records remain isolated by city and survive a new read", () => {
  const saved = new Map();
  globalThis.localStorage = {
    getItem: (k) => saved.get(k) ?? null,
    setItem: (k, v) => saved.set(k, v),
  };
  const before = Date.now();
  accumulateSnow("杭州");
  assert.ok(readSnow("杭州", before + 24 * 3600000) > 0.65);
  assert.equal(readSnow("上海"), 0);
  saved.set("pocket-meadow:snow:v1", "invalid JSON");
  assert.equal(readSnow("杭州"), 0);
  delete globalThis.localStorage;
});
