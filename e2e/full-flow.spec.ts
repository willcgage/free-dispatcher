import { test, expect, type APIRequestContext } from "@playwright/test";

/**
 * End-to-end: the whole chain a dispatcher-host runs through —
 *   build a layout (districts/sections/blocks) → attach it to a session →
 *   add a train → dispatch (mark occupancy, allocate a section).
 *
 * Deterministic setup goes through the authenticated API; the dispatcher board
 * and the layout view are exercised through the real UI.
 */

async function adminHeaders(request: APIRequestContext) {
  const res = await request.get("/api/admin/token");
  const { sessionToken } = await res.json();
  return {
    Authorization: `Bearer ${sessionToken}`,
    "Content-Type": "application/json",
  };
}

test("build a layout, attach to a session, and dispatch on it", async ({
  page,
  request,
}) => {
  const ts = Date.now();
  const H = await adminHeaders(request);

  // 1) Build a layout with one district → section → block.
  const layoutRes = await request.post("/api/layouts", {
    headers: H,
    data: {
      name: `E2E Layout ${ts}`,
      districts: [
        { name: "Div 1", sections: [{ name: "Sec 1", blocks: [{ name: "B1" }] }] },
      ],
    },
  });
  expect(layoutRes.ok()).toBeTruthy();
  const { layout } = await layoutRes.json();

  // 2) Start a session, attach the layout, add a train.
  await request.post("/api/session", {
    headers: H,
    data: { name: `E2E Session ${ts}` },
  });
  await request.patch("/api/session", { headers: H, data: { layoutId: layout.id } });
  const trainRes = await request.post("/api/trains", {
    headers: H,
    data: { number: "E2E1", name: "E2E Train" },
  });
  expect(trainRes.ok()).toBeTruthy();

  // 3) The Layouts view shows the layout + its to-scale schematic section.
  await page.goto("/admin/layouts");
  await expect(page.getByText(`E2E Layout ${ts}`)).toBeVisible();

  // 4) The dispatcher board renders the attached layout.
  await page.goto("/admin/track");
  await expect(page.getByRole("heading", { name: "Track" })).toBeVisible();
  await expect(page.getByText("Div 1")).toBeVisible();
  await expect(page.getByText("Sec 1")).toBeVisible();

  // Mark block B1 occupied → it turns red.
  const block = page.getByRole("button", { name: "B1", exact: true });
  await block.click();
  await expect(block).toHaveClass(/red-600/);

  // Allocate Sec 1 to the train: select it, pick the train, allocate the route.
  await page.getByTitle("Select for a route").check();
  await page
    .locator("select")
    .filter({ hasText: "E2E1" })
    .selectOption({ label: "E2E1 · E2E Train" });
  await page.getByRole("button", { name: "Allocate route" }).click();

  // The section now shows the allocation badge.
  await expect(page.getByText("E2E1 · E2E Train · A→B")).toBeVisible();
});
