/**
 * Minimal type declarations for parquetjs-lite (CommonJS, no upstream types).
 * Only the surface used by ParquetExporter and its tests is typed here.
 */
declare module "parquetjs-lite" {
  export interface ParquetSchemaDefinition {
    [field: string]: {
      type: string;
      optional?: boolean;
    };
  }

  export class ParquetSchema {
    constructor(schema: ParquetSchemaDefinition);
  }

  export class ParquetWriter {
    static openFile(
      schema: ParquetSchema,
      path: string,
      opts?: Record<string, unknown>
    ): Promise<ParquetWriter>;
    appendRow(row: Record<string, unknown>): Promise<void>;
    close(): Promise<void>;
  }

  export class ParquetReader {
    static openFile(path: string): Promise<ParquetReader>;
    getCursor(columnList?: string[][]): ParquetCursor;
    close(): Promise<void>;
  }

  export interface ParquetCursor {
    next(): Promise<Record<string, unknown> | null>;
  }

  export class ParquetEnvelopeReader {}
  export class ParquetEnvelopeWriter {}
  export class ParquetTransformer {}
  export class ParquetShredder {}
}
