import { defineJourney, step } from "../lib/tester.mjs";

export default [
  defineJourney({
    id: "reports-and-exports",
    title: "Pull a report and export it",
    persona: "librarian",
    steps: [
      step("Open Reports", async (t) => {
        await t.goTo("Reports");
        await t.settle(900);
        await t.expectVisible("Overdue");
      }),

      step("Every report tab loads without an error", async (t) => {
        // Scoped to the page body: the sidebar has a "Fines & Penalties"
        // destination with the same words as the tab, and clicking that
        // navigates away from Reports entirely.
        const tabs = [
          "Overdue Report",
          "Fines & Penalties",
          "List of Books",
          "Most Borrowed",
          "Inventory",
          "Transaction Log",
          "Member Activity",
        ];
        for (const tab of tabs) {
          const button = t.inPage(tab).first();
          if ((await button.count()) === 0) {
            throw new Error(`no “${tab}” report tab — the tab list has changed`);
          }
          await button.click();
          await t.settle(900);
          const broken = await t.page.getByText("Something went wrong").count();
          if (broken > 0) throw new Error(`the “${tab}” report showed an error`);
        }
        await t.shot("report");
      }),

      step("The date range filters a report that is about a period", async (t) => {
        // The Transaction Log is a "what happened between these dates"
        // question, so the range must move it.
        await t.inPage("Transaction Log").first().click();
        await t.settle(1400);
        const before = await t.rowCount();
        if (before === 0) throw new Error("the transaction log is empty in the demo data");

        await t.openPeriodPicker();
        await t.fillField("From", "2000-01-01");
        await t.fillField("To", "2000-01-02");
        await t.settle(1600);
        const after = await t.rowCount();
        if (after >= before) {
          throw new Error(
            `a two-day range in the year 2000 returned ${after} rows, no fewer than the ${before} in the default range`,
          );
        }
      }),

      step("But it is offered on reports it does not apply to", async (t) => {
        await t.fillField("From", "2020-01-01");
        await t.fillField("To", "2030-01-01");
        await t.settle(1200);
        await t.closePeriodPicker();

        await t.inPage("Overdue Report").first().click();
        await t.settle(1400);
        const before = await t.rowCount();
        await t.openPeriodPicker();
        await t.fillField("From", "2000-01-01");
        await t.fillField("To", "2000-01-02");
        await t.settle(1600);
        const after = await t.rowCount();
        if (after === before && before > 0) {
          t.observe(
            "minor",
            "The report period picker sits above every report, but only Most Borrowed and the Transaction Log consult it — Overdue, Fines, List of Books, Inventory and Member Activity ignore it silently, so a narrowed range looks like it did nothing",
          );
        }
        await t.fillField("From", "2020-01-01");
        await t.fillField("To", "2030-01-01");
        await t.settle(1200);
        await t.closePeriodPicker();
      }),

      step("Excel export downloads a file", async (t) => {
        const name = await t.expectDownload(() => t.inPage(/Excel/i).first().click());
        if (!/\.xlsx?$/.test(name)) throw new Error(`expected a spreadsheet, got “${name}”`);
        t.observe("polish", `Excel export produced ${name}`);
      }),

      step("PDF export downloads a file", async (t) => {
        const name = await t.expectDownload(() => t.inPage(/PDF/i).first().click());
        if (!/\.pdf$/.test(name)) throw new Error(`expected a PDF, got “${name}”`);
        t.observe("polish", `PDF export produced ${name}`);
      }),
    ],
  }),

  defineJourney({
    id: "labels",
    title: "Generate a sheet of scannable labels",
    persona: "librarian",
    steps: [
      step("Open Labels & Barcodes", async (t) => {
        await t.goTo("Labels");
        await t.settle(1200);
        await t.expectVisible("Generate Labels");
      }),

      step("Book spine labels render real barcodes", async (t) => {
        const svgs = await t.page.locator(".lm-label svg").count();
        if (svgs === 0) throw new Error("no barcode graphics were drawn");
        // A Code 128 barcode is many <rect> bars, not an empty <svg>.
        const bars = await t.page.locator(".lm-label svg rect").count();
        if (bars < 10) throw new Error(`barcode looks empty — only ${bars} bars drawn`);
        await t.shot("spine-labels");
      }),

      step("Switching to QR pocket labels re-renders", async (t) => {
        await t.click("QR Pocket");
        await t.settle(1500);
        const svgs = await t.page.locator(".lm-label svg").count();
        if (svgs === 0) throw new Error("no QR codes were drawn");
        await t.shot("qr-labels");
      }),

      step("The quantity drives the sheet", async (t) => {
        await t.fillField("Quantity", "6");
        await t.settle(1200);
        const labels = await t.page.locator(".lm-label").count();
        if (labels !== 6) throw new Error(`asked for 6 labels, sheet shows ${labels}`);
      }),

      step("Borrower ID cards work the same way", async (t) => {
        await t.click("Borrower IDs");
        await t.settle(1500);
        const labels = await t.page.locator(".lm-label").count();
        if (labels === 0) throw new Error("no borrower labels were drawn");
      }),

      step("The label pickers are reachable by keyboard", async (t) => {
        // These were clickable <span>s once; a tester using Tab must be able
        // to switch label type.
        const button = t.page.getByRole("button", { name: "Spine + Barcode" });
        await button.focus();
        await t.page.keyboard.press("Enter");
        await t.settle(900);
        const pressed = await button.getAttribute("aria-pressed");
        if (pressed !== "true") throw new Error("pressing Enter on the label-type picker did nothing");
      }),
    ],
  }),

  defineJourney({
    id: "settings",
    title: "An administrator changes fine policy and the shelf list",
    persona: "admin",
    steps: [
      step("Open Settings", async (t) => {
        await t.goTo("Misc");
        await t.settle(900);
        await t.expectVisible("Fines & Penalties");
      }),

      step("It shows the library's real values, not placeholders", async (t) => {
        const rate = await t.fieldValue("Daily Fine Rate");
        const loan = await t.fieldValue("Loan Period");
        if (!rate || !loan) throw new Error("fine policy fields came up empty");
        t.observe("polish", `Loaded policy: ${rate} per day, ${loan}-day loans`);
      }),

      step("Changing the daily rate saves and survives a reload", async (t) => {
        await t.fillField("Daily Fine Rate", "1.25");
        await t.click("Save Fine Settings");
        await t.expectToast(/saved/i);
        await t.page.reload({ waitUntil: "domcontentloaded" });
        await t.settle(2000);
        // A reload lands back on the Front Desk — the app keeps the current
        // section in component state rather than in the URL.
        await t.goTo("Misc");
        await t.settle(900);
        const rate = await t.fieldValue("Daily Fine Rate");
        if (Number(rate) !== 1.25) throw new Error(`saved 1.25 but reloaded as “${rate}”`);
      }),

      step("Put it back", async (t) => {
        await t.fillField("Daily Fine Rate", "0.50");
        await t.click("Save Fine Settings");
        await t.expectToast(/saved/i);
      }),

      step("A shelf can be added and removed", async (t) => {
        await t.fillField("Add to Book Shelves", "Z-99");
        await t.pressEnterIn("Add to Book Shelves");
        await t.settle(900);
        await t.expectVisible("Z-99");
        await t.page.getByRole("button", { name: "Remove Z-99" }).click();
        await t.settle(900);
        await t.expectHidden("Z-99");
      }),

      step("Configured lists reach the forms that should offer them", async (t) => {
        await t.fillField("Add to Book Shelves", "Z-98");
        await t.pressEnterIn("Add to Book Shelves");
        await t.settle(900);
        await t.fillField("Add to Subject / Category", "Beta Studies");
        await t.pressEnterIn("Add to Subject / Category");
        await t.settle(900);

        await t.goTo("Book Catalog");
        await t.click("Add Book");
        await t.settle(700);

        // Subject is a picker fed by the configured list.
        const subjects = await t.page.getByLabel("Subject").first().locator("option").allTextContents();
        if (!subjects.some((o) => o.includes("Beta Studies"))) {
          throw new Error("a subject added in Settings is not offered when cataloguing a book");
        }

        // Shelf is not. Recorded rather than failed: the app is consistent
        // with itself, but the Settings screen advertises a list that the
        // form which needs it never consults.
        const shelfIsPicker = (await t.page.getByLabel("Shelf Location").first().locator("option").count()) > 0;
        if (!shelfIsPicker) {
          t.observe(
            "major",
            "Settings has an editable Book Shelves list (\"Shelf codes used for physical placement\"), but Add Book takes the shelf as free text and never offers it — so the configured codes are decorative and a typo creates a shelf that does not exist",
          );
        }

        await t.page.keyboard.press("Escape");
        await t.settle(400);
        await t.goTo("Misc");
        await t.settle(900);
        await t.page.getByRole("button", { name: "Remove Z-98" }).click();
        await t.settle(700);
        await t.page.getByRole("button", { name: "Remove Beta Studies" }).click();
        await t.settle(700);
      }),
    ],
  }),
];
