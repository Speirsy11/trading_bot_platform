import { mkdir, stat } from "fs/promises";
import { join } from "path";

import { createLogger } from "@tb/config";
import type { Database } from "@tb/db";
import { dataExports, queryOHLCVByRange } from "@tb/db";
import { eq } from "drizzle-orm";

import { CSVExporter } from "./CSVExporter.js";
import { CompressionHelper } from "./CompressionHelper.js";
import { ParquetExporter } from "./ParquetExporter.js";
import { SQLiteExporter } from "./SQLiteExporter.js";

const logger = createLogger("export-manager");

export interface ExportRequest {
  id: string;
  exchange: string;
  symbols: string[];
  timeframe: string;
  startTime: Date;
  endTime: Date;
  format: "csv" | "parquet" | "sqlite";
  compressed: boolean;
  outputDir: string;
}

export class ExportManager {
  private db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  async runExport(request: ExportRequest): Promise<{ filePath: string; fileSize: number; rowCount: number }> {
    await this.updateExportStatus(request.id, "processing", 0);

    try {
      await mkdir(request.outputDir, { recursive: true });

      const allRows: Awaited<ReturnType<typeof queryOHLCVByRange>> = [];

      // Fetch data per symbol
      for (let i = 0; i < request.symbols.length; i++) {
        const symbol = request.symbols[i]!;
        const rows = await queryOHLCVByRange(
          this.db,
          request.exchange,
          symbol,
          request.timeframe,
          request.startTime,
          request.endTime,
        );
        allRows.push(...rows);

        const progress = ((i + 1) / request.symbols.length) * 50;
        await this.updateExportStatus(request.id, "processing", progress);
      }

      // Generate output file
      const extension = this.getExtension(request.format);
      const baseName = `${request.id}.${extension}`;
      const outputPath = join(request.outputDir, baseName);

      let rowCount = 0;

      switch (request.format) {
        case "csv": {
          const exporter = new CSVExporter();
          const result = await exporter.export(allRows, outputPath);
          rowCount = result.rowCount;
          break;
        }
        case "parquet": {
          const exporter = new ParquetExporter();
          const result = await exporter.export(allRows, outputPath);
          rowCount = result.rowCount;
          break;
        }
        case "sqlite": {
          const exporter = new SQLiteExporter();
          const result = await exporter.export(allRows, outputPath);
          rowCount = result.rowCount;
          break;
        }
      }

      await this.updateExportStatus(request.id, "processing", 80);

      // Compress if requested
      let finalPath = outputPath;
      if (request.compressed && request.format !== "sqlite") {
        finalPath = `${outputPath}.gz`;
        await CompressionHelper.gzipFile(outputPath, finalPath);
      }

      const fileStat = await stat(finalPath);

      await this.updateExportStatus(request.id, "completed", 100, {
        filePath: finalPath,
        fileSize: fileStat.size,
        rowCount,
      });

      logger.info(
        { exportId: request.id, format: request.format, rowCount, fileSize: fileStat.size },
        "Export completed",
      );

      return { filePath: finalPath, fileSize: fileStat.size, rowCount };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.updateExportStatus(request.id, "failed", 0, { error: message });
      throw error;
    }
  }

  private getExtension(format: string): string {
    switch (format) {
      case "csv":
        return "csv";
      case "parquet":
        return "jsonl";
      case "sqlite":
        return "sqlite";
      default:
        return "dat";
    }
  }

  private async updateExportStatus(
    id: string,
    status: string,
    progress: number,
    extra?: { filePath?: string; fileSize?: number; rowCount?: number; error?: string },
  ) {
    await this.db
      .update(dataExports)
      .set({
        status,
        progress,
        filePath: extra?.filePath,
        fileSize: extra?.fileSize,
        rowCount: extra?.rowCount,
        error: extra?.error,
        completedAt: status === "completed" || status === "failed" ? new Date() : undefined,
      })
      .where(eq(dataExports.id, id));
  }
}
