import { createReadStream, createWriteStream } from "fs";
import { pipeline } from "stream/promises";
import { createGzip, createGunzip } from "zlib";

export class CompressionHelper {
  static async gzipFile(inputPath: string, outputPath: string): Promise<void> {
    await pipeline(createReadStream(inputPath), createGzip(), createWriteStream(outputPath));
  }

  static async gunzipFile(inputPath: string, outputPath: string): Promise<void> {
    await pipeline(createReadStream(inputPath), createGunzip(), createWriteStream(outputPath));
  }
}
