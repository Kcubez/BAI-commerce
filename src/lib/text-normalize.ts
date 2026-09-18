/**
 * Shared Myanmar-text helpers for all parsers.
 * Single source of truth for Burmese-digit conversion — previously
 * copy-pasted (with three spellings) across every parser module.
 */

const BURMESE_DIGIT_MAP: Record<string, string> = {
  "၀": "0",
  "၁": "1",
  "၂": "2",
  "၃": "3",
  "၄": "4",
  "၅": "5",
  "၆": "6",
  "၇": "7",
  "၈": "8",
  "၉": "9",
};

/** Replace Myanmar digits (၀-၉) with ASCII digits. Pure — no other changes. */
export function convertBurmeseDigits(text: string): string {
  return text.replace(/[၀-၉]/g, (d) => BURMESE_DIGIT_MAP[d] || d);
}
