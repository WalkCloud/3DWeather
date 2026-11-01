import test from "node:test";
import assert from "node:assert/strict";
import { dayPhaseFor, seasonFor } from "../src/weather.js";
import { LANGUAGES } from "../src/i18n.js";

test("local seasons follow the viewer's calendar months", () => {
  assert.equal(seasonFor(new Date(2026, 2, 1)), "spring");
  assert.equal(seasonFor(new Date(2026, 5, 30)), "summer");
  assert.equal(seasonFor(new Date(2026, 10, 15)), "autumn");
  assert.equal(seasonFor(new Date(2026, 0, 15)), "winter");
});

test("local daylight phases cover the full day without gaps", () => {
  const phases = [
    [4, 59, "night"],
    [5, 0, "dawn"],
    [7, 59, "dawn"],
    [8, 0, "day"],
    [16, 59, "day"],
    [17, 0, "dusk"],
    [19, 29, "dusk"],
    [19, 30, "night"],
  ];
  for (const [hour, minute, expected] of phases)
    assert.equal(dayPhaseFor(new Date(2026, 10, 1, hour, minute)), expected);
});

test("Chinese and English interfaces expose matching runtime keys", () => {
  const collectKeys = (value, prefix = "") =>
    typeof value === "object"
      ? Object.entries(value).flatMap(([key, nested]) =>
          collectKeys(nested, `${prefix}${key}.`),
        )
      : [prefix.slice(0, -1)];
  assert.deepEqual(collectKeys(LANGUAGES.zh), collectKeys(LANGUAGES.en));
  assert.equal(LANGUAGES.en.weather.snow.label, "Light Snow");
  assert.equal(LANGUAGES.zh.ui.wind, "风速");
});
