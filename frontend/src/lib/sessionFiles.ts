// In-memory (not persisted) holder for the raw Plant Register PDF File the
// user last uploaded on the Dashboard this session, so GenerateModal can
// offer to reuse it instead of forcing a re-upload of the same weekly file.
// Files can't be serialized into localStorage, so this only survives within
// the current page load — which matches the actual "don't re-upload twice
// in the same visit" complaint this fixes.
let lastRegisterPdf: File | null = null

export function setLastRegisterPdf(file: File | null): void {
  lastRegisterPdf = file
}

export function getLastRegisterPdf(): File | null {
  return lastRegisterPdf
}
