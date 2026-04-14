import { useState } from 'react';
import { Input } from '../../../Components/UI/Input';
import Button from '../../../Components/UI/Button';
import { api } from '../../../api/axios';

function AddCategory({ setActiveTab, onSaved }) {
  const [categoryForm, setCategoryForm] = useState({
    category: '',
    description: '',
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const handleCategorySave = async () => {
    setError('');

    if (!categoryForm.category.trim()) {
      setError('Category name is required.');
      return;
    }

    setSaving(true);

    try {
      await api.post('/role-categories', {
        CategoryName: categoryForm.category.trim(),
        Description: categoryForm.description?.trim() || null,
      });
    } catch (saveErr) {
      setError(saveErr?.response?.data?.message || 'Failed to save role category to database.');
      setSaving(false);
      return;
    }

    setSaving(false);

    setCategoryForm({ category: '', description: '' });
    onSaved?.();
    setActiveTab('list');
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
        <Button onClick={handleCategorySave} disabled={saving}>
          {saving ? 'Saving...' : 'Save'}
        </Button>
        <Button variant="outline" onClick={() => setActiveTab('list')}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

export default AddCategory;
