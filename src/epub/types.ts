export interface BookIndexEntry {
  title: string;
  href: string;
  id: string;
  level: number;
  children?: BookIndexEntry[];
}

export interface BookIndex {
  entries: BookIndexEntry[];
  title?: string;
  author?: string;
  language?: string;
  publisher?: string;
  description?: string;
  totalChapters: number;
  filePath?: string;
}

export interface EPUBParseResult {
  success: boolean;
  data?: BookIndex;
  error?: string;
  epub?: any; // The parsed EPub instance for extracting chapter content
}
