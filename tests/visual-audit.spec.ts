/**
 * Visual UI Audit — Playwright Headless
 *
 * Captures screenshots + console logs for every key page/state at
 * desktop (1440x900), tablet (768x1024), and mobile (375x812) viewports.
 *
 * Because we don't have a live Supabase instance the dev server will
 * redirect authenticated routes to /login.  We still audit:
 *   1. Login page (both login & signup modes)
 *   2. Every dashboard page (via forced navigation — the redirect itself is a valid test)
 *   3. Responsiveness at 3 breakpoints
 *   4. Console errors / warnings
 */

import { test, expect, type Page, type ConsoleMessage } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

// ── Helpers ──────────────────────────────────────────────────────────────────

const SCREENSHOT_DIR = path.join(__dirname, "..", "test-results", "visual-audit");

const viewports = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "mobile", width: 375, height: 812 },
] as const;

type LogEntry = {
  type: string;
  text: string;
  url: string;
  timestamp: number;
};

/** Attach a console listener that collects every message. */
function collectConsoleLogs(page: Page): LogEntry[] {
  const logs: LogEntry[] = [];
  page.on("console", (msg: ConsoleMessage) => {
    logs.push({
      type: msg.type(),
      text: msg.text(),
      url: page.url(),
      timestamp: Date.now(),
    });
  });
  page.on("pageerror", (err) => {
    logs.push({
      type: "pageerror",
      text: err.message,
      url: page.url(),
      timestamp: Date.now(),
    });
  });
  return logs;
}

async function screenshot(page: Page, name: string) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, `${name}.png`),
    fullPage: true,
  });
}

async function waitForPageStable(page: Page) {
  // Wait for network idle + no layout shifts for 500ms
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(600);
}

// ── Test Suite ───────────────────────────────────────────────────────────────

