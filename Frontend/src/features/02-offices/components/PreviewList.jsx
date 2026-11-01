import { Fragment, useState } from 'react';

import Button from '../../../shared/components/ui/Button';
import CustomSelect from '../../../shared/components/ui/CustomSelect';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../../../shared/components/ui/dialog';
import SearchInput from '../../../shared/components/ui/SearchInput';
import { TablePagination } from '../../../shared/components/ui/Table';

const PREVIEW_SIZE = 5;
const PAGE_SIZE = 10;

const ViewAllDialog = ({ title, items, renderRow, searchText, filter, onClose }) => {
  const [search, setSearch] = useState('');
  const [filterValue, setFilterValue] = useState('all');
  const [page, setPage] = useState(1);

  const changeSearch = (value) => {
    setSearch(value);
    setPage(1);
  };
  const changeFilter = (value) => {
    setFilterValue(value);
    setPage(1);
  };

  const text = search.trim().toLowerCase();
  const shown = items.filter((item) => (!text || searchText(item).toLowerCase().includes(text)) && (filterValue === 'all' || filter.matches(item, filterValue)));
  const lastPage = Math.max(1, Math.ceil(shown.length / PAGE_SIZE));
  const currentPage = Math.min(page, lastPage);

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto bg-card sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {title} ({items.length})
          </DialogTitle>
          <DialogDescription>All {title.toLowerCase()} of this office.</DialogDescription>
        </DialogHeader>
        {(searchText || filter) && (
          <div className="flex flex-wrap items-center gap-3">
            {searchText && (
              <div className="min-w-48 flex-1">
                <SearchInput value={search} onChange={changeSearch} placeholder={`Search ${title.toLowerCase()}...`} />
              </div>
            )}
            {filter && (
              <div className="w-48">
                <CustomSelect compact options={[{ value: 'all', label: filter.allLabel }, ...filter.options]} value={filterValue} onChange={changeFilter} />
              </div>
            )}
          </div>
        )}
        {/* Tall enough for the filter menu, so opening it does not scroll the dialog */}
        <div className="min-h-64 space-y-2">
          {shown.length === 0 && <p className="text-sm text-muted-foreground">Nothing found.</p>}
          {shown.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE).map((item) => (
            <Fragment key={item.id}>{renderRow(item)}</Fragment>
          ))}
        </div>
        <TablePagination currentPage={currentPage} totalItems={shown.length} itemsPerPage={PAGE_SIZE} onPageChange={setPage} className="px-0 py-0" />
      </DialogContent>
    </Dialog>
  );
};

/**
 * The first rows of a card, with the full list one click away so a busy office cannot stretch the page.
 */
const PreviewList = ({ title, items, renderRow, searchText, filter }) => {
  const [open, setOpen] = useState(false);

  return (
    <>
      {items.slice(0, PREVIEW_SIZE).map((item) => (
        <Fragment key={item.id}>{renderRow(item)}</Fragment>
      ))}
      {items.length > PREVIEW_SIZE && (
        <Button type="button" size="sm" variant="outline" className="w-full" onClick={() => setOpen(true)}>
          View all {items.length}
        </Button>
      )}
      {open && <ViewAllDialog title={title} items={items} renderRow={renderRow} searchText={searchText} filter={filter} onClose={() => setOpen(false)} />}
    </>
  );
};

export default PreviewList;
