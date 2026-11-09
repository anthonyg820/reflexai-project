export const CLOSING_LINE = "Thanks for talking with me. I think I'm okay to stop here.";

/**
 * Scripted persona: the nth trainee message gets persona line n+1 (line 0 opens
 * the session). After the script runs out the persona closes once, then goes quiet.
 */
export function nextPersonaLine(lines: string[], traineeTurnsSoFar: number): string | null {
  const next = lines[traineeTurnsSoFar + 1];
  if (next !== undefined) return next;
  return traineeTurnsSoFar + 1 === lines.length ? CLOSING_LINE : null;
}
