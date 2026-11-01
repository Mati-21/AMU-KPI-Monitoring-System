import CustomSelect from '../../../../shared/components/ui/CustomSelect';
import SearchInput from '../../../../shared/components/ui/SearchInput';

function Toolbar({ options, selectedId, selectedName, onSelect, search, setSearch, loading }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="w-56">
          <CustomSelect compact options={options} value={selectedId} onChange={onSelect} placeholder={loading ? 'Loading roles...' : options.length ? 'Select Role' : 'No registered roles'} />
        </div>
        <div className="w-64">
          <SearchInput placeholder="Search permissions..." value={search} onChange={setSearch} />
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        Showing: <span className="font-semibold">{selectedName || 'None'}</span>
      </p>
    </div>
  );
}

export default Toolbar;
