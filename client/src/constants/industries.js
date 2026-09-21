/**
 * Fallback industry list — mirrors server/src/constants/industries.js.
 * The live list comes from the `industries` config key, which the founder edits
 * in the Manage Industries modal; this is what dropdowns show until it loads.
 */
export const DEFAULT_INDUSTRIES = [
  'Grocery',
  'Restaurant',
  'Automobile',
  'Sports',
  'Textiles',
  'Others'
];

export default DEFAULT_INDUSTRIES;
