import { useState } from 'react';

import { Input } from '../../../Components/UI/Input';
import Button from '../../../Components/UI/Button';
import { api } from '../../../api/axios';
import { useNotification } from '../../../Context/NotificationContext';

function RegisterUnit({ setActiveTab, onSaved }) {
  const [unitForm, setUnitForm] = useState({
    name: '',
    code: '',
    description: '',
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const { notify } = useNotification();

  const handleSave = async () => {
    setError('');

    if (!unitForm.name.trim() || !unitForm.code.trim()) {
      setError('Unit name and code are required.');
      return;
    }

    setSaving(true);

    try {
      await api.post('/units', {
        Name: unitForm.name.trim(),
        Code: unitForm.code.trim(),
        Description: unitForm.description?.trim() || null,
      });

      notify(`Unit "${unitForm.name}" saved successfully.`, 'success');
      onSaved?.();
      setUnitForm({ name: '', code: '', description: '' });
      setActiveTab('list');
    } catch (saveErr) {
      const message = saveErr?.response?.data?.message || 'Failed to save unit.';
      setError(message);
      notify(message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="space-y-6">
      <div className="bg-card border border-border rounded-xl p-8 max-w-lg">
        <h2 className="text-xl font-semibold text-foreground mb-6">Add Unit</h2>

        {error ? <p className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

        <div className="space-y-4">
          <Input
            placeholder="Unit Name"
            value={unitForm.name}
            onChange={(e) => setUnitForm({ ...unitForm, name: e.target.value })}
            className="h-11"
          />

          <Input
            placeholder="Unit Code (%, #, M ETB)"
            value={unitForm.code}
            onChange={(e) => setUnitForm({ ...unitForm, code: e.target.value })}
            className="h-11"
          />

          <Input
            placeholder="Enter Description"
            value={unitForm.description}
            onChange={(e) => setUnitForm({ ...unitForm, description: e.target.value })}
            className="h-11"
          />

          <div className="flex gap-3 pt-2">
            <Button onClick={handleSave} disabled={saving} className="bg-primary hover:bg-primary/90">
              {saving ? 'Saving...' : 'Save'}
            </Button>

            <Button
              variant="outline"
              onClick={() => setActiveTab('list')}
              className="bg-destructive/10 text-destructive border-destructive/20 hover:bg-destructive/20"
            >
              Cancel
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

export default RegisterUnit;
