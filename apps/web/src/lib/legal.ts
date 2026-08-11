/**
 * Every fact the legal pages share, in one place.
 *
 * The three documents cross-reference each other constantly — the operator's name, the contact
 * address, the deletion window. Repeating those across three files guarantees they drift, and a
 * privacy policy that contradicts its own deletion page is worse than either alone.
 */

/**
 * TODO — replace before these URLs go into the Meta or TikTok developer portals.
 *
 * This is a placeholder rather than a guess: putting the wrong legal name on a published privacy
 * policy is worse than an obviously-unfinished one, and a mismatch against Meta Business
 * verification is a routine review rejection.
 */
export const OPERATOR_NAME = "Srijan Ghimire";

/** Nepal. Named here because the Terms' governing-law clause and the policy both reference it. */
export const JURISDICTION = "Nepal";

/**
 * Addresses on the app's own domain, which is already verified with Resend — so mail sent to them
 * is deliverable rather than aspirational. Point them at a real inbox before publishing.
 */
export const CONTACT_EMAIL = "srijanghimire85@gmail.com";
export const SUPPORT_EMAIL = "srijanghimire85@gmail.com";

export const APP_NAME = "Social Platform";
export const APP_ORIGIN = "https://spcms.srijanghimire.name.np";

/**
 * Shown on each document. Bump when the substance changes, not when a typo is fixed — the date is
 * a claim that the text reflects the system as of that day.
 */
export const EFFECTIVE_DATE = "9 August 2026";

/** Working days from a deletion request to completion. Quoted in the policy and the deletion page. */
export const DELETION_WINDOW_DAYS = 30;

export interface SubProcessor {
  name: string;
  purpose: string;
  data: string;
}

/**
 * Everyone who processes user data on the service's behalf. Derived from what the code actually
 * calls, not from a template: Anthropic appears only because `ai.service.ts` posts caption text to
 * it, and it is conditional because the feature is behind both a flag and an API key.
 */
export const SUB_PROCESSORS: SubProcessor[] = [
  {
    name: "Render",
    purpose: "Application hosting",
    data: "Everything in transit through the app, plus request logs containing IP addresses",
  },
  {
    name: "Meta (Facebook, Instagram)",
    purpose: "Publishing and account details, only for accounts you connect",
    data: "Post content and media you choose to publish; Page and Instagram account identifiers",
  },
  {
    name: "TikTok",
    purpose: "Publishing and account details, only for accounts you connect",
    data: "Video content you choose to publish; your TikTok profile identifiers",
  },
];
