// Minimal types for the parts of the Verovio toolkit Aria uses (the package ships none).
declare module 'verovio/wasm' {
  export default function createVerovioModule(): Promise<unknown>;
}
declare module 'verovio/esm' {
  export class VerovioToolkit {
    constructor(module: unknown);
    setOptions(options: Record<string, unknown>): void;
    loadData(data: string): boolean;
    getPageCount(): number;
    renderToSVG(page?: number, xmlDeclaration?: boolean): string;
    renderToTimemap(options?: Record<string, unknown>): { tstamp: number; on?: string[]; off?: string[] }[];
    getElementsAtTime(ms: number): { notes: string[]; page: number };
  }
}
