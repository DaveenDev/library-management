import path from "node:path";
import { BASE_URL } from "./stack.mjs";

/**
 * The vocabulary journeys are written in.
 *
 * Every method addresses the page the way a person would — by the label on a
 * button, the caption above a field, the words in a toast — never by CSS
 * class or DOM position. Two reasons: a journey stays readable as a
 * description of what a librarian does, and a test that finds its controls by
 * accessible name fails when a control loses its accessible name, which is
 * itself a bug worth catching.
 */
export class Tester {
  constructor(page, { journeyId, artifactDir, log }) {
    this.page = page;
    this.journeyId = journeyId;
    this.artifactDir = artifactDir;
    this.log = log;
    this.consoleErrors = [];
    this.observations = [];
    this.screenshots = [];
    this._shotCount = 0;

    // What lands here has to be worth reading, or nobody reads any of it.
    // Kept: an uncaught exception, a 5xx, a request that failed at the network
    // level. Dropped: 4xx responses, which the app handles and these journeys
    // deliberately provoke — a wrong password, a suspended borrower, a
    // duplicate hold are all 4xx and all correct behaviour.
    page.on("pageerror", (err) => this.consoleErrors.push(`uncaught: ${err.message}`));
    page.on("console", (msg) => {
      if (msg.type() !== "error") return;
      const text = msg.text();
      if (/fonts\.(googleapis|gstatic)|favicon|ERR_CONNECTION_RESET/.test(text)) return;
      if (/status of 4\d\d/.test(text)) return;
      this.consoleErrors.push(text);
    });
    page.on("requestfailed", (req) => {
      const url = req.url();
      if (/fonts\.(googleapis|gstatic)|favicon/.test(url)) return;
      // In-flight requests are aborted when a journey ends and the browser
      // context closes; that is the harness, not the app.
      const reason = req.failure()?.errorText ?? "";
      if (/ERR_ABORTED/.test(reason)) return;
      this.consoleErrors.push(`request failed: ${req.method()} ${url} (${reason})`);
    });
  }

  // ---------- Navigating ----------

  async open() {
    await this.page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
    await this.page.waitForSelector("form, aside", { timeout: 20_000 });
  }

  async signIn({ email, password }) {
    await this.page.getByLabel("Email").fill(email);
    await this.page.getByLabel("Password").fill(password);
    await this.page.getByRole("button", { name: "Sign in" }).click();
  }

  async signOut() {
    await this.page.getByRole("button", { name: /^Sign out/ }).click();
    await this.page.waitForSelector('button:has-text("Sign in")', { timeout: 10_000 });
  }

  /** Click a sidebar destination, opening the drawer first if it is collapsed. */
  async goTo(section) {
    const toggle = this.page.getByRole("button", { name: "Open navigation" });
    if (await toggle.isVisible().catch(() => false)) {
      const drawerShut = await this.page.evaluate(
        () => (document.querySelector(".lm-sidebar")?.getBoundingClientRect().left ?? -1) < 0,
      );
      if (drawerShut) {
        await toggle.click();
        await this.page.waitForTimeout(350);
      }
    }
    await this.page.locator("aside").getByRole("button", { name: section, exact: false }).first().click();
    await this.page.waitForTimeout(600);
  }

  // ---------- Acting ----------

  async click(name, { exact = false } = {}) {
    await this.page.getByRole("button", { name, exact }).first().click();
    await this.page.waitForTimeout(250);
  }

  async fillField(label, value) {
    await this.page.getByLabel(label, { exact: false }).first().fill(String(value));
  }

  async chooseOption(label, value) {
    await this.page.getByLabel(label, { exact: false }).first().selectOption(String(value));
    await this.page.waitForTimeout(400);
  }

  async pressEnterIn(label) {
    await this.page.getByLabel(label, { exact: false }).first().press("Enter");
    await this.page.waitForTimeout(500);
  }

  /** Answer a window.confirm/prompt the app is about to raise. */
  acceptDialog(promptText) {
    this.page.once("dialog", (d) => d.accept(promptText ?? ""));
  }

  async settle(ms = 700) {
    await this.page.waitForTimeout(ms);
  }

  /**
   * The Reports period picker.
   *
   * It covers the page with a full-screen click-catcher while open, so
   * anything clicked before it is dismissed hits the catcher instead. Unlike
   * the modals it does not close on Escape, hence the explicit toggle.
   */
  async openPeriodPicker() {
    const button = this.pageBody().locator("button[aria-expanded]").first();
    if ((await button.getAttribute("aria-expanded")) !== "true") await button.click();
    await this.page.waitForTimeout(400);
  }

