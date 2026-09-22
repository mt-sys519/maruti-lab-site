// Vite's `?raw` suffix hands back a module's file contents as a string. Used to
// keep the SwiftCrop tool's markup in one place: its own document still serves
// it, and /swiftcrop reads the same file at build time instead of holding a
// second copy that would drift.
declare module "*?raw" {
  const contents: string;
  export default contents;
}
