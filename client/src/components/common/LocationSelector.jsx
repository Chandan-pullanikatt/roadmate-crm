import React, { useState, useEffect, useMemo } from 'react';
import { Country, State, City } from 'country-state-city';

const LocationSelector = ({ 
  value = { country: '', state: '', district: '' }, 
  onChange, 
  errors = {}, 
  disabled = false, 
  required = false 
}) => {
  const [selectedCountryCode, setSelectedCountryCode] = useState('');
  const [selectedStateCode, setSelectedStateCode] = useState('');

  const countries = useMemo(() => {
    return Country.getAllCountries().sort((a, b) => a.name.localeCompare(b.name));
  }, []);

  const states = useMemo(() => {
    return selectedCountryCode ? State.getStatesOfCountry(selectedCountryCode) : [];
  }, [selectedCountryCode]);

  const districts = useMemo(() => {
    return (selectedCountryCode && selectedStateCode) 
      ? City.getCitiesOfState(selectedCountryCode, selectedStateCode) 
      : [];
  }, [selectedCountryCode, selectedStateCode]);

  // Handle pre-fill / edit mode
  useEffect(() => {
    if (value.country && !selectedCountryCode) {
      const country = countries.find(c => c.name === value.country);
      if (country) {
        setSelectedCountryCode(country.isoCode);
      }
    }
  }, [value.country, countries]);

  useEffect(() => {
    if (value.state && selectedCountryCode && !selectedStateCode) {
      const state = State.getStatesOfCountry(selectedCountryCode).find(s => s.name === value.state);
      if (state) {
        setSelectedStateCode(state.isoCode);
      }
    }
  }, [value.state, selectedCountryCode]);

  const handleCountryChange = (e) => {
    const code = e.target.value;
    const country = countries.find(c => c.isoCode === code);
    setSelectedCountryCode(code);
    setSelectedStateCode('');
    onChange({
      country: country ? country.name : '',
      state: '',
      district: ''
    });
  };

  const handleStateChange = (e) => {
    const code = e.target.value;
    const state = states.find(s => s.isoCode === code);
    setSelectedStateCode(code);
    onChange({
      ...value,
      state: state ? state.name : '',
      district: ''
    });
  };

  const handleDistrictChange = (e) => {
    const name = e.target.value;
    onChange({
      ...value,
      district: name
    });
  };

  const selectClassName = (error) => `
    w-full bg-surface2 border ${error ? 'border-red-500' : 'border-border'} 
    rounded-[10px] py-3 px-4 text-sm font-bold focus:bg-white focus:ring-4 
    ${error ? 'focus:ring-red-500/5 focus:border-red-500' : 'focus:ring-blue/5 focus:border-blue'} 
    outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed
  `;

  const labelClassName = "block text-xs font-bold text-text-muted uppercase tracking-wider mb-2";
  const errorClassName = "mt-1 text-[10px] font-bold text-red uppercase tracking-tight";

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {/* Country Selection */}
      <div className="space-y-1">
        <label className={labelClassName}>
          Country {required && <span className="text-red">*</span>}
        </label>
        <select
          value={selectedCountryCode}
          onChange={handleCountryChange}
          disabled={disabled}
          className={selectClassName(errors.country)}
        >
          <option value="">Select Country</option>
          {countries.map((c) => (
            <option key={c.isoCode} value={c.isoCode}>
              {c.name}
            </option>
          ))}
        </select>
        {errors.country && <p className={errorClassName}>{errors.country}</p>}
      </div>

      {/* State Selection */}
      <div className="space-y-1">
        <label className={labelClassName}>
          State {required && <span className="text-red">*</span>}
        </label>
        <select
          value={selectedStateCode}
          onChange={handleStateChange}
          disabled={disabled || !selectedCountryCode}
          className={selectClassName(errors.state)}
        >
          <option value="">Select State</option>
          {states.map((s) => (
            <option key={s.isoCode} value={s.isoCode}>
              {s.name}
            </option>
          ))}
        </select>
        {errors.state && <p className={errorClassName}>{errors.state}</p>}
      </div>

      {/* District Selection */}
      <div className="space-y-1">
        <label className={labelClassName}>
          District {required && <span className="text-red">*</span>}
        </label>
        <select
          value={value.district}
          onChange={handleDistrictChange}
          disabled={disabled || !selectedStateCode}
          className={selectClassName(errors.district)}
        >
          <option value="">Select District</option>
          {districts.map((d, index) => (
            <option key={`${d.name}-${index}`} value={d.name}>
              {d.name}
            </option>
          ))}
        </select>
        {errors.district && <p className={errorClassName}>{errors.district}</p>}
      </div>
    </div>
  );
};

export default LocationSelector;
