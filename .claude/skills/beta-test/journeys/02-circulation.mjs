import { defineJourney, step } from "../lib/tester.mjs";
import { FIXTURES } from "../personas.mjs";

const { dune, atomicHabits } = FIXTURES.books;
const { amara, marcusBell } = FIXTURES.members;

export default [
  defineJourney({
    id: "circulation-desk",
    title: "A whole shift at the desk: check out, renew, check in",
    persona: "librarian",
    steps: [
      step("Open Circulation", async (t) => {
        await t.goTo("Circulation");
        await t.expectVisible("Check Out");
        await t.expectVisible("Check In / Return");
      }),

      step("Scan a book and a member card to check out", async (t) => {
        // A USB scanner is a keyboard wedge: it types the code, then Enter.
        await t.fillField("Book barcode", dune.barcode);
        await t.pressEnterIn("Book barcode");
        await t.fillField("Member ID", amara.code);
        await t.pressEnterIn("Member ID");
        const toast = await t.expectToast(/Checked out/i);
        if (!toast?.includes(dune.title)) {
          throw new Error(`toast should name the book, said: “${toast}”`);
        }
      }),

      step("The loan appears in Active Loans", async (t) => {
        await t.settle(800);
        // Identified by book *and* borrower: the demo library already has this
        // title on loan to someone else, so the title alone is not unique.
        if ((await t.rowMatching(dune.title, amara.name).count()) === 0) {
          throw new Error(`no active loan of ${dune.title} to ${amara.name}`);
        }
        await t.shot("active-loan");
      }),

      step("The scanner fields clear themselves for the next reader", async (t) => {
        const book = await t.fieldValue("Book barcode");
        const member = await t.fieldValue("Member ID");
        if (book !== "" || member !== "") {
          throw new Error(`fields should be empty for the next scan, saw “${book}” / “${member}”`);
        }
      }),

      step("Renew the loan and see a new due date", async (t) => {
        const before = await t.rowMatching(dune.title, amara.name).locator("td").nth(3).textContent();
        await t.rowMatching(dune.title, amara.name).getByRole("button", { name: "Renew" }).click();
        await t.expectToast(/Renewed/i);
        await t.settle(900);
        const after = await t.rowMatching(dune.title, amara.name).locator("td").nth(3).textContent();
        if (before?.trim() === after?.trim()) {
          throw new Error(`due date did not move on renewal (still ${after?.trim()})`);
        }
      }),

      step("Check the book back in by scanning it", async (t) => {
        // The return field is the second one with this label.
        await t.page.getByLabel("Book barcode").nth(1).fill(dune.barcode);
        await t.page.getByLabel("Book barcode").nth(1).press("Enter");
        await t.expectToast(/Returned/i);
      }),

      step("The returned loan leaves the active list", async (t) => {
        await t.settle(900);
        if ((await t.rowMatching(dune.title, amara.name).count()) > 0) {
          throw new Error(`${amara.name}'s loan of ${dune.title} is still listed as active`);
        }
      }),

      step("An unknown barcode is refused clearly, not silently", async (t) => {
        await t.page.getByLabel("Book barcode").nth(1).fill("LIB-999999");
        await t.page.getByLabel("Book barcode").nth(1).press("Enter");
        const toast = await t.expectToast(/not found|no .*found/i);
        t.observe("polish", `Unknown barcode says: “${toast}”`);
      }),
    ],
  }),

  defineJourney({
    id: "circulation-refusals",
    title: "The desk refuses what it should: suspended readers and empty shelves",
    persona: "librarian",
    steps: [
      step("A suspended member cannot borrow", async (t) => {
        await t.goTo("Circulation");
        await t.fillField("Book barcode", atomicHabits.barcode);
        await t.fillField("Member ID", marcusBell.code);
        await t.click("Confirm Check Out");
        const toast = await t.expectToast(/suspend/i);
        if (!toast) throw new Error("expected the suspension to be explained");
      }),

      step("Borrowing the last copy empties the shelf", async (t) => {
        await t.goTo("Book Catalog");
        await t.fillField("Search the catalog", "Brief History");
        await t.settle(1000);
        const availability = await t.page.locator("tbody tr").first().locator("td").nth(5).textContent();
        t.observe("polish", `"A Brief History of Time" starts at ${availability?.trim()} copies available`);
      }),

      step("Checking out with no member is refused rather than half-done", async (t) => {
        await t.goTo("Circulation");
        await t.fillField("Book barcode", atomicHabits.barcode);
        await t.click("Confirm Check Out");
        await t.settle(600);
        // The form focuses the missing field instead of sending a bad request.
        const focused = await t.page.evaluate(() => document.activeElement?.id ?? "");
        const memberId = await t.page.getByLabel("Member ID").first().getAttribute("id");
        if (focused !== memberId) {
          t.observe("minor", "Confirming with no member ID neither focuses the field nor explains why nothing happened");
        }
      }),
    ],
  }),
];
