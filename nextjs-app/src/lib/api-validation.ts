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
