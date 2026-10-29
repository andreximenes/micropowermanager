import { MapPin } from 'lucide-react';

import { searchCities, type City } from '@/api/people';
import { SearchPicker } from '@/components/SearchPicker';

export type Village = {
  id: number;
  name: string;
  /** The site the village belongs to, when the picker chose it. */
  miniGridId?: number | null;
};

type VillagePickerProps = {
  value: Village | null;
  onChange: (village: Village | null) => void;
  /** Accessible name of the search box. */
  label: string;
  placeholder?: string;
  invalid?: boolean;
  className?: string;
};

function villageContext(city: City): string {
  return [city.mini_grid?.name, city.mini_grid?.cluster?.name].filter(Boolean).join(' · ');
}

const toVillage = (city: City): Village => ({
  id: city.id,
  name: city.name,
  miniGridId: city.mini_grid_id ?? null,
});

export function VillagePicker(props: VillagePickerProps) {
  return (
    <SearchPicker
      {...props}
      icon={MapPin}
      noun="villages"
      emptyText="No matching village."
      queryKey="cities"
      search={searchCities}
      toValue={toVillage}
      context={villageContext}
    />
  );
}
