import {
  conditionMatchesQuery,
  searchMedicalConditions,
} from '../domain/medicalConditionSearch.js';

describe('medicalConditionSearch', () => {
  const sampleConditions = [
    'Heart Attack',
    'Heart Failure',
    'Heart Disease',
    'Diabetes',
    'Diarrhea',
    'Fever',
    'Rare Blood Disorder',
  ];

  describe('conditionMatchesQuery', () => {
    it('matches case-insensitively at word start', () => {
      expect(conditionMatchesQuery('Heart Attack', 'hea')).toBe(true);
    });

    it('matches partial words in the middle', () => {
      expect(conditionMatchesQuery('Diarrhea', 'rrh')).toBe(true);
    });

    it('does not match unrelated queries', () => {
      expect(conditionMatchesQuery('Asthma', 'xyz')).toBe(false);
    });
  });

  describe('searchMedicalConditions', () => {
    it('returns heart-related matches for hea', () => {
      const results = searchMedicalConditions('hea', {
        conditions: sampleConditions,
        recentSelections: [],
      });
      expect(results).toContain('Heart Attack');
      expect(results).toContain('Heart Failure');
      expect(results).toContain('Heart Disease');
      expect(results).toContain('Diarrhea');
    });

    it('returns diabetes and diarrhea for dia', () => {
      const results = searchMedicalConditions('dia', {
        conditions: sampleConditions,
        recentSelections: [],
      });
      expect(results).toEqual(['Diabetes', 'Diarrhea']);
    });

    it('ranks recently selected conditions first', () => {
      const results = searchMedicalConditions('hea', {
        conditions: sampleConditions,
        recentSelections: ['Heart Disease'],
      });
      expect(results[0]).toBe('Heart Disease');
    });

    it('ranks popular common conditions higher among ties', () => {
      const results = searchMedicalConditions('f', {
        conditions: sampleConditions,
        recentSelections: [],
      });
      expect(results[0]).toBe('Fever');
    });

    it('returns empty array for blank query', () => {
      expect(searchMedicalConditions('  ', { conditions: sampleConditions })).toEqual([]);
    });
  });
});
