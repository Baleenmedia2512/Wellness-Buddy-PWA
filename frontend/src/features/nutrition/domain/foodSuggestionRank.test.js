/**
 * foodSuggestionRank.test.js
 */
import {
  filterSuggestionsAgainstSelected,
  suggestionSectionTitle,
  drySaladUsualComboTitle,
  drySaladOftenTitle,
} from './foodSuggestionRank';

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

  test('dry salad slot titles', () => {
    expect(drySaladUsualComboTitle('morning')).toBe('Your usual morning combo');
    expect(drySaladUsualComboTitle('afternoon')).toBe('Your usual afternoon combo');
    expect(drySaladUsualComboTitle(null)).toBe('Your usual combo');
    expect(drySaladOftenTitle('evening')).toBe('Often at this evening');
    expect(drySaladOftenTitle(null)).toBe('Often at this time');
  });
});
