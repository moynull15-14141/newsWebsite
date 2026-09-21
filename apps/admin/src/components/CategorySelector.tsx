import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../lib/api';

interface Category {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
}

interface CategorySelectorProps {
  value: string;
  onChange: (id: string) => void;
}

export default function CategorySelector({ value, onChange }: CategorySelectorProps) {
  const { data: categories } = useQuery<Category[]>({
    queryKey: ['categories'],
    queryFn: () => apiFetch('/categories'),
  });

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700">Category</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
      >
        <option value="">Select Category</option>
        {categories?.map((cat) => (
          <option key={cat.id} value={cat.id}>
            {cat.name}
          </option>
        ))}
      </select>
    </div>
  );
}
