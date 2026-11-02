import { useRef, useState } from 'react';
import { ArrowLeft, Download, Upload } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import Button from '../../../shared/components/ui/Button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../shared/components/ui/Table';
import { apiErrorMessage } from '../../../shared/lib/apiError';
import { useCurrencies, useFrequencies, useScales, useThemeTree, useUnits } from '../../04-kpi-catalog/hooks/useCatalog';
import { CONTRACT_REQUIRED_HEADERS, MAX_ROWS, downloadTemplate, readKpiFile, rowToContractRow } from '../../04-kpi-catalog/lib/kpiImport';
import { friendlyProblem } from '../../04-kpi-catalog/lib/kpiRules';
import { useNotification } from '../../09-notifications/context/NotificationContext';
import { useCheckContractImport, useContract, useContractImport } from '../hooks/useContracts';

const STATUS = {
  NEW: { label: 'New KPI', className: 'bg-green-100 text-green-900 dark:bg-green-950/50 dark:text-green-200' },
  EXISTING: { label: 'Already registered', className: 'bg-blue-100 text-blue-900 dark:bg-blue-950/50 dark:text-blue-200' },
  POSSIBLE_DUPLICATE: { label: 'Possible duplicate', className: 'bg-yellow-100 text-yellow-900 dark:bg-yellow-950/50 dark:text-yellow-200' },
  ERROR: { label: 'Needs fixing', className: 'bg-red-100 text-red-900 dark:bg-red-950/50 dark:text-red-200' },
};

const payloadOf = (rows, decisions) => rows.map((row, index) => ({ kpi: row.kpi, kpiErrors: row.kpiErrors, baseline: row.baseline, target: row.target, weight: row.weight, decision: decisions[index] }));

/**
 * Register KPIs from a file straight into the top office's self contract. Each row becomes a KPI in KPI Management,
 * or reuses one already there, and goes onto the contract with its baseline, target and weight.
 */
