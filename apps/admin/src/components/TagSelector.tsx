import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../lib/api';
import { X } from 'lucide-react';

interface Tag {
  id: string;
  name: string;
  slug: string;
}

interface TagSelectorProps {
  selectedTagIds: string[];
  onChange: (ids: string[]) => void;
}

export default function TagSelector({ selectedTagIds, onChange }: TagSelectorProps) {
  const { data: tags } = useQuery<Tag[]>({
    queryKey: ['tags'],
    queryFn: () => apiFetch('/tags'),
  });

  const selectedTags = tags?.filter((t) => selectedTagIds.includes(t.id)) || [];
  const availableTags = tags?.filter((t) => !selectedTagIds.includes(t.id)) || [];

  const addTag = (id: string) => {
    if (!selectedTagIds.includes(id)) {
      onChange([...selectedTagIds, id]);
    }
  };

  const removeTag = (id: string) => {
    onChange(selectedTagIds.filter((t) => t !== id));
  };

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700">Tags</label>
      {selectedTags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {selectedTags.map((tag) => (
            <span
              key={tag.id}
              className="inline-flex items-center gap-1 rounded-full bg-primary-100 px-3 py-1 text-sm text-primary-700"
            >
              {tag.name}
              <button type="button" onClick={() => removeTag(tag.id)} className="hover:text-primary-900">
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      <select
        onChange={(e) => {
          if (e.target.value) addTag(e.target.value);
          e.target.value = '';
        }}
        className="mt-2 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
      >
        <option value="">Add a tag...</option>
        {availableTags.map((tag) => (
          <option key={tag.id} value={tag.id}>
            {tag.name}
          </option>
        ))}
      </select>
    </div>
  );
}