  async closePeriodPicker() {
    const button = this.pageBody().locator("button[aria-expanded]").first();
    if ((await button.getAttribute("aria-expanded")) !== "true") return;
    // Dismissed by clicking the catcher, not the button: the catcher covers
    // the whole viewport at a higher layer than the button that opened it, so
    // the button cannot be clicked a second time to toggle it shut.
    await this.page.mouse.click(20, 500);
    await this.page.waitForTimeout(400);
  }

  // ---------- Checking ----------

  async expectVisible(text, { within } = {}) {
    const scope = within ? this.page.locator(within) : this.page;
    const found = scope.getByText(text, { exact: false }).first();
    await found.waitFor({ state: "visible", timeout: 8_000 }).catch(() => {
      throw new Error(`expected to see “${text}” on screen`);
    });
  }

  async expectHidden(text) {
    const count = await this.page.getByText(text, { exact: false }).count();
    if (count > 0) throw new Error(`did not expect to see “${text}”, but it is on screen`);
  }

  async expectButton(name, { present = true } = {}) {
    const count = await this.page.getByRole("button", { name, exact: false }).count();
    if (present && count === 0) throw new Error(`expected a “${name}” button, found none`);
    if (!present && count > 0) throw new Error(`expected no “${name}” button, found ${count}`);
  }

  /** Toasts disappear after ~3.2s, so this has to catch them while they are up. */
  async expectToast(pattern) {
    const toast = this.page.locator('[aria-live="polite"]').getByText(pattern).first();
    await toast.waitFor({ state: "visible", timeout: 8_000 }).catch(() => {
      throw new Error(`expected a toast matching ${pattern}`);
    });
    return (await toast.textContent())?.trim();
  }

  async expectRowCount(expected) {
    const actual = await this.page.locator("tbody tr").count();
    if (actual !== expected) throw new Error(`expected ${expected} rows, saw ${actual}`);
  }

  async rowCount() {
    return this.page.locator("tbody tr").count();
  }

  /**
   * An empty table still has a row — the one holding "No books found." — so
   * emptiness is asserted by that message rather than by a row count of zero.
   */
  async expectEmptyTable(message) {
    const empty = this.page.locator("tbody").getByText(message, { exact: false });
    await empty.waitFor({ state: "visible", timeout: 8_000 }).catch(async () => {
      throw new Error(
        `expected the table to be empty, but it still lists ${await this.rowCount()} row(s)`,
      );
    });
  }

  /**
   * A row identified by a status badge.
   *
   * Matched exactly: "Paid" is a substring of "Unpaid", so a loose match finds
   * the very rows it is meant to exclude.
   */
  rowWithStatus(status) {
    return this.page
      .locator("tbody tr")
      .filter({ has: this.page.getByText(status, { exact: true }) })
      .first();
  }

  /** A row identified by two of its cells, for tables where one is not unique. */
  rowMatching(...texts) {
    let rows = this.page.locator("tbody tr");
    for (const text of texts) rows = rows.filter({ hasText: text });
    return rows.first();
  }

  /**
   * Scoped to the page body — inside the topbar and the sidebar, but not
   * either of them.
   *
   * Both surround the content with controls that share its words: the sidebar
   * has a "Fines & Penalties" destination with the same label as a report
   * tab, and the topbar's appearance menu is an expandable button just like
   * the report's date picker. Unscoped, a lookup finds the chrome first.
   */
  inPage(name) {
    return this.pageBody().getByRole("button", { name, exact: false });
  }

  pageBody() {
    return this.page.locator(".lm-page");
  }

  /**
   * Trigger a download and return its filename.
   *
   * The waiter has to be armed before the click, and if the click never
   * produces a download that pending promise rejects on its own — which took
   * the whole run down before this was wrapped.
   */
  async expectDownload(trigger, { timeout = 20_000 } = {}) {
    const waiter = this.page.waitForEvent("download", { timeout }).catch((err) => err);
    await trigger();
    const result = await waiter;
    if (result instanceof Error) throw new Error("no file was downloaded");
    return result.suggestedFilename();
  }

  async fieldValue(label) {
    return this.page.getByLabel(label, { exact: false }).first().inputValue();
  }

  async isSignedOut() {
    return (await this.page.getByRole("button", { name: "Sign in" }).count()) > 0;
  }

  // ---------- Reporting ----------

  /**
   * Something a human tester would write down but which is not a failure —
   * a rough edge, a surprise, a thing worth a second opinion.
   */
  observe(severity, text) {
    this.observations.push({ severity, text });
    this.log(`    · ${severity}: ${text}`);
  }

  async shot(name) {
    this._shotCount += 1;
    const file = `${this.journeyId}-${String(this._shotCount).padStart(2, "0")}-${name}.png`;
    await this.page.screenshot({ path: path.join(this.artifactDir, file) });
    this.screenshots.push(file);
    return file;
  }
}

export const step = (name, run) => ({ name, run });

export const defineJourney = (journey) => journey;
