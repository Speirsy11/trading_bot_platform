import { createReadStream, createWriteStream } from "fs";
import { unlink } from "fs/promises";
import { pipeline } from "stream/promises";
import { createGzip, createGunzip } from "zlib";
import * as zlib from "zlib";

// createZstdCompress was added in Node 21. The @types/node version in this repo
// predates that release, so we extend the zlib type locally rather than relying
// on the incomplete definitions.
interface ZlibWithZstd {
  createZstdCompress?: () => NodeJS.ReadWriteStream;
}

const zlibExt = zlib as unknown as ZlibWithZstd;

function getZstdCompress(): () => NodeJS.ReadWriteStream {
  if (typeof zlibExt.createZstdCompress !== "function") {
    throw new Error(
      "createZstdCompress is not available in this Node.js version (requires Node 21+)"
    );
  }
  return zlibExt.createZstdCompress;
}

export class CompressionHelper {
  /**
   * Compress `inputPath` using the given format, writing the result to
   * `{inputPath}.gz` or `{inputPath}.zst`, then deleting the original file.
   * Returns the path of the compressed file.
   */
  static async compress(inputPath: string, format: "gzip" | "zstd"): Promise<string> {
    if (format === "zstd") {
      const createZstdCompress = getZstdCompress();
      const outputPath = `${inputPath}.zst`;
      await pipeline(
        createReadStream(inputPath),
        createZstdCompress(),
        createWriteStream(outputPath)
      );
      await unlink(inputPath);
      return outputPath;
    }

    const outputPath = `${inputPath}.gz`;
    await pipeline(createReadStream(inputPath), createGzip(), createWriteStream(outputPath));
    await unlink(inputPath);
    return outputPath;
  }

  static async gzipFile(inputPath: string, outputPath: string): Promise<void> {
    await pipeline(createReadStream(inputPath), createGzip(), createWriteStream(outputPath));
  }

  static async gunzipFile(inputPath: string, outputPath: string): Promise<void> {
    await pipeline(createReadStream(inputPath), createGunzip(), createWriteStream(outputPath));
  }
}
