import React, { useState, useEffect, useMemo } from 'react';
import { Country, State, City } from 'country-state-city';

// Fix: Region Type Filtering — RegionType (Panchayat/Municipality/Corporation) now gates the Region field
const LocationSelector = ({
  value = { country: '', state: '', district: '', regionType: '', region: '' },
  onChange,
  errors = {},
  disabled = false,
  required = false
}) => {
  const [selectedCountryCode, setSelectedCountryCode] = useState('');
  const [selectedStateCode, setSelectedStateCode] = useState('');

  const countries = useMemo(() => Country.getAllCountries().sort((a, b) => a.name.localeCompare(b.name)), []);

  const states = useMemo(() => (
    selectedCountryCode ? State.getStatesOfCountry(selectedCountryCode) : []
  ), [selectedCountryCode]);

  const districts = useMemo(() => (
    (selectedCountryCode && selectedStateCode)
      ? City.getCitiesOfState(selectedCountryCode, selectedStateCode)
      : []
  ), [selectedCountryCode, selectedStateCode]);

  // Pre-fill country code from value
  useEffect(() => {
    if (value.country && !selectedCountryCode) {
      const country = countries.find(c => c.name === value.country);
      if (country) setSelectedCountryCode(country.isoCode);
    }
  }, [value.country, countries]);

  // Pre-fill state code from value
  useEffect(() => {
    if (value.state && selectedCountryCode && !selectedStateCode) {
      const state = State.getStatesOfCountry(selectedCountryCode).find(s => s.name === value.state);
      if (state) setSelectedStateCode(state.isoCode);
    }
  }, [value.state, selectedCountryCode]);

  const handleCountryChange = (e) => {
    const code = e.target.value;
    const country = countries.find(c => c.isoCode === code);
    setSelectedCountryCode(code);
    setSelectedStateCode('');
    onChange({ country: country ? country.name : '', state: '', district: '', regionType: '', region: '' });
  };

  const handleStateChange = (e) => {
    const code = e.target.value;
    const state = states.find(s => s.isoCode === code);
    setSelectedStateCode(code);
    onChange({ ...value, state: state ? state.name : '', district: '', regionType: '', region: '' });
  };

  const handleDistrictChange = (e) => {
    // When district changes, reset regionType and region
    onChange({ ...value, district: e.target.value, regionType: '', region: '' });
  };

  const handleRegionTypeChange = (e) => {
    // Fix: Region Type — reset region when type changes
    onChange({ ...value, regionType: e.target.value, region: '' });
  };

  const handleRegionChange = (e) => {
    onChange({ ...value, region: e.target.value });
  };

  const selectClass = (error) => `
    w-full bg-surface2 border ${error ? 'border-red-500' : 'border-border'}
    rounded-[10px] py-3 px-4 text-sm font-bold focus:bg-white focus:ring-4
    ${error ? 'focus:ring-red-500/5 focus:border-red-500' : 'focus:ring-blue/5 focus:border-blue'}
    outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed
  `;
  const labelClass = 'block text-xs font-bold text-text-muted uppercase tracking-wider mb-2';
  const errorClass = 'mt-1 text-[10px] font-bold text-red uppercase tracking-tight';

  const regionTypes = ['Panchayat', 'Municipality', 'Corporation'];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Country */}
        <div className="space-y-1">
          <label className={labelClass}>Country {required && <span className="text-red">*</span>}</label>
          <select value={selectedCountryCode} onChange={handleCountryChange} disabled={disabled} className={selectClass(errors.country)}>
            <option value="">Select Country</option>
            {countries.map(c => <option key={c.isoCode} value={c.isoCode}>{c.name}</option>)}
          </select>
          {errors.country && <p className={errorClass}>{errors.country}</p>}
        </div>

        {/* State */}
        <div className="space-y-1">
          <label className={labelClass}>State {required && <span className="text-red">*</span>}</label>
          <select value={selectedStateCode} onChange={handleStateChange} disabled={disabled || !selectedCountryCode} className={selectClass(errors.state)}>
            <option value="">Select State</option>
            {states.map(s => <option key={s.isoCode} value={s.isoCode}>{s.name}</option>)}
          </select>
          {errors.state && <p className={errorClass}>{errors.state}</p>}
        </div>

        {/* District */}
        <div className="space-y-1">
          <label className={labelClass}>District {required && <span className="text-red">*</span>}</label>
          <select value={value.district} onChange={handleDistrictChange} disabled={disabled || !selectedStateCode} className={selectClass(errors.district)}>
            <option value="">Select District</option>
            {districts.map((d, i) => <option key={`${d.name}-${i}`} value={d.name}>{d.name}</option>)}
          </select>
          {errors.district && <p className={errorClass}>{errors.district}</p>}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Region Type — Fix: required before Region can be set */}
        <div className="space-y-1">
          <label className={labelClass}>Region Type</label>
          <select
            value={value.regionType || ''}
            onChange={handleRegionTypeChange}
            disabled={disabled || !value.district}
            className={selectClass(errors.regionType)}
          >
            <option value="">{value.district ? 'Select Region Type' : 'Select District first'}</option>
            {regionTypes.map(rt => <option key={rt} value={rt}>{rt}</option>)}
          </select>
          {errors.regionType && <p className={errorClass}>{errors.regionType}</p>}
        </div>

        {/* Region — Fix: only enabled after District AND RegionType are both selected */}
        <div className="space-y-1">
          <label className={labelClass}>
            Region
            {value.regionType && (
              <span className="ml-1 text-[9px] normal-case font-normal text-text-muted">
                ({value.regionType})
              </span>
            )}
          </label>
          <input
            type="text"
            value={value.region || ''}
            onChange={handleRegionChange}
            disabled={disabled || !value.district || !value.regionType}
            placeholder={
              !value.district
                ? 'Select District first'
                : !value.regionType
                  ? 'Select Region Type first'
                  : `Enter ${value.regionType} name`
            }
            className={selectClass(errors.region).replace('py-3', 'py-[11px]')}
          />
          {errors.region && <p className={errorClass}>{errors.region}</p>}
        </div>
      </div>
    </div>
  );
};

export default LocationSelector;
