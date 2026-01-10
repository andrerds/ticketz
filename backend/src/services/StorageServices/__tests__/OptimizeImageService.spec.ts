// eslint-disable-next-line import/no-extraneous-dependencies
import * as fc from "fast-check";
import sharp from "sharp";
import OptimizeImageService from "../OptimizeImageService";
import { ImageOptimizationConfig } from "../../../domain/storage/StorageConfig";

const createTestImageBuffer = async (
  width: number,
  height: number
): Promise<Buffer> => {
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 255, g: 0, b: 0 }
    }
  })
    .jpeg()
    .toBuffer();
};

describe("OptimizeImageService", () => {
  /**
   * Feature: s3-media-storage, Property 18: Image-only optimization
   * For any file upload, when image optimization is enabled, only files with image/* mimetype should be processed
   * Validates: Requirements 5.1
   */
  it("should only optimize files with image/* mimetype", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(
          "application/pdf",
          "video/mp4",
          "audio/mpeg",
          "text/plain",
          "application/json"
        ),
        fc.integer({ min: 1024, max: 10240 }),
        async (mimetype, size) => {
          const data = Buffer.alloc(size);
          const config: ImageOptimizationConfig = {
            enabled: true,
            maxWidth: 1920,
            quality: 80,
            maxBytes: 1024
          };

          const result = await OptimizeImageService({
            data,
            mimetype,
            config
          });

          expect(result.optimized).toBe(false);
          expect(result.data).toBe(data);
          expect(result.originalSize).toBe(size);
          expect(result.optimizedSize).toBe(size);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: s3-media-storage, Property 19: Size-based optimization
   * For any image file, optimization should only occur when the file size exceeds the configured threshold
   * Validates: Requirements 5.2
   */
  it("should only optimize images exceeding size threshold", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 100, max: 500 }),
        fc.integer({ min: 100, max: 500 }),
        async (width, height) => {
          const imageBuffer = await createTestImageBuffer(width, height);
          const threshold = imageBuffer.length + 1000;

          const config: ImageOptimizationConfig = {
            enabled: true,
            maxWidth: 1920,
            quality: 80,
            maxBytes: threshold
          };

          const result = await OptimizeImageService({
            data: imageBuffer,
            mimetype: "image/jpeg",
            config
          });

          expect(result.optimized).toBe(false);
          expect(result.data).toBe(imageBuffer);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: s3-media-storage, Property 20: Optimization failure recovery
   * For any image where optimization fails, the original file should be saved successfully
   * Validates: Requirements 5.4
   */
  it("should return original data when optimization fails", async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 1024, max: 10240 }), async size => {
        const invalidImageData = Buffer.alloc(size);
        const config: ImageOptimizationConfig = {
          enabled: true,
          maxWidth: 1920,
          quality: 80,
          maxBytes: 100
        };

        const result = await OptimizeImageService({
          data: invalidImageData,
          mimetype: "image/jpeg",
          config
        });

        expect(result.optimized).toBe(false);
        expect(result.data).toBe(invalidImageData);
        expect(result.originalSize).toBe(size);
        expect(result.optimizedSize).toBe(size);
      }),
      { numRuns: 100 }
    );
  });

  it("should successfully optimize valid images exceeding threshold", async () => {
    const imageBuffer = await createTestImageBuffer(2000, 2000);

    const config: ImageOptimizationConfig = {
      enabled: true,
      maxWidth: 1920,
      quality: 80,
      maxBytes: 1024
    };

    const result = await OptimizeImageService({
      data: imageBuffer,
      mimetype: "image/jpeg",
      config
    });

    expect(result.optimized).toBe(true);
    expect(result.optimizedSize).toBeLessThan(result.originalSize);
  });

  it("should not optimize when optimization is disabled", async () => {
    const imageBuffer = await createTestImageBuffer(2000, 2000);

    const config: ImageOptimizationConfig = {
      enabled: false,
      maxWidth: 1920,
      quality: 80,
      maxBytes: 1024
    };

    const result = await OptimizeImageService({
      data: imageBuffer,
      mimetype: "image/jpeg",
      config
    });

    expect(result.optimized).toBe(false);
    expect(result.data).toBe(imageBuffer);
  });
});
