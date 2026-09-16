/**
 * Claude is instructed to respond with JSON only, but strips fences
 * inconsistently in practice — defensively unwrap a ```json ... ``` block
 * (or a bare ``` ... ``` block) if the model added one anyway.
 */
export function extractJsonText(raw: string): string {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced ? fenced[1]!.trim() : trimmed;
}
