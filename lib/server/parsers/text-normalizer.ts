export function normalizeText(input: string): string {
    return input
      .normalize('NFC')
      .replace(/[\u0591-\u05C7]/g, '')
      .replace(/[.,!?;:״"']+$/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }
  
  /**
   * Normalize text for matching and hashing (convert to lowercase and duplicate final letters)
   */
  export function normalizeForMatching(input: string): string {
    return normalizeText(input)
      .toLowerCase()
      .replace(/[ךםןףץ]/g, c => ({ 'ך':'כ','ם':'מ','ן':'נ','ף':'פ','ץ':'צ' }[c]!));
  }