test.describe("Visual UI Audit", () => {
  // Shared log collector per test — flushed at end
  let logs: LogEntry[] = [];

  test.beforeEach(async ({ page }) => {
    logs = collectConsoleLogs(page);
  });

  test.afterEach(async ({}, testInfo) => {
    if (!logs || logs.length === 0) return;
    const logPath = path.join(
      SCREENSHOT_DIR,
      `${testInfo.title.replace(/[^a-z0-9]/gi, "_")}_console.json`
    );
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
    fs.writeFileSync(logPath, JSON.stringify(logs, null, 2));
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 1. LOGIN PAGE — full journey
  // ──────────────────────────────────────────────────────────────────────────

  for (const vp of viewports) {
    test(`Login page — ${vp.name} (${vp.width}x${vp.height})`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto("/login");
      await waitForPageStable(page);

      // Login mode
      await screenshot(page, `login_${vp.name}_login_mode`);

      // Check key elements exist
      await expect(page.getByRole("heading")).toBeVisible();
      await expect(page.locator('input[name="email"]')).toBeVisible();
      await expect(page.locator('input[name="password"]')).toBeVisible();

      // Switch to signup mode
      const signupBtn = page.getByRole("button", { name: /sign up/i });
      if (await signupBtn.isVisible()) {
        await signupBtn.click();
        await page.waitForTimeout(400); // animation
        await screenshot(page, `login_${vp.name}_signup_mode`);

        // Username field should appear
        const usernameField = page.locator('input[name="username"]');
        await expect(usernameField).toBeVisible();
      }

      // Switch back to login mode
      const loginBtn = page.getByRole("button", { name: /log in/i });
      if (await loginBtn.isVisible()) {
        await loginBtn.click();
        await page.waitForTimeout(400);
        await screenshot(page, `login_${vp.name}_back_to_login`);
      }
    });

    test(`Login page — error state — ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto("/login?error=Invalid+email+or+password");
      await waitForPageStable(page);
      await screenshot(page, `login_${vp.name}_error_state`);

      // Error message should be visible
      const errorDiv = page.locator(".bg-destructive\\/15, [class*='destructive']");
      await expect(errorDiv.first()).toBeVisible();
    });

    test(`Login page — success message — ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto("/login?message=Signup+successful.+Please+check+your+email.");
      await waitForPageStable(page);
      await screenshot(page, `login_${vp.name}_success_message`);
    });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 2. LOGIN FORM VALIDATION (client-side)
  // ──────────────────────────────────────────────────────────────────────────

  test("Login form — empty submission attempt", async ({ page }) => {
    await page.goto("/login");
    await waitForPageStable(page);

    // Try submitting empty form — HTML5 validation should block
    const submitBtn = page.getByRole("button", { name: /log in/i }).first();
    await submitBtn.click();
    await page.waitForTimeout(300);
    await screenshot(page, "login_empty_submission");
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 3. DASHBOARD PAGES — redirected to login (tests redirect + UI)
  // ──────────────────────────────────────────────────────────────────────────

  const dashboardRoutes = [
    { path: "/", name: "home" },
    { path: "/graph", name: "graph" },
    { path: "/snap", name: "snap" },
    { path: "/knowledge", name: "knowledge" },
    { path: "/research-inbox", name: "research_inbox" },
    { path: "/reports", name: "reports" },
    { path: "/settings", name: "settings" },
  ];

  for (const route of dashboardRoutes) {
    test(`Dashboard redirect — ${route.name} → login`, async ({ page }) => {
      await page.goto(route.path);
      await waitForPageStable(page);

      // Should redirect to /login since we have no auth
      const url = page.url();
      await screenshot(page, `redirect_${route.name}`);

      // Verify we landed on login (the auth guard works)
      expect(url).toContain("/login");
    });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 4. ROOT PAGE DELETION VERIFICATION
  // ──────────────────────────────────────────────────────────────────────────

  test("Root page — no longer serves ChatInterface unprotected", async ({ page }) => {
    const response = await page.goto("/");
    await waitForPageStable(page);

    // Should redirect to /login, not render ChatInterface
    expect(page.url()).toContain("/login");

    // ChatInterface elements should NOT be present
    const chatInput = page.locator('textarea[placeholder*="message"], textarea[name="message"]');
    await expect(chatInput).not.toBeVisible();

    await screenshot(page, "root_page_protected");
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 5. 404 / UNKNOWN ROUTES
  // ──────────────────────────────────────────────────────────────────────────

  test("404 page — unknown route", async ({ page }) => {
    const response = await page.goto("/this-does-not-exist-xyz");
    await waitForPageStable(page);
    await screenshot(page, "404_page");

    // Should either show 404 or redirect to login
    const status = response?.status();
    const url = page.url();
    // Either a proper 404 or a redirect to login is acceptable
    expect(status === 404 || url.includes("/login")).toBeTruthy();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 6. CONSOLE ERROR ANALYSIS
  // ──────────────────────────────────────────────────────────────────────────

  test("Console errors — login page load", async ({ page }) => {
    const pageLogs = collectConsoleLogs(page);
    await page.goto("/login");
    await waitForPageStable(page);

    const errors = pageLogs.filter(
      (l) =>
        l.type === "error" ||
        l.type === "pageerror"
    );

    // Log errors for the report but don't fail on expected ones
    const unexpectedErrors = errors.filter(
      (e) =>
        !e.text.includes("Supabase") &&
        !e.text.includes("NEXT_PUBLIC") &&
        !e.text.includes("hydration") &&
        !e.text.includes("favicon")
    );

    // Write error report
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
    fs.writeFileSync(
      path.join(SCREENSHOT_DIR, "console_errors_report.json"),
      JSON.stringify(
        {
          totalErrors: errors.length,
          unexpectedErrors: unexpectedErrors.length,
          errors: errors,
        },
        null,
        2
      )
    );
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 7. VISUAL RESPONSIVENESS — Login page at many widths
  // ──────────────────────────────────────────────────────────────────────────

  const responsiveWidths = [320, 375, 414, 768, 1024, 1280, 1440, 1920];

  test("Responsive sweep — login page", async ({ page }) => {
    for (const width of responsiveWidths) {
      await page.setViewportSize({ width, height: 800 });
      await page.goto("/login");
      await waitForPageStable(page);
      await screenshot(page, `responsive_login_${width}px`);

      // Card should never overflow viewport
      const card = page.locator("[class*='card'], [class*='Card']").first();
      if (await card.isVisible()) {
        const box = await card.boundingBox();
        if (box) {
          expect(box.x).toBeGreaterThanOrEqual(0);
          expect(box.x + box.width).toBeLessThanOrEqual(width + 2); // 2px tolerance
        }
      }
    }
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 8. ACCESSIBILITY BASICS
  // ──────────────────────────────────────────────────────────────────────────

  test("Accessibility — login page basics", async ({ page }) => {
    await page.goto("/login");
    await waitForPageStable(page);

    // All inputs should have associated labels
    const inputs = page.locator("input[required]");
    const count = await inputs.count();
    for (let i = 0; i < count; i++) {
      const input = inputs.nth(i);
      const id = await input.getAttribute("id");
      if (id) {
        const label = page.locator(`label[for="${id}"]`);
        await expect(label).toBeVisible();
      }
    }

    // Page should have a heading
    await expect(page.getByRole("heading").first()).toBeVisible();

    // Submit buttons should be identifiable
    const buttons = page.getByRole("button");
    expect(await buttons.count()).toBeGreaterThan(0);

    await screenshot(page, "accessibility_login");
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 9. THEME / DARK MODE CHECK
  // ──────────────────────────────────────────────────────────────────────────

  test("Dark mode — login page", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto("/login");
    await waitForPageStable(page);
    await screenshot(page, "login_dark_mode");
  });

  test("Light mode — login page", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto("/login");
    await waitForPageStable(page);
    await screenshot(page, "login_light_mode");
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 10. HTML META TAGS / SEO
  // ──────────────────────────────────────────────────────────────────────────

  test("Meta tags — login page", async ({ page }) => {
    await page.goto("/login");
    await waitForPageStable(page);

    const title = await page.title();
    const metaDescription = await page
      .locator('meta[name="description"]')
      .getAttribute("content")
      .catch(() => null);
    const metaViewport = await page
      .locator('meta[name="viewport"]')
      .getAttribute("content")
      .catch(() => null);

    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
    fs.writeFileSync(
      path.join(SCREENSHOT_DIR, "meta_tags_report.json"),
      JSON.stringify(
        {
          title,
          description: metaDescription,
          viewport: metaViewport,
          issues: [
            ...(title.includes("Create Next App") ? ["Title still has placeholder text"] : []),
            ...(!metaDescription ? ["Missing meta description"] : []),
            ...(!metaViewport ? ["Missing viewport meta tag"] : []),
          ],
        },
        null,
        2
      )
    );

    // Title should not be placeholder
    expect(title).not.toContain("Create Next App");
  });
});
