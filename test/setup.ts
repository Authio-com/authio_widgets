import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach } from "vitest";
import { __testing as styleTesting } from "../src/styles";

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  // Each test starts with a clean stylesheet-injection flag and an
  // empty <style id="authio-widgets-styles"> tag. Without this the
  // first test passes the "stylesheet appears once" assertion but
  // every subsequent test sees the cached flag and skips injection.
  styleTesting.reset();
  const existing = document.getElementById("authio-widgets-styles");
  if (existing) existing.remove();
});

// jsdom doesn't ship URL.createObjectURL / revokeObjectURL by
// default. We stub them so widgets that mint metadata-XML blob URLs
// can be exercised without exploding the test runner.
const blobMap = new Map<string, Blob>();
let blobCounter = 0;
if (typeof URL.createObjectURL !== "function") {
  (URL as unknown as { createObjectURL: (b: Blob) => string }).createObjectURL =
    (b: Blob) => {
      const id = `blob:mock/${++blobCounter}`;
      blobMap.set(id, b);
      return id;
    };
}
if (typeof URL.revokeObjectURL !== "function") {
  (URL as unknown as { revokeObjectURL: (s: string) => void }).revokeObjectURL =
    (s: string) => {
      blobMap.delete(s);
    };
}
// Re-export the map so individual tests can assert ref-counting.
export const __blobUrls = blobMap;
