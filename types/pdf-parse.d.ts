declare module "pdf-parse" {
  const parse: (data: Buffer, options?: { max?: number }) => Promise<{ text: string; numpages: number }>;
  export default parse;
}
