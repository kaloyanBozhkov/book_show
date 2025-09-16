import type { ai_cached_embedding, embedding_feature_type } from "@prisma/client";

// Type for cached embedding with parsed vector
export type CachedEmbeddingWithVector = Omit<ai_cached_embedding, 'embedding'> & {
  embedding: number[]; // The actual vector embedding parsed from the database
};

// Type for raw database result (embedding as text)
export type RawCachedEmbedding = Omit<ai_cached_embedding, 'embedding'> & {
  embedding: string; // Raw embedding as text from database
};

// Type for creating a new cached embedding
export type CreateCachedEmbeddingInput = {
  text: string;
  embedding: number[];
  featureType: embedding_feature_type[];
};

// Type for the result of creating a cached embedding
export type CreatedCachedEmbedding = {
  id: string;
  text: string;
  created_at: Date;
  updated_at: Date;
  embedding: number[];
};
