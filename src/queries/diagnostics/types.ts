export interface ChapterDiagnosticData {
  chapterId: string;
  chapterTitle: string;
  chapterParsingStatus: 'TODO' | 'SUCCESS' | 'FAILED';
  factsExtractionStatus: 'TODO' | 'SUCCESS' | 'FAILED';
  factPageNumbersStatus: 'TODO' | 'SUCCESS' | 'FAILED';
  errorMessage?: string;
  factsCount: number;
  factsWithPageNumbers: number;
}

export interface DiagnosticUpdateData {
  chapterParsingStatus?: 'TODO' | 'SUCCESS' | 'FAILED';
  factsExtractionStatus?: 'TODO' | 'SUCCESS' | 'FAILED';
  factPageNumbersStatus?: 'TODO' | 'SUCCESS' | 'FAILED';
  errorMessage?: string;
  factsCount?: number;
  factsWithPageNumbers?: number;
}
