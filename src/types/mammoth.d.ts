declare module 'mammoth' {
  interface ConversionResult {
    value: string;
    messages: Array<{ type: string; message: string; [key: string]: unknown }>;
  }

  interface Input {
    buffer?: Buffer | ArrayBuffer;
    path?: string;
    stream?: NodeJS.ReadableStream;
  }

  interface Options {
    styleMap?: string | string[];
    includeEmbeddedStyleMap?: boolean;
    convertImage?: unknown;
    ignoreEmptyParagraphs?: boolean;
    idPrefix?: string;
    transformDocument?: (element: unknown) => unknown;
  }

  function convertToHtml(input: Input, options?: Options): Promise<ConversionResult>;
  function extractRawText(input: Input, options?: Options): Promise<ConversionResult>;
}
