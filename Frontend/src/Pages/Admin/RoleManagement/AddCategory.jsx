import { useState } from 'react';
import { useCreateRoleCategoryMutation } from '../../../Hooks/Queries/useRoles';
import { Input } from '../../../Components/UI/Input';
import Button from '../../../Components/UI/Button';

function AddCategory({ setActiveTab, onSaved }) {
  const [categoryForm, setCategoryForm] = useState({
    category: '',
    description: '',
  });
  // Mutations
  const createCategoryMutation = useCreateRoleCategoryMutation();
  const [error, setError] = useState('');

  const handleCategorySave = async () => {
    setError('');

    if (!categoryForm.category.trim()) {
      setError('Category name is required.');
      return;
    }

    createCategoryMutation.mutate({
      CategoryName: categoryForm.category.trim(),
      Description: categoryForm.description?.trim() || null,
    }, {
      onSuccess: () => {
        setCategoryForm({ category: '', description: '' });
        onSaved?.();
        setActiveTab('list');
      },
      onError: (err) => {
        setError(err?.response?.data?.message || 'Failed to save role category to database.');
      }
    });
  };

  return (
    <div className="rounded-2xl border border-border bg-muted/50 p-8 max-w-md space-y-5">
      <h2 className="text-lg font-semibold">Add Role Category</h2>

      {error ? <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

      <Input
        placeholder="Category"
        value={categoryForm.category}
        onChange={(e) =>
          setCategoryForm({
            ...categoryForm,
            category: e.target.value,
          })
        }
      />

      <Input
        placeholder="Enter Description"
        value={categoryForm.description}
        onChange={(e) =>
          setCategoryForm({
            ...categoryForm,
            description: e.target.value,
          })
        }
      />

      <div className="flex gap-3 pt-2">
        <Button onClick={handleCategorySave} disabled={createCategoryMutation.isPending}>
          {createCategoryMutation.isPending ? 'Saving...' : 'Save'}
        </Button>
        <Button variant="outline" onClick={() => setActiveTab('list')}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

export default AddCategory;
