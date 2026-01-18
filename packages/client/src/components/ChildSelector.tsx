import { ChevronDown, Plus } from 'lucide-react';
import { useState } from 'react';

interface Child {
  id: string;
  name: string;
}

interface ChildSelectorProps {
  selectedId: string | null;
  onSelect: (id: string) => void;
}

// TODO: Replace with actual data from API
const mockChildren: Child[] = [
  { id: '1', name: 'Oliver' },
];

export default function ChildSelector({ selectedId, onSelect }: ChildSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);

  const selectedChild = mockChildren.find((c) => c.id === selectedId) ?? mockChildren[0];

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors"
      >
        <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center">
          <span className="text-sm font-medium text-indigo-600">
            {selectedChild?.name.charAt(0) ?? '?'}
          </span>
        </div>
        <span className="font-medium">{selectedChild?.name ?? 'Select child'}</span>
        <ChevronDown className="w-4 h-4 text-gray-500" />
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-100 z-20">
            <div className="py-1">
              {mockChildren.map((child) => (
                <button
                  key={child.id}
                  onClick={() => {
                    onSelect(child.id);
                    setIsOpen(false);
                  }}
                  className={`
                    w-full px-4 py-2 text-left flex items-center gap-3
                    hover:bg-gray-50 transition-colors
                    ${selectedId === child.id ? 'bg-indigo-50' : ''}
                  `}
                >
                  <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center">
                    <span className="text-sm font-medium text-indigo-600">
                      {child.name.charAt(0)}
                    </span>
                  </div>
                  <span className="font-medium">{child.name}</span>
                </button>
              ))}
              <hr className="my-1" />
              <button
                onClick={() => {
                  // TODO: Navigate to add child page
                  setIsOpen(false);
                }}
                className="w-full px-4 py-2 text-left flex items-center gap-3 text-indigo-600 hover:bg-gray-50"
              >
                <div className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center">
                  <Plus className="w-4 h-4" />
                </div>
                <span className="font-medium">Add Child</span>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
