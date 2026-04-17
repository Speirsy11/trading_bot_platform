import { mkdir, stat } from "fs/promises";
import { join } from "path";

import { createLogger } from "@tb/config";
import type { Database, OHLCVCursorParams, OHLCVRow } from "@tb/db";
import { dataExports, queryOHLCVCursor } from "@tb/db";
import { eq } from "drizzle-orm";

import { CSVExporter } from "./CSVExporter";
import { CompressionHelper } from "./CompressionHelper";
import { ParquetExporter } from "./ParquetExporter";
import { SQLiteExporter } from "./SQLiteExporter";

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
  compressionFormat: "gzip" | "zstd";
  outputDir: string;
}

export class ExportManager {
  private db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  async runExport(
    request: ExportRequest
  ): Promise<{ filePath: string; fileSize: number; rowCount: number }> {
    await this.updateExportStatus(request.id, "processing", 0);

    try {
      await mkdir(request.outputDir, { recursive: true });

      // Generate output file
      const extension = this.getExtension(request.format);
      const baseName = `${request.id}.${extension}`;
      const outputPath = join(request.outputDir, baseName);

      let rowCount = 0;

      switch (request.format) {
        case "csv": {
          const exporter = new CSVExporter();
          exporter.open(outputPath);
          await this.streamSymbols(request, async (cursorParams, cursor) => {
            const { rows, nextCursor } = await queryOHLCVCursor(this.db, cursorParams, cursor);
            exporter.appendBatch(rows);
            return nextCursor;
          });
          rowCount = (await exporter.close()).rowCount;
          break;
        }
        case "parquet": {
          const exporter = new ParquetExporter();
          rowCount = (await exporter.export(this.buildAsyncIterable(request), outputPath)).rowCount;
          break;
        }
        case "sqlite": {
          const exporter = new SQLiteExporter();
          exporter.open(outputPath);
          await this.streamSymbols(request, async (cursorParams, cursor) => {
            const { rows, nextCursor } = await queryOHLCVCursor(this.db, cursorParams, cursor);
            exporter.appendBatch(rows);
            return nextCursor;
          });
          rowCount = exporter.close().rowCount;
          break;
        }
      }

      // Update progress after streaming per-symbol batches
      await this.updateExportStatus(request.id, "processing", 80);

      // Compress if requested
      let finalPath = outputPath;
      if (request.compressed && request.format !== "sqlite") {
        finalPath = await CompressionHelper.compress(outputPath, request.compressionFormat);
      }

      const fileStat = await stat(finalPath);

      await this.updateExportStatus(request.id, "completed", 100, {
        filePath: finalPath,
        fileSize: fileStat.size,
        rowCount,
      });

      logger.info(
        { exportId: request.id, format: request.format, rowCount, fileSize: fileStat.size },
        "Export completed"
      );

      return { filePath: finalPath, fileSize: fileStat.size, rowCount };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.updateExportStatus(request.id, "failed", 0, { error: message });
      throw error;
    }
  }

  /**
   * Iterate all symbols in the request, paging through each with cursor
   * batches. Calls `onBatch` for every fetched page.
   *
   * Progress is updated between symbols (0–50 % of the export run).
   */
  private async streamSymbols(
    request: ExportRequest,
    onBatch: (params: OHLCVCursorParams, cursor: string | undefined) => Promise<string | null>
  ): Promise<void> {
    for (let i = 0; i < request.symbols.length; i++) {
      const symbol = request.symbols[i]!;
      const cursorParams: OHLCVCursorParams = {
        exchange: request.exchange,
        symbol,
        timeframe: request.timeframe,
        startTime: request.startTime,
        endTime: request.endTime,
      };

      let cursor: string | undefined = undefined;
      do {
        const nextCursor = await onBatch(cursorParams, cursor);
        cursor = nextCursor ?? undefined;
      } while (cursor !== undefined);

      const progress = ((i + 1) / request.symbols.length) * 50;
      await this.updateExportStatus(request.id, "processing", progress);
    }
  }

  /**
   * Build an async iterable that pages through all symbols using cursor
   * batches. Used by the Parquet exporter which accepts an `AsyncIterable`.
   */
  private async *buildAsyncIterable(request: ExportRequest): AsyncGenerator<OHLCVRow> {
    for (let i = 0; i < request.symbols.length; i++) {
      const symbol = request.symbols[i]!;
      const cursorParams: OHLCVCursorParams = {
        exchange: request.exchange,
        symbol,
        timeframe: request.timeframe,
        startTime: request.startTime,
        endTime: request.endTime,
      };

      let cursor: string | undefined = undefined;
      do {
        const { rows, nextCursor } = await queryOHLCVCursor(this.db, cursorParams, cursor);
        yield* rows;
        cursor = nextCursor ?? undefined;
      } while (cursor !== undefined);

      const progress = ((i + 1) / request.symbols.length) * 50;
      await this.updateExportStatus(request.id, "processing", progress);
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
    extra?: { filePath?: string; fileSize?: number; rowCount?: number; error?: string }
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
