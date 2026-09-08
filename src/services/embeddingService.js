import { pipeline } from "@xenova/transformers";

let embedderPromise = null;

// Lazily load the model once, reuse across all calls — loading it per
// request would add several seconds of latency to every save/query.
function getEmbedder() {
  if (!embedderPromise) {
    embedderPromise = pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");
  }
  return embedderPromise;
}

export async function embedText(text) {
  const embedder = await getEmbedder();
  const output = await embedder(text, { pooling: "mean", normalize: true });
  return Array.from(output.data);
}
