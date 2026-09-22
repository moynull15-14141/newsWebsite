import { LocationType } from '@prisma/client';

/** Every administrative level the platform can represent. Bangladesh keeps its original four; the rest exist for global coverage. */
export const LOCATION_TYPES = [
  'CONTINENT',
  'COUNTRY',
  'STATE',
  'PROVINCE',
  'REGION',
  'DIVISION',
  'DISTRICT',
  'COUNTY',
  'CITY',
  'MUNICIPALITY',
  'UPAZILA',
  'SUBDISTRICT',
  'OTHER',
] as const satisfies readonly LocationType[];

export type LocationTypeValue = (typeof LOCATION_TYPES)[number];

/**
 * Which types a location of each type may be parented under. Bangladesh's own rule is unchanged
 * (DIVISION -> COUNTRY, DISTRICT -> DIVISION, UPAZILA -> DISTRICT, all required); other types are
 * intentionally permissive because real-world hierarchies vary by country (a CITY might sit directly
 * under a COUNTRY, a STATE, or a COUNTY). `null` in the required set means "top-level is allowed".
 */
export const PARENT_TYPE_RULES: Record<LocationTypeValue, { allowed: LocationTypeValue[]; required: boolean }> = {
  CONTINENT: { allowed: [], required: false },
  COUNTRY: { allowed: ['CONTINENT'], required: false },
  STATE: { allowed: ['COUNTRY'], required: false },
  PROVINCE: { allowed: ['COUNTRY'], required: false },
  REGION: { allowed: ['COUNTRY', 'CONTINENT'], required: false },
  DIVISION: { allowed: ['COUNTRY'], required: true },
  DISTRICT: { allowed: ['DIVISION', 'STATE', 'PROVINCE', 'REGION', 'COUNTY'], required: true },
  COUNTY: { allowed: ['STATE', 'PROVINCE', 'COUNTRY'], required: false },
  CITY: { allowed: ['COUNTRY', 'STATE', 'PROVINCE', 'REGION', 'COUNTY', 'DIVISION', 'DISTRICT'], required: false },
  MUNICIPALITY: { allowed: ['DISTRICT', 'COUNTY', 'STATE', 'PROVINCE', 'CITY'], required: false },
  UPAZILA: { allowed: ['DISTRICT'], required: true },
  SUBDISTRICT: { allowed: ['DISTRICT', 'COUNTY', 'CITY'], required: false },
  OTHER: { allowed: LOCATION_TYPES.filter((t) => t !== 'OTHER') as LocationTypeValue[], required: false },
};
