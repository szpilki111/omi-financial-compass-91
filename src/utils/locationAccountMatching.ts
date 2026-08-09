/**
 * JEDNO miejsce z logiką „do której placówki należy konto”.
 *
 * Zasada: placówka wynika z SEGMENTÓW numeru konta (segment 2 i 3), a NIE z
 * `transactions.location_id` / `documents.location_id`. Dokument zaksięgowany przez
 * Prowincję na koncie domu (np. `110-2-13-1`) należy do domu, nie do Prowincji.
 *
 * Dopasowanie jest ŚCISŁE po segmentach (nie `LIKE`):
 *  - identyfikator „1” (Prowincja) obejmuje `100-1`, `110-1-…`, ale nie `100-2-13`,
 *  - identyfikator „2-10” nie może łapać `400-4-2-10`.
 */

export interface LocationLike {
  id: string;
  name?: string | null;
  location_identifier: string | null;
}

export const UNASSIGNED_LOCATION = '__unassigned__';

export const LOCATION_LEVEL_LABELS: Record<number, string> = {
  1: 'Prowincja',
  2: 'Domy',
  3: 'Parafie',
  4: 'Dzieła OMI',
  5: 'Spółki',
  0: 'Pozostałe',
};

/** Poziom placówki = pierwszy segment identyfikatora (1..n), 0 gdy nieznany. */
export const getLocationLevel = (identifier: string | null | undefined): number => {
  if (!identifier) return 0;
  const n = parseInt(identifier.split('-')[0], 10);
  return isNaN(n) || n < 0 ? 0 : n;
};

/** Etykieta poziomu — także dla poziomów, których nie ma na sztywnej liście. */
export const getLocationLevelLabel = (level: number): string =>
  LOCATION_LEVEL_LABELS[level] ?? `Poziom ${level}`;

/**
 * Czy dane konto należy do placówki o wskazanym identyfikatorze.
 * Porównywane są WYŁĄCZNIE segmenty 2 i 3 numeru konta.
 */
export const accountBelongsToLocation = (
  accountNumber: string | null | undefined,
  identifier: string | null | undefined
): boolean => {
  if (!accountNumber || !identifier) return false;
  const acc = accountNumber.split('-');
  const idParts = identifier.split('-');
  if (acc.length < 2) return false;
  if (idParts.length === 1) return acc[1] === idParts[0];
  if (idParts.length === 2) return acc.length >= 3 && acc[1] === idParts[0] && acc[2] === idParts[1];
  return false;
};

/**
 * Identyfikator placówki dla numeru konta.
 * Najpierw dopasowanie dwuczłonowe (np. „2-13”), dopiero potem jednoczłonowe („1”).
 */
export const resolveLocationIdentifierForAccount = (
  accountNumber: string | null | undefined,
  locations: LocationLike[] | null | undefined
): string | null => {
  if (!accountNumber || !locations || locations.length === 0) return null;
  const p = accountNumber.split('-');
  if (p.length < 2) return null;
  if (p.length >= 3) {
    const two = `${p[1]}-${p[2]}`;
    if (locations.some((l) => l.location_identifier === two)) return two;
  }
  const one = p[1];
  if (locations.some((l) => l.location_identifier === one)) return one;
  return null;
};

/** ID placówki (uuid) dla numeru konta lub `null`, gdy nie da się przypisać. */
export const resolveLocationIdForAccount = (
  accountNumber: string | null | undefined,
  locations: LocationLike[] | null | undefined
): string | null => {
  const identifier = resolveLocationIdentifierForAccount(accountNumber, locations);
  if (!identifier) return null;
  return locations!.find((l) => l.location_identifier === identifier)?.id ?? null;
};

/** Pierwszy segment numeru konta („210-3-7” → „210”). */
export const accountPrefixOf = (accountNumber: string | null | undefined): string =>
  (accountNumber || '').split('-')[0];