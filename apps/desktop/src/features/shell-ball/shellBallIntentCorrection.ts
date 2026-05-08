const SHELL_BALL_INTENT_LABELS: Record<string, string> = {
  agent_loop: "Agent Loop",
  explain: "Explain",
  rewrite: "Rewrite",
  summarize: "Summarize",
  translate: "Translate",
  write_file: "Write Document",
};

/**
 * Formats the current intent into a compact user-facing label for the
 * confirmation bubble header and correction affordances.
 *
 * @param intentName Formal intent name from the task payload.
 * @returns A readable label for shell-ball UI.
 */
export function formatShellBallIntentLabel(intentName: string): string {
  const normalizedIntentName = intentName.trim().toLowerCase();

  if (normalizedIntentName === "") {
    return "Intent";
  }

  return SHELL_BALL_INTENT_LABELS[normalizedIntentName]
    ?? normalizedIntentName.replace(/[_-]+/gu, " ").replace(/\b\w/gu, (character) => character.toUpperCase());
}

/**
 * Builds the temporary input label used while shell-ball borrows the inline
 * draft field for intent confirmation follow-up.
 *
 * @param currentIntentLabel Current inferred intent label shown in the bubble.
 * @returns A compact label that makes the active intent explicit.
 */
export function buildShellBallIntentCorrectionLabel(currentIntentLabel: string): string {
  return `Intent: ${currentIntentLabel}`;
}

/**
 * Builds the temporary input placeholder used while the shell-ball borrows the
 * inline draft field for natural-language intent correction.
 *
 * @param currentIntentLabel Current confirmed intent label shown in the bubble.
 * @returns Placeholder text for the borrowed inline input.
 */
export function buildShellBallIntentCorrectionPlaceholder(currentIntentLabel: string): string {
  return `Leave this empty to continue with ${currentIntentLabel}, or describe a different intent.`;
}
