import { z } from "zod";

/**
 * Validates data against a Zod schema.
 * Returns the parsed (typed) data or throws a Response with 400 and validation errors.
 *
 * Usage:
 *   const data = await validate(mySchema, await request.json());
 */
export async function validate<T extends z.ZodType>(
  schema: T,
  data: unknown
): Promise<z.infer<T>> {
  const result = schema.safeParse(data);

  if (!result.success) {
    const errors = result.error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
    }));

    throw new Response(
      JSON.stringify({
        error: "Validation failed",
        details: errors,
      }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  return result.data;
}

// ─── Prompt Injection Prevention ─────────────────────────────────────────────

/**
 * Patterns that indicate a prompt injection attempt in user-supplied text.
 * Detects common jailbreak/injection patterns before sending to the LLM.
 */
const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?previous\s+instructions?/i,
  /disregard\s+(all\s+)?(prior|previous|above)\s+instructions?/i,
  /you\s+are\s+now\s+(a\s+)?DAN/i,
  /\bact\s+as\s+(if\s+you\s+(are|were)\s+)?(?:an?\s+)?(?:evil|uncensored|jailbreak)/i,
  /\bforget\s+(your\s+)?(instructions?|guidelines?|rules?|training)/i,
  /\bsystem\s*prompt\b/i,
  /\[\[JAILBREAK\]\]/i,
  /<\|im_start\|>/i,   // ChatML injection
  /###\s*Human:.*###\s*Assistant:/is,  // Role injection
  /\bpretend\s+(you\s+have\s+no\s+restrictions?|to\s+be\s+(?:a\s+)?(?:different|unrestricted))/i,
];

/**
 * Check if a string contains prompt injection patterns.
 * Returns true if injection detected.
 */
export function detectPromptInjection(text: string): boolean {
  return INJECTION_PATTERNS.some((pattern) => pattern.test(text));
}

/**
 * Sanitize a user-supplied string for safe inclusion in LLM prompts.
 * - Strips null bytes
 * - Limits length
 * - Detects and rejects injection attempts
 *
 * Returns the sanitized string or throws if injection is detected.
 */
export function sanitizeForPrompt(
  text: string,
  maxLength = 10_000,
  fieldName = "input"
): string {
  if (typeof text !== "string") return "";

  // Strip null bytes
  let clean = text.replace(/\0/g, "");

  // Truncate
  if (clean.length > maxLength) {
    clean = clean.slice(0, maxLength) + "…[truncated]";
  }

  if (detectPromptInjection(clean)) {
    throw new Response(
      JSON.stringify({
        error: "Invalid input",
        detail: `Field '${fieldName}' contains content that cannot be processed.`,
      }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  return clean;
}

/**
 * Recursively sanitize all string values in a JSON object for prompt safety.
 * Use before passing user-supplied data to agent input_data.
 */
export function sanitizeInputData(
  obj: unknown,
  maxDepth = 5,
  depth = 0
): unknown {
  if (depth > maxDepth) return obj;
  if (typeof obj === "string") {
    // Sanitize but don't throw — just strip injection patterns from nested data
    let clean = obj.replace(/\0/g, "").slice(0, 50_000);
    if (detectPromptInjection(clean)) {
      // In nested data, replace with a safe placeholder instead of throwing
      clean = "[REDACTED: invalid content]";
    }
    return clean;
  }
  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeInputData(item, maxDepth, depth + 1));
  }
  if (obj && typeof obj === "object") {
    return Object.fromEntries(
      Object.entries(obj as Record<string, unknown>).map(([k, v]) => [
        k,
        sanitizeInputData(v, maxDepth, depth + 1),
      ])
    );
  }
  return obj;
}
