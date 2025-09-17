/**
 * Page number parser for EPUB chapter content
 * Extracts page numbers from HTML content using page markers like <a id="page_2"/>
 */

export interface PageRange {
  pageStart: number | null;
  pageEnd: number | null;
}

/**
 * Parses chapter content to extract page start and end numbers
 * Looks for page markers in the format: <a id="page_X"/>
 * @param content - The HTML content of the chapter
 * @returns PageRange object with pageStart and pageEnd numbers
 */
export function parsePageNumbers(content: string): PageRange {
  if (!content || typeof content !== 'string') {
    return { pageStart: null, pageEnd: null };
  }

  // Regex to match page markers like <a id="page_2"/>, <a id="page_123"/>, etc.
  // Also handles variations like <a id="page_2"></a> or <a id="page_2" />
  const pageMarkerRegex = /<a\s+id="page_(\d+)"[^>]*\/?>/gi;
  
  const matches: number[] = [];
  let match;
  
  // Find all page markers and extract page numbers
  while ((match = pageMarkerRegex.exec(content)) !== null) {
    const pageNumber = parseInt(match[1], 10);
    if (!isNaN(pageNumber)) {
      matches.push(pageNumber);
    }
  }

  // If no page markers found, return null values
  if (matches.length === 0) {
    return { pageStart: null, pageEnd: null };
  }

  // Sort page numbers to get first and last
  const sortedPages = matches.sort((a, b) => a - b);
  
  return {
    pageStart: sortedPages[0],
    pageEnd: sortedPages[sortedPages.length - 1]
  };
}

/**
 * Alternative parser that also looks for other common page marker formats
 * @param content - The HTML content of the chapter
 * @returns PageRange object with pageStart and pageEnd numbers
 */
export function parsePageNumbersAdvanced(content: string): PageRange {
  if (!content || typeof content !== 'string') {
    return { pageStart: null, pageEnd: null };
  }

  const pageNumbers: number[] = [];
  
  // Pattern 1: <a id="page_X"/>
  const pattern1 = /<a\s+id="page_(\d+)"[^>]*\/?>/gi;
  let match;
  while ((match = pattern1.exec(content)) !== null) {
    const pageNumber = parseInt(match[1], 10);
    if (!isNaN(pageNumber)) {
      pageNumbers.push(pageNumber);
    }
  }
  
  // Pattern 2: <span class="page" id="page_X">
  const pattern2 = /<span[^>]*class="[^"]*page[^"]*"[^>]*id="page_(\d+)"[^>]*>/gi;
  while ((match = pattern2.exec(content)) !== null) {
    const pageNumber = parseInt(match[1], 10);
    if (!isNaN(pageNumber)) {
      pageNumbers.push(pageNumber);
    }
  }
  
  // Pattern 3: <div id="page_X">
  const pattern3 = /<div[^>]*id="page_(\d+)"[^>]*>/gi;
  while ((match = pattern3.exec(content)) !== null) {
    const pageNumber = parseInt(match[1], 10);
    if (!isNaN(pageNumber)) {
      pageNumbers.push(pageNumber);
    }
  }

  // If no page markers found, return null values
  if (pageNumbers.length === 0) {
    return { pageStart: null, pageEnd: null };
  }

  // Remove duplicates and sort
  const uniquePages = [...new Set(pageNumbers)].sort((a, b) => a - b);
  
  return {
    pageStart: uniquePages[0],
    pageEnd: uniquePages[uniquePages.length - 1]
  };
}