const ContractKpiImportPage = () => {
  const { contractId } = useParams();
  const navigate = useNavigate();
  const { notify } = useNotification();
  const fileInput = useRef(null);
  const { data: contract, error: contractError } = useContract(contractId);
  const { data: themes = [] } = useThemeTree();
  const { data: frequencies = [] } = useFrequencies();
  const { data: units = [] } = useUnits();
  const { data: scales = [] } = useScales();
  const { data: currencies = [] } = useCurrencies();
  const catalog = { themes, frequencies, units, scales, currencies };
  const check = useCheckContractImport();
  const save = useContractImport();
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState([]);
  const [decisions, setDecisions] = useState({});
  const [result, setResult] = useState(null);
  const [failure, setFailure] = useState('');

  const runCheck = async (nextRows, nextDecisions) => {
    setFailure('');
    try {
      setResult(await check.mutateAsync({ id: contractId, rows: payloadOf(nextRows, nextDecisions) }));
    } catch (error) {
      setResult(null);
      setFailure(apiErrorMessage(error, 'Could not check this file.'));
    }
  };

  const chooseFile = async (event) => {
    const [file] = event.target.files;
    event.target.value = '';
    if (!file) return;
    setFileName(file.name);
    setRows([]);
    setResult(null);
    setDecisions({});
    try {
      const read = (await readKpiFile(file, CONTRACT_REQUIRED_HEADERS)).map((row) => ({ ...row, ...rowToContractRow(row.cells, catalog) }));
      setRows(read);
      await runCheck(read, {});
    } catch (error) {
      setFailure(error.message);
    }
  };

  const decide = (index, value) => {
    const next = { ...decisions, [index]: value };
    setDecisions(next);
    runCheck(rows, next);
  };

  const register = () =>
    save.mutate(
      { id: contractId, rows: payloadOf(rows, decisions) },
      {
        onSuccess: ({ summary }) => {
          notify(`${summary.total} KPI(s) added to the contract, ${summary.newKpis} of them newly registered.`, 'success');
          navigate(`/assign-kpi/${contractId}`);
        },
        onError: (error) => setFailure(apiErrorMessage(error, 'Could not save these KPIs.')),
      }
    );

  const lines = result?.rows.map((line) => ({ ...line, rowNumber: rows[line.index]?.rowNumber, errors: [...(rows[line.index]?.errors ?? []), ...line.errors] })) ?? [];
  const blocked = lines.filter((line) => line.errors.length > 0 || line.status === 'POSSIBLE_DUPLICATE').length;
  const summary = result?.summary;
  const unavailable = contract && (contract.assigningOfficeId || contract.status !== 'DRAFT');

  return (
    <div className="flex min-h-full bg-background">
      <main className="flex min-w-0 flex-1 flex-col space-y-5 p-6">
        <div>
          <Link to={`/assign-kpi/${contractId}`} className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
            Back to the Contract
          </Link>
          <h1 className="text-2xl font-bold text-foreground">Register New KPIs</h1>
          <p className="text-sm text-muted-foreground">{contract ? `Into ${contract.office.name}'s self contract for ${contract.fiscalYear.name}.` : 'Loading the contract...'}</p>
        </div>

        {contractError && <p className="text-sm text-red-500">{apiErrorMessage(contractError, 'Could not load this contract.')}</p>}
        {unavailable && <p className="rounded-lg border border-border bg-card p-4 text-sm text-foreground">New KPIs can be registered only into the top office&apos;s self contract while it is a draft.</p>}

        {contract && !unavailable && (
          <div className="rounded-lg border border-border bg-card">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
              <div className="max-w-3xl">
                <h2 className="text-base font-semibold text-foreground">One Row per KPI</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Each row is saved in KPI Management and added to this contract with its baseline, target and weight. A KPI already in KPI Management is found by its name and reused, so it is never registered twice. Up to {MAX_ROWS} rows. Nothing is saved until every row is ready.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" className="gap-2" onClick={() => downloadTemplate(catalog, { forContract: true })}>
                  <Download className="h-4 w-4" />
                  Download Template
                </Button>
                <Button type="button" className="gap-2" disabled={check.isPending || save.isPending} onClick={() => fileInput.current.click()}>
                  <Upload className="h-4 w-4" />
                  {check.isPending ? 'Checking...' : 'Upload File'}
                </Button>
                <input ref={fileInput} type="file" aria-label="Contract KPI file" accept=".xlsx,.xls,.csv" className="hidden" onChange={chooseFile} />
              </div>
            </div>

            {failure && <p className="p-4 text-sm text-red-500">{failure}</p>}

            {summary && (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div className="space-y-1 text-sm text-foreground">
                    <p>
                      <span className="font-medium">{fileName}:</span> {summary.total} row(s): {summary.newKpis} new, {summary.existingKpis} already registered, {summary.possibleDuplicates} possible duplicate(s), {lines.filter((line) => line.errors.length > 0).length} to fix.
                    </p>
                    <p className={summary.weightAfter === summary.requiredTotalWeight ? 'text-green-700 dark:text-green-400' : 'text-amber-700 dark:text-amber-400'}>
                      Weights after adding: {summary.weightAfter} of {summary.requiredTotalWeight}.{summary.weightAfter !== summary.requiredTotalWeight && ' The contract can be signed only once they reach it.'}
                    </p>
                  </div>
                  <Button type="button" disabled={blocked > 0 || save.isPending || check.isPending} onClick={register}>
                    {save.isPending ? 'Saving...' : `Add ${summary.total} KPI(s) to the Contract`}
                  </Button>
                </div>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Row</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Result</TableHead>
                        <TableHead>Details</TableHead>
                        <TableHead>Weight</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {lines.map((line) => {
                        const status = line.errors.length > 0 ? STATUS.ERROR : STATUS[line.status];
                        return (
                          <TableRow key={line.index}>
                            <TableCell>{line.rowNumber}</TableCell>
                            <TableCell className="whitespace-normal font-medium text-foreground">{line.name || '-'}</TableCell>
                            <TableCell>
                              <span className={`whitespace-nowrap rounded-md px-2 py-1 text-xs font-medium ${status.className}`}>{status.label}</span>
                            </TableCell>
                            <TableCell className="whitespace-normal text-xs">
                              {line.status === 'EXISTING' && <p className="text-foreground">Uses {line.kpi.name}, already in KPI Management.</p>}
                              {line.status === 'POSSIBLE_DUPLICATE' && (
                                <fieldset className="space-y-1">
                                  <legend className="mb-1 text-foreground">Is this a KPI you already have?</legend>
                                  {line.candidates.map((candidate) => (
                                    <label key={candidate.id} className="flex items-center gap-2 text-foreground">
                                      <input type="radio" name={`decision-${line.index}`} checked={decisions[line.index] === candidate.id} onChange={() => decide(line.index, candidate.id)} />
                                      Yes, use {candidate.name}
                                    </label>
                                  ))}
                                  <label className="flex items-center gap-2 text-foreground">
                                    <input type="radio" name={`decision-${line.index}`} checked={decisions[line.index] === 'new'} onChange={() => decide(line.index, 'new')} />
                                    No, register it as a new KPI
                                  </label>
                                </fieldset>
                              )}
                              {line.status !== 'POSSIBLE_DUPLICATE' && decisions[line.index] && <p className="mt-1 text-muted-foreground">Chosen by you. <button type="button" className="underline" onClick={() => decide(line.index, undefined)}>Change</button></p>}
                              {line.warnings.map((warning) => (
                                <p key={warning} className="text-amber-700 dark:text-amber-400">{warning}</p>
                              ))}
                              {line.errors.length > 0 && (
                                <ul className="list-disc space-y-0.5 pl-4 text-red-500">
                                  {line.errors.map((error) => (
                                    <li key={error}>{friendlyProblem(error)}</li>
                                  ))}
                                </ul>
                              )}
                            </TableCell>
                            <TableCell>{rows[line.index]?.weight ?? '-'}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default ContractKpiImportPage;
