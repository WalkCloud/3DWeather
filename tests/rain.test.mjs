import test from "node:test";
import assert from "node:assert/strict";
import { RAIN_PROFILES, rainProfile, isRainCondition } from "../src/rain.js";
import { normalizeWeather } from "../src/weather.js";
import { LANGUAGES } from "../src/i18n.js";

test("rain intensity increases cloud depth, coverage and rainfall while daylight decreases", () => {
  const light = RAIN_PROFILES.rain;
  const moderate = RAIN_PROFILES.moderateRain;
  const heavy = RAIN_PROFILES.heavyRain;
  for (const key of [
    "clouds",
    "thickness",
    "widthScale",
    "particles",
    "speed",
    "streak",
    "wetness",
    "rippleSpeed",
  ])
    assert.ok(light[key] < moderate[key] && moderate[key] < heavy[key], key);
  for (const key of ["exposure", "sun", "ambient", "environment"])
    assert.ok(light[key] > moderate[key] && moderate[key] > heavy[key], key);
  assert.equal(
    new Set([light.texture, moderate.texture, heavy.texture]).size,
    3,
  );
});

test("all rain grades survive the provider boundary and have bilingual labels", () => {
  for (const condition of ["rain", "moderateRain", "heavyRain", "storm"]) {
    assert.equal(
      normalizeWeather({ condition, source: "api" }).condition,
      condition,
    );
    assert.ok(isRainCondition(condition));
    assert.ok(rainProfile(condition).particles <= 2600);
    for (const language of ["zh", "en"])
      assert.ok(LANGUAGES[language].weather[condition]?.label);
  }
  assert.equal(rainProfile("cloudy"), null);
  assert.equal(rainProfile("toString"), null);
  assert.equal(isRainCondition("snow"), false);
});
