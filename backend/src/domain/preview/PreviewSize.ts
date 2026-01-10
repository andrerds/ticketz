export enum PreviewSize {
  THUMBNAIL = "thumbnail",
  MEDIUM = "medium",
  FULL = "full"
}

export const PREVIEW_SIZE_DIMENSIONS = {
  [PreviewSize.THUMBNAIL]: { width: 150, height: 150 },
  [PreviewSize.MEDIUM]: { width: 400, height: 400 },
  [PreviewSize.FULL]: { width: 1200, height: 1200 }
} as const;

export type PreviewSizeDimensions = typeof PREVIEW_SIZE_DIMENSIONS;
