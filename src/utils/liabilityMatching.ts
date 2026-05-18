/**
 * Konwencja zapisu prefiksów w mapowaniach kategorii zobowiązań:
 *  - "201"        → prefiks pierwszego segmentu (wszystkie konta zaczynające się od "201-")
 *  - "201-2-10"   → DOKŁADNE dopasowanie (tylko to konto, BEZ subkont 201-2-10-*)
 *  - "201-2-10-*" → prefiks pełnej ścieżki (to konto ORAZ wszystkie jego subkonta)
 */
export function matchesAccount(accountNumber: string, pattern: string): boolean {
  if (!accountNumber || !pattern) return false;
  const p = pattern.trim();

  // Wildcard "...-*" → dopasuj prefiks pełnej ścieżki włącznie z subkontami
  if (p.endsWith("-*")) {
    const base = p.slice(0, -2);
    return accountNumber === base || accountNumber.startsWith(base + "-");
  }

  // Pojedynczy segment (bez kreski) → klasyczny prefiks pierwszego segmentu
  if (!p.includes("-")) {
    return accountNumber === p || accountNumber.startsWith(p + "-");
  }

  // Wieloczłonowy bez wildcardu → dokładne dopasowanie (bez descend do subkont)
  return accountNumber === p;
}

export function anyMatch(accountNumber: string, patterns: string[]): boolean {
  return patterns.some((p) => matchesAccount(accountNumber, p));
}