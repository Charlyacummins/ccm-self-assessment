// src/lib/sanity.server.ts
import { createClient } from "@sanity/client";

export const sanityWrite = createClient({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID!,
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET!,
  apiVersion: "2024-08-01",
  token: process.env.SANITY_WRITE_TOKEN!, // ← server-only
  useCdn: false,
});
