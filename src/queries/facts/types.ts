import type { fact, ai_cached_embedding, chapter, book } from "~/prisma/client";

// Type for fact with embedding and chapter context
export type FactWithEmbedding = fact & {
  embedding: ai_cached_embedding & {
    embedding: number[]; // The actual vector embedding
  };
  chapter: chapter & {
    book: book;
  };
};

// Type for fact with minimal embedding info (for search results)
export type FactWithContext = {
  id: string;
  text: string;
  created_at: Date;
  updated_at: Date;
  embedding_id: string;
  chapter_id: string;
  chapter: {
    id: string;
    title: string;
    chapter_number: number;
    book: {
      id: string;
      title: string;
      author: string | null;
    };
  };
};

// Type for search results with similarity score
export type FactSearchResult = {
  id: string;
  text: string;
  similarity: number;
  chapter: {
    id: string;
    title: string;
    chapter_number: number;
    book: {
      id: string;
      title: string;
      author: string | null;
    };
  };
};

// Type for raw database query results from searchFacts
export type RawSearchResult = {
  id: string;
  text: string;
  similarity: number;
  chapter_id: string;
  chapter_title: string;
  chapter_number: number;
  book_id: string;
  book_title: string;
  book_author: string | null;
};
