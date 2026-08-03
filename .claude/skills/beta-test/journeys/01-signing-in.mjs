import { defineJourney, step } from "../lib/tester.mjs";
import { PERSONAS } from "../personas.mjs";

export default [
  defineJourney({
    id: "sign-in-happy",
    title: "A librarian signs in and finds their own name on screen",
    persona: "signed out",
    steps: [
      step("The app asks who I am before showing anything", async (t) => {
        await t.expectVisible("Staff sign-in");
        await t.expectButton("Sign in");
        // Nothing behind the login form should have rendered.
        await t.expectHidden("Front Desk");
      }),

      step("A wrong password is refused, and says so", async (t) => {
        await t.signIn({ email: PERSONAS.librarian.email, password: "not-my-password" });
        await t.expectVisible("incorrect email or password");
        await t.settle(300);
      }),

      step("The right password gets me in", async (t) => {
        await t.signIn(PERSONAS.librarian);
        await t.expectVisible("Front Desk");
      }),

      step("The sidebar shows me, not a placeholder", async (t) => {
        await t.expectVisible(PERSONAS.librarian.name);
        await t.expectVisible("Librarian");
        await t.shot("signed-in");
      }),

      step("Reloading keeps me signed in", async (t) => {
        await t.page.reload({ waitUntil: "domcontentloaded" });
        await t.settle(1500);
        await t.expectVisible(PERSONAS.librarian.name);
      }),

      step("Signing out returns me to the form", async (t) => {
        await t.signOut();
        await t.expectVisible("Staff sign-in");
      }),

      step("And the session is really gone after sign-out", async (t) => {
        await t.page.reload({ waitUntil: "domcontentloaded" });
        await t.settle(1500);
        if (!(await t.isSignedOut())) throw new Error("still signed in after signing out and reloading");
      }),
    ],
  }),

  defineJourney({
    id: "sign-in-disabled-account",
    title: "A disabled account cannot get in, and is told why",
    persona: "signed out",
    steps: [
      step("Sara Kim's account has been disabled", async (t) => {
        await t.signIn(PERSONAS.disabled);
        await t.expectVisible("this account has been disabled");
      }),

      step("Being disabled is not a way to guess who works here", async (t) => {
        await t.page.reload({ waitUntil: "domcontentloaded" });
        await t.settle(800);
        await t.signIn({ email: "nobody@lumenlibrary.org", password: "lumen-demo-2024" });
        // An unknown address must answer exactly like a wrong password.
        await t.expectVisible("incorrect email or password");
      }),
    ],
  }),
];
