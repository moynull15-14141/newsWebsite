import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../lib/api';

interface Location {
  id: string;
  name: string;
  slug: string;
  type: string;
  parentId: string | null;
}

interface LocationSelectorProps {
  divisionId: string;
  districtId: string;
  onDivisionChange: (id: string) => void;
  onDistrictChange: (id: string) => void;
}

export default function LocationSelector({
  divisionId,
  districtId,
  onDivisionChange,
  onDistrictChange,
}: LocationSelectorProps) {
  const { data: divisions } = useQuery<Location[]>({
    queryKey: ['locations', 'divisions'],
    queryFn: () => apiFetch('/locations?type=DIVISION'),
  });

  const { data: districts } = useQuery<Location[]>({
    queryKey: ['locations', 'districts', divisionId],
    queryFn: () => apiFetch(`/locations?type=DISTRICT&parentId=${divisionId}`),
    enabled: !!divisionId,
  });

  return (
    <div className="grid grid-cols-2 gap-4">
      <div>
        <label className="block text-sm font-medium text-gray-700">Division</label>
        <select
          value={divisionId}
          onChange={(e) => {
            onDivisionChange(e.target.value);
            onDistrictChange('');
          }}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
        >
          <option value="">Select Division</option>
          {divisions?.map((div) => (
            <option key={div.id} value={div.id}>
              {div.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">District</label>
        <select
          value={districtId}
          onChange={(e) => onDistrictChange(e.target.value)}
          disabled={!divisionId}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 disabled:opacity-50"
        >
          <option value="">Select District</option>
          {districts?.map((dist) => (
            <option key={dist.id} value={dist.id}>
              {dist.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
