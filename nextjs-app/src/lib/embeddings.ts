const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const AZURE_OPENAI_API_KEY = process.env.AZURE_OPENAI_API_KEY;
const AZURE_OPENAI_ENDPOINT = process.env.AZURE_OPENAI_ENDPOINT?.replace(/\/$/, "");
const AZURE_OPENAI_API_VERSION = process.env.AZURE_OPENAI_API_VERSION || "2024-02-15-preview";
// Embedding deployment name — typically "text-embedding-ada-002" on Azure
const AZURE_OPENAI_EMBEDDING_DEPLOYMENT =
  process.env.AZURE_OPENAI_EMBEDDING_DEPLOYMENT || "text-embedding-ada-002";

const EMBEDDING_MODEL = "text-embedding-3-small";
const MAX_INPUT_CHARS = 8000;

/**
 * Generates an embedding vector for the given text.
 * Tries OpenAI first; falls back to Azure OpenAI when OPENAI_API_KEY is not set.
 * Returns null if neither provider is available or if the request fails.
 */
export async function generateEmbedding(text: string): Promise<number[] | null> {
  const truncated = text.slice(0, MAX_INPUT_CHARS);

  // --- OpenAI (direct) ---
  if (OPENAI_API_KEY) {
    try {
      const res = await fetch("https://api.openai.com/v1/embeddings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify({ model: EMBEDDING_MODEL, input: truncated }),
      });

      if (!res.ok) {
        console.error(`OpenAI embedding API error: ${res.status} ${res.statusText}`);
        // Fall through to Azure
      } else {
        const data = await res.json();
        const embedding = data.data?.[0]?.embedding;
        if (embedding) return embedding;
      }
    } catch (error) {
      console.error("OpenAI embedding request failed:", error);
    }
  }

  // --- Azure OpenAI fallback ---
  if (AZURE_OPENAI_API_KEY && AZURE_OPENAI_ENDPOINT) {
    try {
      const url =
        `${AZURE_OPENAI_ENDPOINT}/openai/deployments/${AZURE_OPENAI_EMBEDDING_DEPLOYMENT}` +
        `/embeddings?api-version=${AZURE_OPENAI_API_VERSION}`;

      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-key": AZURE_OPENAI_API_KEY,
        },
        body: JSON.stringify({ input: truncated }),
      });

      if (!res.ok) {
        const errText = await res.text();
        console.error(`Azure OpenAI embedding API error: ${res.status} ${errText}`);
        return null;
      }

      const data = await res.json();
      return data.data?.[0]?.embedding ?? null;
    } catch (error) {
      console.error("Azure OpenAI embedding request failed:", error);
      return null;
    }
  }

  return null;
}
