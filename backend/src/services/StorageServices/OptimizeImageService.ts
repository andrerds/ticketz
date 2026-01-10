import sharp from "sharp";
import { Mutex } from "async-mutex";
import { logger } from "../../utils/logger";
import { ImageOptimizationConfig } from "../../domain/storage/StorageConfig";

const optimizationMutex = new Mutex();
let activeOptimizations = 0;
const MAX_CONCURRENT_OPTIMIZATIONS = 2;

interface OptimizeImageRequest {
  data: Buffer;
  mimetype: string;
  config: ImageOptimizationConfig;
}

interface OptimizeImageResult {
  data: Buffer;
  optimized: boolean;
  originalSize: number;
  optimizedSize: number;
}

const OptimizeImageService = async ({
  data,
  mimetype,
  config
}: OptimizeImageRequest): Promise<OptimizeImageResult> => {
  const originalSize = data.length;

  if (!config.enabled) {
    return {
      data,
      optimized: false,
      originalSize,
      optimizedSize: originalSize
    };
  }

  if (!mimetype.startsWith("image/")) {
    return {
      data,
      optimized: false,
      originalSize,
      optimizedSize: originalSize
    };
  }

  if (originalSize <= config.maxBytes) {
    return {
      data,
      optimized: false,
      originalSize,
      optimizedSize: originalSize
    };
  }

  const release = await optimizationMutex.runExclusive(async () => {
    while (activeOptimizations >= MAX_CONCURRENT_OPTIMIZATIONS) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    activeOptimizations++;
    return () => {
      activeOptimizations--;
    };
  });

  try {
    const optimizedBuffer = await sharp(data)
      .resize(config.maxWidth, null, {
        withoutEnlargement: true,
        fit: "inside"
      })
      .jpeg({ quality: config.quality })
      .toBuffer();

    const optimizedSize = optimizedBuffer.length;

    logger.info(
      {
        originalSize,
        optimizedSize,
        reduction: ((1 - optimizedSize / originalSize) * 100).toFixed(2) + "%"
      },
      "Image optimized successfully"
    );

    return {
      data: optimizedBuffer,
      optimized: true,
      originalSize,
      optimizedSize
    };
  } catch (error) {
    logger.error({ error: error.message }, "Image optimization failed");

    return {
      data,
      optimized: false,
      originalSize,
      optimizedSize: originalSize
    };
  } finally {
    release();
  }
};

export default OptimizeImageService;
