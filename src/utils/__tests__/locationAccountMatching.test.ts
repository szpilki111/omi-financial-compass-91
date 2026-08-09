import { describe, it, expect } from 'vitest';
import {
  LocationLike,
  accountBelongsToLocation,
  accountPrefixOf,
  getLocationLevel,
  getLocationLevelLabel,
  resolveLocationIdForAccount,
  resolveLocationIdentifierForAccount,
} from '../locationAccountMatching';

const locations: LocationLike[] = [
  { id: 'prow', name: 'Prowincja', location_identifier: '1' },
  { id: 'dom-13', name: 'Dom 2-13', location_identifier: '2-13' },
  { id: 'dom-10', name: 'Laskowice', location_identifier: '2-10' },
  { id: 'dom-12', name: 'Łeba', location_identifier: '2-12' },
  { id: 'par-7', name: 'Parafia św. Eugeniusza', location_identifier: '3-7' },
  { id: 'prokura', name: 'Prokura Misyjna', location_identifier: '4-2' },
  { id: 'spolka', name: 'NINIWA Sp. z o.o.', location_identifier: '5-1' },
];

describe('accountBelongsToLocation — ścisłe dopasowanie segmentów', () => {
  it('identyfikator jednoczłonowy „1” obejmuje konta Prowincji', () => {
    expect(accountBelongsToLocation('100-1', '1')).toBe(true);
    expect(accountBelongsToLocation('110-1-5', '1')).toBe(true);
  });

  it('identyfikator „1” NIE obejmuje kont domów i parafii', () => {
    expect(accountBelongsToLocation('100-2-13', '1')).toBe(false);
    expect(accountBelongsToLocation('110-2-13-1', '1')).toBe(false);
    expect(accountBelongsToLocation('210-3-7', '1')).toBe(false);
  });

  it('identyfikator dwuczłonowy nie łapie dopasowań „po kawałku”', () => {
    expect(accountBelongsToLocation('400-4-2-10', '2-10')).toBe(false);
    expect(accountBelongsToLocation('110-2-10', '2-10')).toBe(true);
    expect(accountBelongsToLocation('110-2-10-3', '2-10')).toBe(true);
    expect(accountBelongsToLocation('110-2-100', '2-10')).toBe(false);
  });

  it('konto bez segmentów nie należy do żadnej placówki', () => {
    expect(accountBelongsToLocation('210', '3-7')).toBe(false);
    expect(accountBelongsToLocation('210', '1')).toBe(false);
  });

  it('puste wejścia są bezpieczne', () => {
    expect(accountBelongsToLocation(null, '1')).toBe(false);
    expect(accountBelongsToLocation('100-1', null)).toBe(false);
    expect(accountBelongsToLocation(undefined, undefined)).toBe(false);
  });
});

describe('resolveLocationIdentifierForAccount', () => {
  it('preferuje dopasowanie dwuczłonowe przed jednoczłonowym', () => {
    expect(resolveLocationIdentifierForAccount('100-2-13', locations)).toBe('2-13');
    expect(resolveLocationIdentifierForAccount('110-2-12-3', locations)).toBe('2-12');
  });

  it('Prowincja rozpoznawana z jednoczłonowego identyfikatora', () => {
    expect(resolveLocationIdentifierForAccount('100-1', locations)).toBe('1');
    expect(resolveLocationIdentifierForAccount('110-1-7', locations)).toBe('1');
  });

  it('parafie, dzieła i spółki rozpoznawane po poziomie', () => {
    expect(resolveLocationIdentifierForAccount('210-3-7', locations)).toBe('3-7');
    expect(resolveLocationIdentifierForAccount('401-4-2-1', locations)).toBe('4-2');
    expect(resolveLocationIdentifierForAccount('100-5-1', locations)).toBe('5-1');
  });

  it('konta o segmentach bez placówki są nieprzypisane', () => {
    expect(resolveLocationIdentifierForAccount('100-3-17', locations)).toBeNull();
    expect(resolveLocationIdentifierForAccount('210', locations)).toBeNull();
    expect(resolveLocationIdentifierForAccount('', locations)).toBeNull();
    expect(resolveLocationIdentifierForAccount('100-1', [])).toBeNull();
  });

  it('zwraca ID placówki', () => {
    expect(resolveLocationIdForAccount('210-3-7', locations)).toBe('par-7');
    expect(resolveLocationIdForAccount('100-3-17', locations)).toBeNull();
  });
});

describe('poziomy placówek', () => {
  it('poziom = pierwszy segment identyfikatora', () => {
    expect(getLocationLevel('1')).toBe(1);
    expect(getLocationLevel('2-13')).toBe(2);
    expect(getLocationLevel('5-8')).toBe(5);
    expect(getLocationLevel(null)).toBe(0);
    expect(getLocationLevel('x-1')).toBe(0);
  });

  it('spółki (poziom 5) mają etykietę i nie giną', () => {
    expect(getLocationLevelLabel(5)).toBe('Spółki');
    expect(getLocationLevelLabel(9)).toBe('Poziom 9');
  });
});

describe('accountPrefixOf', () => {
  it('zwraca pierwszy segment', () => {
    expect(accountPrefixOf('210-3-7')).toBe('210');
    expect(accountPrefixOf('210')).toBe('210');
    expect(accountPrefixOf(null)).toBe('');
  });
});