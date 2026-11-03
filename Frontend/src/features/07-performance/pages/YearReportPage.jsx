import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../shared/components/ui/Table';
import { apiErrorMessage } from '../../../shared/lib/apiError';
import ThemeRows from '../components/ThemeRows';
import YearOfficePicker from '../components/YearOfficePicker';
import { useYearReport } from '../hooks/useReports';
import { useYearOffice } from '../hooks/useYearOffice';
import { resultText as withUnitText } from '../lib/reportRules';

// The Unit column says the unit, so the numbers leave it out
const resultText = (kpi, row) => withUnitText(kpi, row, false);
import { unitText } from '../lib/sheetRules';

const FIXED_COLUMNS = ['KPI Name', 'Unit', 'Weight', 'Baseline', 'Target'];
const Message = ({ children }) => <p className="rounded-lg border border-border bg-card p-4 text-sm text-foreground">{children}</p>;

/**
 * An office's results for the year so far, read only. Approved results only: a column per office below that holds a
 * KPI, and the office's own work. Each KPI adds up its periods its own way: counts are summed, rates recalculated.
 */
const YearReportPage = () => {
  const { years, year, offices, office, choose, isLoading } = useYearOffice();
  const { data: report, isLoading: reportLoading, error } = useYearReport(year?.id, office?.id);
  const columns = report?.columns ?? [];
  const showTotal = Boolean(report?.showTotal);
  const columnCount = FIXED_COLUMNS.length + columns.length + (showTotal ? 1 : 0) + 1;

  const cell = (row, result, hasKpi) => (hasKpi ? <span className="text-foreground">{result ? resultText(row.kpi, result) : '-'}</span> : <span className="text-muted-foreground">-</span>);

  const renderRow = (row) => (
    <TableRow key={row.assignmentId}>
      <TableCell className="min-w-[12rem] max-w-[18rem] font-medium text-foreground">{row.kpi.name}</TableCell>
      <TableCell>{unitText(row.kpi)}</TableCell>
      <TableCell>{row.weight ?? '-'}</TableCell>
      <TableCell>{resultText(row.kpi, row.baseline)}</TableCell>
      <TableCell>{resultText(row.kpi, row.target)}</TableCell>
      {columns.map((column) => (
        <TableCell key={column.key}>{cell(row, row.cells[column.key], column.key in row.cells)}</TableCell>
      ))}
      {showTotal && <TableCell className="font-semibold">{cell(row, row.total, true)}</TableCell>}
      <TableCell className="text-xs text-foreground">{row.remark ?? '-'}</TableCell>
    </TableRow>
  );

  return (
    <div className="flex min-h-full bg-background">
      <main className="flex min-w-0 flex-1 flex-col space-y-5 p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Report</h1>
            <p className="text-sm text-muted-foreground">Approved results so far this year, added up from every reporting period.</p>
          </div>
          <YearOfficePicker years={years} year={year} offices={offices} office={office} onChange={choose} />
        </div>

        {!isLoading && !year && <Message>There are no fiscal years yet.</Message>}
        {!isLoading && year && offices.length === 0 && <Message>No signed contract to report on in {year.name} yet.</Message>}
        {error && <p className="text-sm text-red-500">{apiErrorMessage(error, 'Could not load the report.')}</p>}
        {reportLoading && office && <p className="text-sm text-foreground">Loading...</p>}

        {report?.contract && (
          <div className="rounded-lg border border-border bg-card">
            <div className="border-b border-border p-4">
              <h2 className="text-base font-semibold text-foreground">{report.contract.office.name}</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                {report.contract.fiscalYear.name}
                {report.contract.assigningOffice ? `, reporting to ${report.contract.assigningOffice.name}` : ''}. Results count once the office above approves them.
              </p>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {FIXED_COLUMNS.map((label) => (
                      <TableHead key={label}>{label}</TableHead>
                    ))}
                    {columns.map((column) => (
                      <TableHead key={column.key} className="min-w-[7rem]">
                        {column.label}
                      </TableHead>
                    ))}
                    {showTotal && <TableHead>Total</TableHead>}
                    <TableHead>Remark</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.rows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={columnCount}>This contract has no accepted KPIs yet.</TableCell>
                    </TableRow>
                  )}
                  <ThemeRows rows={report.rows} columns={columnCount} weightColumn={2} renderRow={renderRow} />
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default YearReportPage;
