/**
 * foodSuggestionRank.test.js
 */
import { filterSuggestionsAgainstSelected, suggestionSectionTitle } from './foodSuggestionRank';

describe('foodSuggestionRank', () => {
  test('filters out already selected names case-insensitively', () => {
    const out = filterSuggestionsAgainstSelected(
      [{ name: 'Chutney' }, { name: 'Omelette' }, { name: 'Dosa' }],
      [{ name: 'dosa' }],
    );
    expect(out.map((x) => x.name)).toEqual(['Chutney', 'Omelette']);
  });

  test('section titles', () => {
    expect(suggestionSectionTitle(false)).toBe('Latest');
    expect(suggestionSectionTitle(true)).toBe('Often added with');
  });
});
