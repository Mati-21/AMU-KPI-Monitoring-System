import React from 'react';
import { cn } from '../../lib/utils';
import Button from './Button';

const Table = React.forwardRef((props, ref) => {
  const { className, ...rest } = props;
  return (
    <table
      ref={ref}
      className={cn(
        'w-full caption-bottom text-sm   min-w-150 sm:min-w-175 md:min-w-225 shadow-border',
        'bg-bg-table  text-foreground ',
        className
      )}
      {...rest}
    />
  );
});

Table.displayName = 'Table';

const TableHeader = React.forwardRef((props, ref) => {
  const { className, ...rest } = props;
  return <thead ref={ref} className={cn('bg-primary/10 text-foreground', className)} {...rest} />;
});

TableHeader.displayName = 'TableHeader';

const TableBody = React.forwardRef((props, ref) => {
  const { className, ...rest } = props;
  return <tbody ref={ref} className={cn('', className)} {...rest} />;
});

TableBody.displayName = 'TableBody';

const TableFooter = React.forwardRef((props, ref) => {
  const { className, ...rest } = props;
  return (
    <tfoot
      ref={ref}
      className={cn(
        'border-t border-[theme(colors-border)] bg-[theme(colors-secondary)] text-[theme(colors-muted-foreground)] font-medium [&>tr]:last:border-b-0',
        className
      )}
      {...rest}
    />
  );
});

TableFooter.displayName = 'TableFooter';

const TableRow = React.forwardRef((props, ref) => {
  const { className, ...rest } = props;
  return (
    <tr
      ref={ref}
      className={cn(
        'border-b border-secondary   hover:bg-secondary ', // same bottom border for all rows
        className
      )}
      {...rest}
    />
  );
});

TableRow.displayName = 'TableRow';

const TableHead = React.forwardRef((props, ref) => {
  const { className, ...rest } = props;
  return (
    <th
      ref={ref}
      className={cn('h-12 px-4 b text-left align-middle font-semibold tracking-wider text-xs text-foreground bg-secondary', className)}
      {...rest}
    />
  );
});

TableHead.displayName = 'TableHead';

const TableCell = React.forwardRef((props, ref) => {
  const { className, ...rest } = props;
  return <td ref={ref} className={cn('px-4 py-2 align-middle text-[theme(colors-foreground)] [&:has([role=checkbox])]:pr-0', className)} {...rest} />;
});

TableCell.displayName = 'TableCell';

const TableCaption = React.forwardRef((props, ref) => {
  const { className, ...rest } = props;
  return <caption ref={ref} className={cn('mt-4 text-sm text-muted-foreground', className)} {...rest} />;
});

TableCaption.displayName = 'TableCaption';

const TablePagination = ({ currentPage, totalItems, itemsPerPage, onPageChange, className, ...props }) => {
  const totalPages = Math.ceil(totalItems / itemsPerPage);

  if (totalPages <= 1) return null;

  const getPageNumbers = () => {
    const pages = [];
    const maxVisiblePages = 5;

    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      if (currentPage <= 3) {
        pages.push(1, 2, 3, 4, '...', totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1, '...', totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
      } else {
        pages.push(1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages);
      }
    }

    return pages;
  };

  const handlePageChange = (page) => {
    if (page >= 1 && page <= totalPages && page !== currentPage) {
      onPageChange(page);
    }
  };

  return (
    <div className={cn('flex items-center justify-between px-2 py-4', className)} {...props}>
      <div className="flex-1 text-sm text-muted-foreground">
        Showing {Math.min((currentPage - 1) * itemsPerPage + 1, totalItems)} to {Math.min(currentPage * itemsPerPage, totalItems)} of {totalItems}{' '}
        entries
      </div>
      <div className="flex items-center space-x-2">
        <Button variant="outline" size="sm" onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1}>
          Previous
        </Button>

        <div className="flex items-center space-x-1">
          {getPageNumbers().map((page, index) => (
            <React.Fragment key={index}>
              {page === '...' ? (
                <span className="px-2 py-1 text-sm text-muted-foreground">...</span>
              ) : (
                <Button
                  variant={page === currentPage ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handlePageChange(page)}
                  className="min-w-[2.5rem]"
                >
                  {page}
                </Button>
              )}
            </React.Fragment>
          ))}
        </div>

        <Button variant="outline" size="sm" onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages}>
          Next
        </Button>
      </div>
    </div>
  );
};

TablePagination.displayName = 'TablePagination';

export { Table, TableHeader, TableBody, TableFooter, TableHead, TableRow, TableCell, TableCaption, TablePagination };
