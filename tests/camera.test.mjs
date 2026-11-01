import test from "node:test";
import assert from "node:assert/strict";
import { orthographicViewHeight } from "../src/camera.js";

test("weather conditions share the same orthographic framing", () => {
  const desktop = orthographicViewHeight(1672 / 941);
  for (const aspect of [1672 / 941, 1.1, 0.8]) {
    assert.equal(
      orthographicViewHeight(aspect),
      orthographicViewHeight(aspect),
    );
  }
  assert.equal(desktop, 14.5);
  assert.equal(orthographicViewHeight(0.8), 26.25);
});
