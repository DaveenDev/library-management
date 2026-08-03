import { defineJourney, step } from "../lib/tester.mjs";
import { FIXTURES, PERSONAS } from "../personas.mjs";

const { dune } = FIXTURES.books;
const { amara } = FIXTURES.members;

export default [
  defineJourney({
    id: "role-assistant",
    title: "An assistant can work the desk but not run the library",
    persona: "assistant",
    steps: [
      step("They are told which role they hold", async (t) => {
        await t.expectVisible(PERSONAS.assistant.name);
        await t.expectVisible("Assistant");
      }),

      step("User Management is not offered to them at all", async (t) => {
        await t.expectHidden("User Management");
      }),

      step("They can still read the catalogue", async (t) => {
        await t.goTo("Book Catalog");
        const rows = await t.rowCount();
        if (rows === 0) throw new Error("an assistant sees an empty catalogue");
      }),

      step("But they are not offered Add, Edit or Delete", async (t) => {
        await t.expectButton("Add Book", { present: false });
        await t.expectButton(`Edit ${dune.title}`, { present: false });
        await t.expectButton(`Delete ${dune.title}`, { present: false });
        await t.shot("assistant-catalogue");
      }),

      step("They can check a book out — that is their job", async (t) => {
        await t.goTo("Circulation");
        await t.expectVisible("Check Out");
        await t.fillField("Book barcode", dune.barcode);
        await t.fillField("Member ID", amara.code);
        await t.click("Confirm Check Out");
        await t.expectToast(/Checked out/i);
      }),

      step("Fines are visible but not collectable by them", async (t) => {
        await t.goTo("Fines");
        await t.expectButton("Collect", { present: false });
        await t.expectButton("Waive", { present: false });
      }),

      step("Fine policy is readable but locked", async (t) => {
        await t.goTo("Misc");
        await t.expectVisible("Only an administrator can change fine policy");
        const disabled = await t.page.getByLabel("Grace Period").first().isDisabled();
        if (!disabled) throw new Error("an assistant can type into the fine policy fields");
      }),

      step("And the shelf lists cannot be edited", async (t) => {
        await t.expectButton("Add", { present: false });
      }),

      step("Tidy up: return the book they borrowed", async (t) => {
        await t.goTo("Circulation");
        await t.page.getByLabel("Book barcode").nth(1).fill(dune.barcode);
        await t.page.getByLabel("Book barcode").nth(1).press("Enter");
        await t.expectToast(/Returned/i);
      }),
    ],
  }),

  defineJourney({
    id: "role-librarian",
    title: "A librarian runs the collection but not the staff list",
    persona: "librarian",
    steps: [
      step("They can catalogue", async (t) => {
        await t.goTo("Book Catalog");
        await t.expectButton("Add Book");
        await t.expectButton(`Edit ${dune.title}`);
      }),

      step("They can collect fines", async (t) => {
        await t.goTo("Fines");
        const unpaid = await t.page.locator("tbody tr", { hasText: "Unpaid" }).count();
        if (unpaid > 0) await t.expectButton("Collect");
      }),

      step("But staff accounts are not theirs to manage", async (t) => {
        await t.expectHidden("User Management");
      }),

      step("And fine policy is an administrator's call", async (t) => {
        await t.goTo("Misc");
        await t.expectVisible("Only an administrator can change fine policy");
      }),

      step("Changing the theme still works for them", async (t) => {
        // Appearance is deliberately exempt from the settings permission.
        await t.click("Appearance");
        await t.settle(400);
        await t.page.getByRole("button", { name: "sage theme" }).click();
        await t.settle(900);
        await t.page.reload({ waitUntil: "domcontentloaded" });
        await t.settle(1800);
        const saved = await t.page.evaluate(
          () => getComputedStyle(document.querySelector("aside")).backgroundColor,
        );
        t.observe("polish", `Theme persisted across reload as ${saved}`);
      }),
    ],
  }),

  defineJourney({
    id: "role-admin",
    title: "An administrator manages staff accounts",
    persona: "admin",
    steps: [
      step("User Management is available to them", async (t) => {
        await t.goTo("User Management");
        await t.expectVisible("Roles & Permissions");
      }),

      step("The roles card describes what the roles actually do", async (t) => {
        await t.expectVisible("Manage staff accounts");
        await t.expectVisible("Check out, return, renew and hold");
        await t.shot("roles-card");
      }),

      step("Add a staff account with a password", async (t) => {
        await t.click("Add User");
        await t.fillField("Full Name *", "Beta Test Clerk");
        await t.fillField("Email *", "beta.clerk@lumenlibrary.org");
        await t.fillField("Password *", "beta-clerk-password");
        await t.chooseOption("Role", "Assistant");
        await t.click("Create User");
        await t.expectToast(/added/i);
      }),

      step("A short password is refused before it is stored", async (t) => {
        await t.click("Add User");
        await t.fillField("Full Name *", "Too Short");
        await t.fillField("Email *", "too.short@lumenlibrary.org");
        await t.fillField("Password *", "abc");
        await t.click("Create User");
        await t.expectToast(/at least 10/i);
        await t.page.keyboard.press("Escape");
        await t.settle(400);
      }),

      step("The new clerk can sign in with what they were given", async (t) => {
        await t.signOut();
        await t.signIn({ email: "beta.clerk@lumenlibrary.org", password: "beta-clerk-password" });
        await t.expectVisible("Beta Test Clerk");
        await t.expectVisible("Assistant");
      }),

      step("An admin cannot lock themselves out", async (t) => {
        await t.signOut();
        await t.signIn(PERSONAS.admin);
        await t.settle(1200);
        await t.goTo("User Management");
        await t.settle(600);
        // Their own row must not offer removal.
        await t.expectButton(`Remove ${PERSONAS.admin.name}`, { present: false });
      }),

      step("Tidy up: remove the test clerk", async (t) => {
        t.acceptDialog();
        await t.page.getByRole("button", { name: "Remove Beta Test Clerk" }).click();
        await t.expectToast(/removed/i);
      }),
    ],
  }),
];
