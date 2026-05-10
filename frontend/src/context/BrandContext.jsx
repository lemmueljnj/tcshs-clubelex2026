import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api } from '@/lib/api';

const DEFAULTS = { name: 'CampusVote', logo_url: '' };
const BrandContext = createContext({ ...DEFAULTS, refresh: () => {}, setBrand: () => {} });

export function BrandProvider({ children }) {
  const [brand, setBrandState] = useState(DEFAULTS);

  const refresh = useCallback(async () => {
    try {
      const { data } = await api.get('/settings');
      setBrandState({ name: data.name || DEFAULTS.name, logo_url: data.logo_url || '' });
    } catch {
      setBrandState(DEFAULTS);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    if (brand?.name) document.title = brand.name;
  }, [brand?.name]);

  return (
    <BrandContext.Provider value={{ ...brand, refresh, setBrand: setBrandState }}>
      {children}
    </BrandContext.Provider>
  );
}

export const useBrand = () => useContext(BrandContext);
