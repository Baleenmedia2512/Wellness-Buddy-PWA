import {
  formatOpeningHoursSummary,
  formatWorkingDaysLabel,
  parseLatLngFromMapsLink,
  resolveMapsUrls,
} from './reviewLocation';

describe('reviewLocation', () => {
  test('formats contiguous working days as a range', () => {
    expect(formatWorkingDaysLabel([
      'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
    ])).toBe('Mon - Sat');
  });

  test('formats opening hours summary', () => {
    expect(formatOpeningHoursSummary({
      workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
      openingTime: '09:00',
      closingTime: '19:00',
    })).toBe('Mon - Sat: 9:00 AM – 7:00 PM');
  });

  test('parses lat/lng from maps link', () => {
    expect(parseLatLngFromMapsLink('https://maps.google.com/?q=13.05,80.22')).toEqual({
      lat: 13.05,
      lng: 80.22,
    });
  });

  test('builds embed + open urls from coords', () => {
    const urls = resolveMapsUrls({
      mapsLink: 'https://maps.google.com/?q=13.05,80.22',
      centerName: 'Demo centre',
      locality: 'Kodambakkam',
      city: 'Chennai',
    });
    expect(urls.openUrl).toContain('13.05,80.22');
    expect(urls.embedUrl).toContain('output=embed');
    expect(urls.embedUrl).toContain('13.05,80.22');
  });
});
