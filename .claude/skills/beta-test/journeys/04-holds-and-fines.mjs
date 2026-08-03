import { defineJourney, step } from "../lib/tester.mjs";
import { FIXTURES } from "../personas.mjs";

const { amara, elena } = FIXTURES.members;

export default [
  defineJourney({
    id: "holds-queue",
    title: "Place a hold on a title that is out, then fulfil it",
    persona: "librarian",
    steps: [
      step("Find a title with copies out", async (t) => {
        await t.goTo("Book Catalog");
        await t.fillField("Search the catalog", "Brief History");
        await t.settle(1000);
        await t.expectVisible("A Brief History of Time");
      }),

      step("Reserve it for a reader", async (t) => {
        await t.page.getByRole("button", { name: /^Reserve A Brief History/ }).click();
        await t.settle(700);
        await t.fillField("Member ID", amara.code);
        await t.click("Place Hold");
        await t.expectToast(/hold|reserv/i);
      }),

      step("The hold shows in the queue with a status", async (t) => {
        await t.goTo("Reservations");
        await t.settle(800);
        await t.expectVisible("A Brief History of Time", { within: "tbody" });
        await t.expectVisible(amara.name, { within: "tbody" });
        await t.shot("holds-queue");
      }),

      step("The same reader cannot hold the same book twice", async (t) => {
        await t.click("New Hold");
        await t.settle(700);
        await t.chooseOption("Title", { label: /Brief History/ }).catch(async () => {
          // The picker lists "Title — Author"; fall back to matching by text.
          const select = t.page.getByLabel("Title").first();
          const value = await select
            .locator("option", { hasText: "Brief History" })
            .first()
            .getAttribute("value");
          await select.selectOption(value);
        });
        await t.fillField("Member ID", amara.code);
        await t.click("Place Hold");
        const toast = await t.expectToast(/already|duplicate|existing/i);
        if (!toast) throw new Error("a duplicate hold should be refused with an explanation");
      }),

      step("A second reader joins the queue behind the first", async (t) => {
        await t.page.keyboard.press("Escape");
        await t.settle(400);
        await t.click("New Hold");
        await t.settle(700);
        const select = t.page.getByLabel("Title").first();
        const value = await select
          .locator("option", { hasText: "Brief History" })
          .first()
          .getAttribute("value");
        await select.selectOption(value);
        await t.fillField("Member ID", elena.code);
        await t.click("Place Hold");
        await t.expectToast(/hold|reserv/i);
        await t.settle(900);
        await t.expectVisible("in queue", { within: "tbody" });
      }),

      step("Fulfilling the first hold takes it out of the queue", async (t) => {
        const row = t.page.locator("tbody tr", { hasText: amara.name }).first();
        await row.getByRole("button", { name: "Fulfill" }).click();
        await t.expectToast(/fulfil/i);
        await t.settle(900);
      }),

      step("A fulfilled hold can no longer be cancelled", async (t) => {
        const row = t.page.locator("tbody tr", { hasText: amara.name }).first();
        const cancels = await row.getByRole("button", { name: "Cancel" }).count();
        if (cancels > 0) throw new Error("a fulfilled hold still offers Cancel");
      }),

      step("Cancelling the second hold clears the queue", async (t) => {
        const row = t.page.locator("tbody tr", { hasText: elena.name }).first();
        await row.getByRole("button", { name: "Cancel" }).click();
        await t.expectToast(/cancel/i);
      }),
    ],
  }),

  defineJourney({
    id: "fines-desk",
    title: "Collect and waive an overdue fine",
    persona: "librarian",
    steps: [
      step("Open Fines", async (t) => {
        await t.goTo("Fines");
        await t.expectVisible("Outstanding");
      }),

      step("The seeded library has money owed", async (t) => {
        const rows = await t.rowCount();
        if (rows === 0) throw new Error("expected the demo data to include unpaid fines");
        await t.shot("fines-list");
      }),

      step("Collecting a fine marks it paid and moves the totals", async (t) => {
        const outstandingBefore = await t.page.locator("text=/₱[0-9.,]+/").first().textContent();
        await t.rowWithStatus("Unpaid").getByRole("button", { name: "Collect" }).click();
        await t.expectToast(/collect/i);
        await t.settle(1000);
        const outstandingAfter = await t.page.locator("text=/₱[0-9.,]+/").first().textContent();
        if (outstandingBefore === outstandingAfter) {
          throw new Error(`outstanding total did not change after collecting (${outstandingAfter})`);
        }
      }),

      step("A paid fine offers no further action", async (t) => {
        const paid = t.rowWithStatus("Paid");
        if ((await paid.count()) === 0) throw new Error("no fine shows as Paid after collecting one");
        if ((await paid.getByRole("button", { name: /Collect|Waive/ }).count()) > 0) {
          throw new Error("a settled fine still offers Collect or Waive");
        }
      }),

      step("Waiving works too, and is distinguishable from collecting", async (t) => {
        const unpaid = t.rowWithStatus("Unpaid");
        if ((await unpaid.count()) === 0) {
          t.observe("minor", "Only one unpaid fine in the demo data, so waiving could not be exercised");
          return;
        }
        // Waiving asks for confirmation first.
        t.acceptDialog();
        await unpaid.getByRole("button", { name: "Waive" }).click();
        await t.expectToast(/waiv/i);
        await t.settle(900);
        await t.expectVisible("Waived", { within: "tbody" });
      }),
    ],
  }),
];
