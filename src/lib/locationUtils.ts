export function cleanCountryName(name?: string): string {
  if (!name) return '';
  return name
    .replace(/\s*\(the\)$/i, '')
    .replace(/^United States of America$/i, 'United States')
    .replace(/^United Kingdom of Great Britain and Northern Ireland$/i, 'United Kingdom')
    .trim();
}

/**
 * Strips 'taluk', 'taluka', 'tehsil', 'mandal', 'subdistrict' administrative suffixes
 * from geographic labels (city/village name, admin1, country) so clean names are displayed.
 */
export function cleanCityOrVillageName(name?: string): string {
  if (!name) return '';
  let cleaned = name.trim();
  if (!cleaned) return '';

  if (cleaned.includes(',')) {
    const parts = cleaned
      .split(',')
      .map((p) => p.replace(/\b(?:taluk|taluka|tehsil|mandal|sub-district|subdistrict)\b/gi, '').trim())
      .filter(Boolean);
    if (parts.length > 0) {
      cleaned = parts[0];
    }
  }

  cleaned = cleaned.replace(/\b(?:taluk|taluka|tehsil|mandal|sub-district|subdistrict)\b/gi, '').trim();
  cleaned = cleaned.replace(/^[,\-\s/]+|[,\-\s/]+$/g, '').replace(/\s{2,}/g, ' ').trim();

  return cleaned || name.trim();
}
