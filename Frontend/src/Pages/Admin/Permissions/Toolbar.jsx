import CustomSelect from '../../../Components/UI/CustomSelect';
import SearchInput from '../../../Components/UI/SearchInput';

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

        <div className="w-56 h-9">
          <SearchInput placeholder="Search modules..." value={search} onChange={setSearch} className="text-xs" />
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        Showing: <span className="font-semibold">{selectedRole || 'None'}</span>
      </p>
    </div>
  );
}

export default Toolbar;
