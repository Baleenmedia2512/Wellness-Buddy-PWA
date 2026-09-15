/**
 * foodSuggestionRank.test.js
 */
import {
  filterSuggestionsAgainstSelected,
  filterRegularFoodSearchItems,
  isHerbalifeProductSuggestionName,
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

  test('isHerbalifeProductSuggestionName hides water and non-meal products from regular food', () => {
    expect(isHerbalifeProductSuggestionName('*Herbalifeline (Cardiovascular Health)')).toBe(true);
    expect(isHerbalifeProductSuggestionName('Herbal Multivitamin Tablet')).toBe(true);
    expect(isHerbalifeProductSuggestionName('Afresh')).toBe(true);
    expect(isHerbalifeProductSuggestionName('Fish Oil')).toBe(true);
    expect(isHerbalifeProductSuggestionName('Plain Water')).toBe(true);
    expect(isHerbalifeProductSuggestionName('Vritilife Triphala (Digestive Health)')).toBe(true);
    expect(isHerbalifeProductSuggestionName('*Vritilife Brain Health')).toBe(true);
    expect(isHerbalifeProductSuggestionName('HN - Skin Booster - Orange')).toBe(true);
    expect(isHerbalifeProductSuggestionName('Joint Support (Bone & Joint Health)')).toBe(true);
    expect(isHerbalifeProductSuggestionName('Dinoshake - Chocolicious')).toBe(true);
    expect(isHerbalifeProductSuggestionName('Dosa')).toBe(false);
    expect(isHerbalifeProductSuggestionName('Watermelon')).toBe(false);
    expect(isHerbalifeProductSuggestionName('Parotta')).toBe(false);
  });

  test('filterRegularFoodSearchItems removes water and supplements from Latest list', () => {
    const filtered = filterRegularFoodSearchItems([
      { name: '*Herbalifeline (Cardiovascular Health)' },
      { name: 'Herbal Multivitamin Tablet' },
      { name: 'Plain Water' },
      { name: 'Vritilife Triphala (Digestive Health)' },
      { name: 'HN - Skin Booster' },
      { name: 'Joint Support (Bone & Joint Health)' },
      { name: 'Dinoshake - Chocolicious' },
      { name: 'Mutton Biryani (Hyderabadi)' },
      { name: 'Dosa' },
    ]);
    expect(filtered.map((x) => x.name)).toEqual([
      'Mutton Biryani (Hyderabadi)',
      'Dosa',
    ]);
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
