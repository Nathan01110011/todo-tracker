/**
 * Categories for ordinary saved places. Hotels remain a dedicated collection,
 * while Landmarks and Museums use the existing Places sheet and all standard visit features.
 */
export const PLACE_CATEGORIES = [
  'Food', 'Drinks', 'Activities', 'Landmarks', 'Museums', 'Shopping', 'Sport', 'Events', 'Other'
] as const;

export const LOCATION_CATEGORIES = [
  'All', 'Food', 'Drinks', 'Activities', 'Landmarks', 'Shopping', 'Sport', 'Events', 'Hotels', 'Other'
] as const;
