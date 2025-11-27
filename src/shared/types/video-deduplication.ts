import type { ToolResult } from './common';

export interface SimilarVideoGroup {
  groupNumber: number;
  totalVideos: number;
  videos: {
    filename: string;
    newFilename: string;
    size: number;
    sizeKB: string;
    hash: string;
    duration?: number;
    isBest: boolean;
  }[];
}

export interface VideoDeduplicationReport {
  scanDate: string;
  totalVideos: number;
  similarGroups: SimilarVideoGroup[];
  statistics: {
    totalGroups: number;
    totalDuplicates: number;
    spaceCanBeSaved: number;
  };
}

export type VideoDeduplicationResult = ToolResult &
  (
    | {
        success: true;
        report: VideoDeduplicationReport;
        duplicatesPath: string;
      }
    | {
        success: false;
        report?: never;
        duplicatesPath?: never;
      }
  );
