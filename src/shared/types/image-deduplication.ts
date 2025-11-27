import type { ToolResult } from './common';

export interface SimilarGroup {
  groupNumber: number;
  totalImages: number;
  images: {
    filename: string;
    newFilename: string;
    size: number;
    sizeKB: string;
    hash: string;
    isBest: boolean;
  }[];
}
export interface DeduplicationReport {
  scanDate: string;
  totalPhotos: number;
  similarGroups: SimilarGroup[];
  statistics: {
    totalGroups: number;
    totalDuplicates: number;
    spaceCanBeSaved: number;
  };
}
export type ImageDeduplicationResult = ToolResult &
  (
    | {
        success: true;
        report: DeduplicationReport;
        duplicatesPath: string;
      }
    | {
        success: false;
        report?: never;
        duplicatesPath?: never;
      }
  );
