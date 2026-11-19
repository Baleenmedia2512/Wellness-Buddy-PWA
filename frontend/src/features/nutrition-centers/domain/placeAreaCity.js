/**
 * Area and city from a Google address-component list.
 * Area prefers a neighbourhood. City prefers the locality.
 */

const AREA_TYPES = ['sublocality_level_1', 'sublocality', 'neighborhood', 'administrative_area_level_3'];
const CITY_TYPES = ['locality', 'postal_town', 'administrative_area_level_2'];

function pick(components, types) {
  for (const type of types) {
    const found = components.find((item) => Array.isArray(item?.types) && item.types.includes(type));
    const name = String(found?.long_name || '').trim();
    if (name) return name;
  }
  return '';
}

export function areaCityFromComponents(components) {
  const list = Array.isArray(components) ? components : [];
  return {
    area: pick(list, AREA_TYPES),
    city: pick(list, CITY_TYPES),
  };
}

export function formatAreaCity(area, city) {
  return [area, city].map((value) => String(value || '').trim()).filter(Boolean).join(', ');
}

export function cardAreaCity(center, resolved) {
  const extra = resolved?.[center?.id] || {};
  return formatAreaCity(center?.area || extra.area, center?.city || extra.city);
}
