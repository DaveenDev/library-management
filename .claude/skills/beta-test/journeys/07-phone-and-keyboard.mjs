import { defineJourney, step } from "../lib/tester.mjs";
import { FIXTURES } from "../personas.mjs";

const { midnightLibrary } = FIXTURES.books;
const { amara } = FIXTURES.members;

export default [
  defineJourney({
    id: "phone-shift",
    title: "A librarian works from a phone",
    persona: "librarian",
    viewport: { width: 390, height: 844 },
    steps: [
      step("Signing in fits on the screen", async (t) => {
        await t.expectVisible("Front Desk");
        const overflows = await t.page.evaluate(
          () => document.documentElement.scrollWidth > window.innerWidth + 1,
        );
        if (overflows) throw new Error("the page scrolls sideways on a phone");
        await t.shot("phone-front-desk");
      }),

      step("The navigation is behind a menu button", async (t) => {
        const toggle = t.page.getByRole("button", { name: "Open navigation" });
        if (!(await toggle.isVisible())) throw new Error("no way to reach the navigation on a phone");
        await toggle.click();
        await t.settle(500);
        await t.expectVisible("Book Catalog");
        await t.shot("phone-drawer");
      }),

      step("Escape closes the drawer again", async (t) => {
        await t.page.keyboard.press("Escape");
        await t.settle(500);
        const shut = await t.page.evaluate(
          () => (document.querySelector(".lm-sidebar")?.getBoundingClientRect().left ?? -1) < 0,
        );
        if (!shut) throw new Error("Escape did not close the navigation drawer");
      }),

      step("Every screen fits without sideways scrolling", async (t) => {
        const sections = [
          "Dashboard",
          "Book Catalog",
          "Borrowers",
          "Circulation",
          "Reservations",
          "Fines",
          "Reports",
          "Labels",
          "Misc",
        ];
        const bad = [];
        for (const section of sections) {
          await t.goTo(section);
          await t.settle(900);
          const overflows = await t.page.evaluate(
            () => document.documentElement.scrollWidth > window.innerWidth + 1,
          );
          if (overflows) bad.push(section);
        }
        if (bad.length) throw new Error(`these screens scroll sideways on a phone: ${bad.join(", ")}`);
      }),

      step("A check-out can still be completed on a phone", async (t) => {
        await t.goTo("Circulation");
        await t.settle(900);
        await t.fillField("Book barcode", midnightLibrary.barcode);
        await t.fillField("Member ID", amara.code);
        await t.click("Confirm Check Out");
        await t.expectToast(/Checked out/i);
        await t.shot("phone-checkout");
      }),

      step("And undone again", async (t) => {
        await t.page.getByLabel("Book barcode").nth(1).fill(midnightLibrary.barcode);
        await t.page.getByLabel("Book barcode").nth(1).press("Enter");
        await t.expectToast(/Returned/i);
      }),
    ],
  }),

  defineJourney({
    id: "keyboard-only",
    title: "Someone working without a mouse can still get around",
    persona: "librarian",
    steps: [
      step("Every button on a page has a name to announce", async (t) => {
        const pages = ["Front Desk", "Book Catalog", "Borrowers", "Circulation", "Fines", "Misc"];
        const nameless = [];
        for (const p of pages) {
          await t.goTo(p);
          await t.settle(800);
          const found = await t.page.evaluate(() =>
            [...document.querySelectorAll("button")]
              .filter((b) => {
                const label =
                  b.getAttribute("aria-label") ||
                  (b.getAttribute("aria-labelledby") &&
                    document.getElementById(b.getAttribute("aria-labelledby"))?.textContent) ||
                  b.textContent?.trim();
                return !label;
              })
              .map((b) => b.outerHTML.slice(0, 80)),
          );
          if (found.length) nameless.push(`${p}: ${found.length}`);
        }
        if (nameless.length) throw new Error(`buttons with no accessible name — ${nameless.join("; ")}`);
      }),

      step("Every form control has a label", async (t) => {
        const pages = ["Book Catalog", "Circulation", "Misc", "Labels"];
        const unlabelled = [];
        for (const p of pages) {
          await t.goTo(p);
          await t.settle(800);
          const found = await t.page.evaluate(() =>
            [...document.querySelectorAll("input, select, textarea")]
              .filter((i) => {
                if (i.type === "hidden") return false;
                if (i.closest("label")) return false; // implicit label
                const byId = i.id && document.querySelector(`label[for="${CSS.escape(i.id)}"]`);
                return !(i.getAttribute("aria-label") || byId);
              })
              .map((i) => i.outerHTML.slice(0, 90)),
          );
          if (found.length) unlabelled.push(`${p}: ${found.join(" | ")}`);
        }
        if (unlabelled.length) throw new Error(`unlabelled controls — ${unlabelled.join("; ")}`);
      }),

      step("A dialog takes focus and keeps it", async (t) => {
        await t.goTo("Book Catalog");
        await t.settle(800);
        await t.click("Add Book");
        await t.settle(500);
        const inside = await t.page.evaluate(() =>
          document.querySelector('[role="dialog"]')?.contains(document.activeElement),
        );
        if (!inside) throw new Error("opening a dialog left focus outside it");

        for (let i = 0; i < 30; i++) await t.page.keyboard.press("Tab");
        const stillInside = await t.page.evaluate(() =>
          document.querySelector('[role="dialog"]')?.contains(document.activeElement),
        );
        if (!stillInside) throw new Error("Tab escaped the dialog into the page behind it");
      }),

      step("Escape closes it and gives focus back", async (t) => {
        await t.page.keyboard.press("Escape");
        await t.settle(500);
        if ((await t.page.locator('[role="dialog"]').count()) > 0) {
          throw new Error("Escape did not close the dialog");
        }
        const back = await t.page.evaluate(() => document.activeElement?.textContent ?? "");
        if (!back.includes("Add Book")) {
          throw new Error(`focus went to “${back.trim().slice(0, 40)}” instead of back to the trigger`);
        }
      }),

      step("The current page is marked for a screen reader", async (t) => {
        const current = await t.page.locator('aside [aria-current="page"]').count();
        if (current !== 1) throw new Error(`expected exactly one current nav item, found ${current}`);
      }),

      step("Toasts are announced, not just drawn", async (t) => {
        const live = await t.page.locator('[aria-live="polite"][role="status"]').count();
        if (live === 0) throw new Error("no live region for toasts, so they are never announced");
      }),
    ],
  }),
];
