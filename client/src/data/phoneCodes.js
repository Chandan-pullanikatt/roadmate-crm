import { Country } from 'country-state-city';

// Countries listed first in the phone-code dropdown; the rest follow alphabetically.
const PINNED = ['IN', 'AE', 'US'];

// The library writes some codes with an area code attached ("+1-684",
// "+1-809 and 1-829"); keep only the country calling code — the area code is
// part of the number the user types.
const toDialCode = (phonecode) => `+${String(phonecode).replace(/^\+/, '').split(/[-\s]/)[0]}`;

const all = Country.getAllCountries().map((c) => ({
  iso: c.isoCode,
  name: c.name,
  dialCode: toDialCode(c.phonecode),
}));

export const PHONE_CODES = [
  ...PINNED.map((iso) => all.find((c) => c.iso === iso)),
  ...all.filter((c) => !PINNED.includes(c.iso)),
];

export const dialCodeFor = (iso) => PHONE_CODES.find((c) => c.iso === iso)?.dialCode || '+91';
