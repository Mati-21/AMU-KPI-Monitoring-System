import { SlidersHorizontal } from 'lucide-react';
import CustomSelect from '../../../Components/UI/CustomSelect';
import SearchInput from '../../../Components/UI/SearchInput';
import Button from '../../../Components/UI/Button';

function Toolbar({ handleRoleChange, selectedRole, roles, search, setSearch, loadingRoles }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-Stretch gap-3 ">
        {/* Custom Select */}
        <div className="w-48 h-9">
          <CustomSelect
            options={roles}
            value={selectedRole}
            onChange={handleRoleChange}
            compact
            placeholder={loadingRoles ? 'Loading roles...' : roles.length ? 'Select Role' : 'No registered roles'}
          />
        </div>

        {/* Search */}

        <SearchInput placeholder="Search modules..." value={search} onChange={setSearch} className="pl-9 h-9 w-56 text-sm" />

        <Button variant="outline" size="sm" className="h-9 flex items-center gap-1">
          <SlidersHorizontal className="w-4 h-4" />
          Filters
        </Button>
      </div>

      <p className="text-sm text-muted-foreground">
        Showing: <span className="font-semibold">{selectedRole || 'None'}</span>
      </p>
    </div>
  );
}

export default Toolbar;
