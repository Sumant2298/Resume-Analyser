declare module "pdf-parse" {
  const pdf: (data: Buffer | Uint8Array | ArrayBuffer) => Promise<{ text: string }>;
  export default pdf;
}
