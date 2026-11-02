import { useRef, useState } from 'react';
import { Download, Upload } from 'lucide-react';

import { Badge } from '../../../shared/components/ui/Badge';
import Button from '../../../shared/components/ui/Button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TablePagination, TableRow } from '../../../shared/components/ui/Table';
import { apiErrorMessage } from '../../../shared/lib/apiError';
import { useNotification } from '../../09-notifications/context/NotificationContext';
import { useCheckKpiImport, useCurrencies, useFrequencies, useImportKpis, useScales, useThemeTree, useUnits } from '../hooks/useCatalog';
import { MAX_ROWS, downloadTemplate, readKpiFile, rowToKpi } from '../lib/kpiImport';
import { friendlyProblem } from '../lib/kpiRules';

const PAGE_SIZE = 10;

// Rows with problems come first, so they are what you see after choosing a file
const withProblemsFirst = (rows) => [...rows].sort((a, b) => Number(b.errors.length > 0) - Number(a.errors.length > 0) || a.rowNumber - b.rowNumber);

/**
 * Register many KPIs from an Excel file. Every row is checked before anything is saved, and only a file without
 * problems can be registered.
 */
function ImportKpi({ onDone }) {
  const { notify } = useNotification();
  const fileInput = useRef(null);
  const { data: themes = [] } = useThemeTree();
  const { data: frequencies = [] } = useFrequencies();
  const { data: units = [] } = useUnits();
  const { data: scales = [] } = useScales();
  const { data: currencies = [] } = useCurrencies();
  const catalog = { themes, frequencies, units, scales, currencies };
  const check = useCheckKpiImport();
  const save = useImportKpis();
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState([]);
  const [failure, setFailure] = useState('');
  const [page, setPage] = useState(1);
  const problemCount = rows.filter((row) => row.errors.length > 0).length;
  const shown = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const checkFile = async (file) => {
    setFileName(file.name);
    setFailure('');
    setRows([]);
    setPage(1);
    try {
      const read = (await readKpiFile(file)).map((row) => ({ ...row, ...rowToKpi(row.cells, catalog) }));
      // Rows the backend could not read yet are left out of its check. Their own problems come first.
      const understood = read.filter((row) => row.errors.length === 0);
      const { problems } = understood.length > 0 ? await check.mutateAsync(understood.map((row) => row.values)) : { problems: [] };
      problems.forEach(({ index, errors }) => understood[index].errors.push(...errors.map(friendlyProblem)));
      setRows(withProblemsFirst(read));
    } catch (error) {
      setFailure(error.response ? apiErrorMessage(error, 'Could not check this file.') : error.message);
    }
  };

  const chooseFile = (event) => {
    const [file] = event.target.files;
    event.target.value = '';
    if (file) checkFile(file);
  };

  const register = () =>
    save.mutate(
      rows.map((row) => row.values),
      {
        onSuccess: ({ total }) => {
          notify(`${total} KPI(s) registered.`, 'success');
          onDone();
        },
        onError: (error) => setFailure(apiErrorMessage(error, 'Could not register these KPIs.')),
      }
    );

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
        <div>
          <h2 className="text-base font-semibold text-foreground">Mass Register KPIs</h2>
          <p className="mt-1 text-xs text-muted-foreground">Download the template, fill in one KPI per row, and upload it. Up to {MAX_ROWS} KPIs per file. Nothing is saved until every row is correct.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" className="gap-2" onClick={() => downloadTemplate(catalog)}>
            <Download className="h-4 w-4" />
            Download Template
          </Button>
          <Button type="button" className="gap-2" disabled={check.isPending || save.isPending} onClick={() => fileInput.current.click()}>
            <Upload className="h-4 w-4" />
            {check.isPending ? 'Checking...' : 'Upload File'}
          </Button>
          <input ref={fileInput} type="file" aria-label="KPI file" accept=".xlsx,.xls,.csv" className="hidden" onChange={chooseFile} />
        </div>
      </div>

      {failure && <p className="p-4 text-sm text-red-500">{failure}</p>}

      {rows.length > 0 && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 p-4">
            <p className="text-sm text-foreground">
              <span className="font-medium">{fileName}:</span> {rows.length} KPI(s), {problemCount > 0 ? `${problemCount} with problems. Fix them in the file and upload it again.` : 'all ready to register.'}
            </p>
            <Button type="button" disabled={problemCount > 0 || save.isPending} onClick={register}>
              {save.isPending ? 'Registering...' : `Register ${rows.length} KPI(s)`}
            </Button>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Row</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Result</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shown.map((row) => (
                  <TableRow key={row.rowNumber}>
                    <TableCell>{row.rowNumber}</TableCell>
                    <TableCell className="font-medium text-foreground">{row.cells.Name || '-'}</TableCell>
                    <TableCell>{row.cells['Measurement Type'] || '-'}</TableCell>
                    <TableCell>
                      {row.errors.length === 0 ? (
                        <Badge variant="outline">Ready</Badge>
                      ) : (
                        <ul className="list-disc space-y-0.5 whitespace-normal pl-4 text-xs text-red-500">
                          {row.errors.map((error) => (
                            <li key={error}>{error}</li>
                          ))}
                        </ul>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <TablePagination currentPage={page} totalItems={rows.length} itemsPerPage={PAGE_SIZE} onPageChange={setPage} className="px-4" />
        </>
      )}
    </div>
  );
}

export default ImportKpi;
