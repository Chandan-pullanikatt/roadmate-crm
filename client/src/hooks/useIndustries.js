import { useQuery } from '@tanstack/react-query';
import { configApi } from '../api/configApi';
import { DEFAULT_INDUSTRIES } from '../constants/industries';

/**
 * The founder-managed industry list used by every Industry dropdown.
 * Falls back to the defaults while loading or if the request fails.
 */
export const useIndustries = () => {
  const { data, isLoading } = useQuery({
    queryKey: ['config', 'industries'],
    queryFn: () => configApi.getConfig('industries').then(res => res.data?.value),
    staleTime: 5 * 60 * 1000
  });

  const industries = Array.isArray(data) && data.length ? data : DEFAULT_INDUSTRIES;
  return { industries, isLoading };
};

/**
 * Keeps a value that is no longer on the list selectable, so editing an older
 * account doesn't silently blank out its industry.
 */
export const industryOptions = (industries, currentValue) => {
  const value = String(currentValue ?? '').trim();
  if (!value) return industries;
  return industries.some(i => i.toLowerCase() === value.toLowerCase())
    ? industries
    : [...industries, value];
};

export default useIndustries;
