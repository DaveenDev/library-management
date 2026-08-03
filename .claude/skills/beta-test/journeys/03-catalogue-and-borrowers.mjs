import { defineJourney, step } from "../lib/tester.mjs";

const NEW_BOOK = {
  title: "The Beta Tester's Companion",
  author: "Q. A. Reader",
  copies: 3,
};

export default [
  defineJourney({
    id: "catalogue-lifecycle",
    title: "Catalogue a new title, correct it, then withdraw it",
    persona: "librarian",
    steps: [
      step("Open the catalogue", async (t) => {
        await t.goTo("Book Catalog");
        await t.expectVisible("titles");
      }),

      step("Add a book", async (t) => {
        await t.click("Add Book");
        await t.fillField("Title *", NEW_BOOK.title);
        await t.fillField("Author *", NEW_BOOK.author);
        await t.fillField("Total Copies", NEW_BOOK.copies);
        await t.click("Save Book");
        await t.expectToast(/added|saved/i);
      }),

      step("It is findable by title", async (t) => {
        await t.settle(700);
        await t.fillField("Search the catalog", "Beta Tester");
        await t.settle(1000);
        await t.expectRowCount(1);
        await t.expectVisible(NEW_BOOK.author);
      }),

      step("It was given a barcode and an accession number automatically", async (t) => {
        const row = t.page.locator("tbody tr").first();
        const accession = (await row.locator("td").nth(0).textContent())?.trim();
        const barcode = (await row.locator("td").nth(1).textContent())?.trim();
        if (!accession || accession === "—") throw new Error("no accession number was assigned");
        if (!/^LIB-/.test(barcode ?? "")) throw new Error(`barcode looks wrong: “${barcode}”`);
      }),

      step("All three copies show as available", async (t) => {
        const copies = (await t.page.locator("tbody tr").first().locator("td").nth(5).textContent())?.trim();
        if (copies !== `${NEW_BOOK.copies} / ${NEW_BOOK.copies}`) {
          throw new Error(`expected 3 / 3 copies available, saw “${copies}”`);
        }
      }),

      step("Correcting the title does not disturb anything else", async (t) => {
        await t.page.getByRole("button", { name: `Edit ${NEW_BOOK.title}` }).click();
        await t.fillField("Title *", "The Beta Tester's Handbook");
        await t.click("Save Changes");
        await t.expectToast(/saved|updated/i);
        await t.settle(900);
        const copies = (await t.page.locator("tbody tr").first().locator("td").nth(5).textContent())?.trim();
        if (copies !== `${NEW_BOOK.copies} / ${NEW_BOOK.copies}`) {
          throw new Error(`renaming changed the copy count to “${copies}” — it should still be 3 / 3`);
        }
        const subject = (await t.page.locator("tbody tr").first().locator("td").nth(4).textContent())?.trim();
        if (!subject) throw new Error("renaming cleared the subject");
      }),

      step("Withdraw it again", async (t) => {
        t.acceptDialog();
        await t.page.getByRole("button", { name: /^Delete The Beta Tester/ }).click();
        await t.expectToast(/deleted/i);
        await t.settle(900);
        await t.expectEmptyTable("No books found");
      }),
    ],
  }),

  defineJourney({
    id: "borrowers-lifecycle",
    title: "Register a borrower, read their history, suspend them",
    persona: "librarian",
    steps: [
      step("Open Borrowers", async (t) => {
        await t.goTo("Borrowers");
        await t.expectVisible("Member ID");
      }),

      step("Register a new student", async (t) => {
        await t.click("New Member");
        await t.fillField("Full Name *", "Beta Test Student");
        await t.chooseOption("Type", "Student");
        await t.click("Register Member");
        await t.expectToast(/added|registered|saved/i);
      }),

      step("They appear with a membership code and nothing borrowed", async (t) => {
        await t.settle(800);
        await t.fillField("Search borrowers", "Beta Test Student");
        await t.settle(1000);
        await t.expectRowCount(1);
        const row = t.page.locator("tbody tr").first();
        const code = (await row.locator("td").nth(0).textContent())?.trim();
        if (!code || code === "—") throw new Error("no membership code was assigned");
        const out = (await row.locator("td").nth(4).textContent())?.trim();
        if (out !== "0") throw new Error(`a new member should have 0 books out, saw “${out}”`);
      }),

      step("Their borrowing history opens and is empty", async (t) => {
        await t.page.getByRole("button", { name: /^Borrowing history/ }).click();
        await t.settle(900);
        await t.expectVisible("Beta Test Student");
        await t.shot("empty-history");
        await t.page.keyboard.press("Escape");
        await t.settle(400);
      }),

      step("Suspending them sticks", async (t) => {
        await t.page.getByRole("button", { name: /^Edit Beta Test Student/ }).click();
        await t.chooseOption("Status", "Suspended");
        await t.click("Save Changes");
        await t.expectToast(/saved|updated/i);
        await t.settle(900);
        await t.expectVisible("Suspended", { within: "tbody" });
      }),

      step("A suspended member's other details survived the change", async (t) => {
        const type = (await t.page.locator("tbody tr").first().locator("td").nth(2).textContent())?.trim();
        if (type !== "Student") throw new Error(`suspending changed their type to “${type}”`);
      }),

      step("Remove the test record so the next run starts clean", async (t) => {
        t.acceptDialog();
        await t.page.getByRole("button", { name: /^Delete Beta Test Student/ }).click();
        await t.settle(900);
      }),
    ],
  }),
];
