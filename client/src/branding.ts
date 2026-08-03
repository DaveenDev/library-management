/**
 * Everything identifying *your* library lives here.
 *
 * Change these values to rebrand the app — they drive the sidebar, the
 * printed report letterhead (on screen and in exported PDFs), and the
 * QR pocket labels. Nothing else in the codebase hardcodes a library name.
 *
 * The currency symbol is configured separately, in `shared/types.ts`.
 */
export const LIBRARY = {
  /** Shown on the report letterhead and QR pocket labels. */
  name: "Lumen Library",
  /** Second letterhead line — address, website, phone, whatever fits. */
  contactLine: "128 Alder Street · lumenlibrary.org",
  /** Footer text on printed/exported reports. */
  footerName: "Lumen Library System",
  /** Domain used for the placeholder in the "add staff user" email field. */
  emailDomain: "lumenlibrary.org",
};
