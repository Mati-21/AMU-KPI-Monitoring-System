import { useState, useRef } from 'react';
import { Upload, Download, AlertCircle, CheckCircle2, FileSpreadsheet, Trash2, ArrowRight } from 'lucide-react';
import Button from '../../../Components/UI/Button';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TablePagination } from '../../../Components/UI/Table';
import { api } from '../../../api/axios';
import * as XLSX from 'xlsx';
import { useNotification } from '../../../Context/NotificationContext';


const TEMPLATE_HEADERS = [
  'KPI Name',
  'Theme',
  'Sub-Theme',
  'Unit',
  'Weight',
  'Baseline',
  'Target',
  'Cycle Year',
  'Evidence Required',
  'Description',
  'Remark'
];
  

const parseCSV = (text) => {
  const lines = [];
  let row = [""];
  let insideQuote = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (insideQuote && nextChar === '"') {
        row[row.length - 1] += '"';
        i++; // skip next quote
      } else {
        insideQuote = !insideQuote;
      }
    } else if (char === ',') {
      if (insideQuote) {
        row[row.length - 1] += char;
      } else {
        row.push("");
      }
    } else if (char === '\r' || char === '\n') {
      if (insideQuote) {
        row[row.length - 1] += char;
      } else {
        if (char === '\r' && nextChar === '\n') {
          i++; // skip \n
        }
        lines.push(row);
        row = [""];
      }
    } else {
      row[row.length - 1] += char;
    }
  }

  if (row.length > 1 || row[0] !== "") {
    lines.push(row);
  }

  return lines;
};

function ImportKpi({ setActiveTab, onSaved }) {
  const [dragActive, setDragActive] = useState(false);
  const [parsedData, setParsedData] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [importing, setImporting] = useState(false);
  const [fileName, setFileName] = useState('');
  const fileInputRef = useRef(null);
  const { notify } = useNotification();
  const itemsPerPage = 8;

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const processRows = (rows) => {
    if (!rows || rows.length < 2) {
      notify('The uploaded file appears to be empty or lacks a header row.', 'warning');
      return;
    }
    const kpisList = [];
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (row.length === 1 && row[0] === '') continue;
      const item = {};
      TEMPLATE_HEADERS.forEach((header, index) => {
        item[header] = row[index] !== undefined ? row[index].toString().trim() : '';
      });

      const errors = [];
      const name = item['KPI Name'];
      const theme = item['Theme'];
      const subTheme = item['Sub-Theme'];
      const unit = item['Unit'];
      const weightRaw = item['Weight'];
      const targetRaw = item['Target'];
      const baselineRaw = item['Baseline'] || '0';
      const evidence = item['Evidence Required'] || 'No';
      const cycleYearRaw = item['Cycle Year'];

      if (!name) errors.push('KPI Name is required');
      if (!theme) errors.push('Theme is required');
      if (!subTheme) errors.push('Sub-Theme is required');
      if (!unit) errors.push('Unit is required');
      if (!cycleYearRaw) errors.push('Cycle Year is required');

      const weight = Number(weightRaw);
      if (isNaN(weight) || weightRaw === '') errors.push('Weight must be a number');
      else if (weight < 0 || weight > 100) errors.push('Weight must be between 0 and 100');

      const target = Number(targetRaw);
      if (isNaN(target) || targetRaw === '') errors.push('Target must be a number');

      const baseline = Number(baselineRaw);
      if (isNaN(baseline)) errors.push('Baseline must be a number');

      const cycleYear = Number(cycleYearRaw);
      if (isNaN(cycleYear) || cycleYearRaw === '') errors.push('Cycle Year must be a number');

      const kpiObj = {
        rowNum: i,
        kpiName: name,
        theme,
        subTheme,
        unit,
        weight: isNaN(weight) ? weightRaw : weight,
        baseline: isNaN(baseline) ? baselineRaw : baseline,
        target: isNaN(target) ? targetRaw : target,
        evidenceRequired: evidence,
        description: item['Description'],
        remark: item['Remark'],
        cycleYear: isNaN(cycleYear) ? cycleYearRaw : cycleYear,
        isValid: errors.length === 0,
        errors
      };
      kpisList.push(kpiObj);
    }
    setParsedData(kpisList);
    setCurrentPage(1);
    notify(`Parsed ${kpisList.length} rows successfully. Please check the preview table below.`, 'success');
  };

  const processFile = (file) => {
    if (!file.name.match(/\.(csv|xlsx?|xls)$/i)) {
      notify('Only CSV or Excel files are supported.', 'error');
      return;
    }

    setFileName(file.name);
    const reader = new FileReader();

    if (file.name.toLowerCase().endsWith('.csv')) {
      reader.onload = (e) => {
        const text = e.target.result;
        const csvRows = parseCSV(text);
        processRows(csvRows);
      };
      reader.readAsText(file);
    } else {
      reader.onload = (e) => {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        processRows(jsonData);
      };
      reader.readAsArrayBuffer(file);
    }
  };

  const handleDownloadTemplate = () => {
    const csvContent = [
  TEMPLATE_HEADERS.join(','),
  'Increase student enrollment by 15%,Education,Academic Quality,%,10.5,0,15,2024,No,Boost incoming registration across all faculties,Verify via registry documents',
  'Publish 5 accredited research papers,Research,Scientific Publications,No,15.0,0,5,2024,Yes,Publish internationally indexed articles,Upload DOI or certificates'
].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "kpi_mass_import_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const clearImport = () => {
    setParsedData([]);
    setFileName('');
    setCurrentPage(1);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleImportSubmit = async () => {
    const validKpis = parsedData.filter(item => item.isValid);
    if (validKpis.length === 0) {
      notify('There are no valid KPI rows to import.', 'warning');
      return;
    }

    setImporting(true);
    try {
      const payload = validKpis.map(item => ({
        kpiName: item.kpiName,
        theme: item.theme,
        subTheme: item.subTheme,
        unit: item.unit,
        weight: item.weight,
        baseline: item.baseline,
        target: item.target,
        cycleYear: item.cycleYear,
        
        isEvidenceRequired: item.evidenceRequired.toLowerCase() === 'yes' || item.evidenceRequired.toLowerCase() === 'true',
        description: item.description || null,
        remark: item.remark || null
      }));

      const res = await api.post('/kpis/import', { kpis: payload });
      const stats = res.data?.data || {};
      notify(`Mass import complete! Successfully imported ${stats.imported} KPIs.`, 'success');
      onSaved?.();
      setActiveTab('list');
    } catch (err) {
      console.error(err);
      notify(err?.response?.data?.message || 'Failed to complete bulk KPI import.', 'error');
    } finally {
      setImporting(false);
    }
  };

  const validCount = parsedData.filter(item => item.isValid).length;
  const invalidCount = parsedData.length - validCount;
  const paginatedRows = parsedData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <section className="space-y-6">
      <div className="bg-card border border-border rounded-xl p-8 w-full shadow-soft">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div>
            <h2 className="text-xl font-bold text-foreground">Mass Import KPIs</h2>
            <p className="text-sm text-muted-foreground mt-1">Upload a CSV template to bulk register theme categories, units, and KPIs for the active cycle.</p>
          </div>

          <Button
            onClick={handleDownloadTemplate}
            className="flex items-center gap-2 bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20 self-start md:self-center"
          >
            <Download className="h-4 w-4" />
            <span>Download CSV Template</span>
          </Button>
        </div>

        {/* Upload Box */}
        {parsedData.length === 0 ? (
          <div
            onDragEnter={handleDrag}
            onDragOver={handleDrag}
            onDragLeave={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all duration-300 ${dragActive
                ? 'border-primary bg-primary/5 scale-[1.01] shadow-md shadow-primary/5'
                : 'border-border bg-card/40 hover:border-primary/50 hover:bg-muted/30'
              }`}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".csv,.xlsx,.xls"
              className="hidden"
            />
            <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center mb-4 transition-transform group-hover:scale-110">
              <Upload className="h-7 w-7 text-primary" />
            </div>
            <p className="text-base font-semibold text-foreground">Drag and drop your KPI CSV file here</p>
            <p className="text-xs text-muted-foreground mt-2">CSV and Excel files with custom templates are supported. Max size 10MB.</p>
            <Button className="mt-6 bg-primary hover:bg-primary/95 text-white font-semibold flex items-center gap-2 rounded-full px-5 py-2">
              Browse File
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* File Info & Summary Stats */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-4 rounded-xl bg-muted/30 border border-border">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                  <FileSpreadsheet className="h-5 w-5 text-emerald-500" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{fileName}</p>
                  <p className="text-xs text-muted-foreground">Total parsed: {parsedData.length} records</p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Valid Rows</p>
                    <p className="text-base font-bold text-emerald-500 flex items-center justify-end gap-1.5 mt-0.5">
                      <CheckCircle2 className="h-4 w-4" />
                      {validCount}
                    </p>
                  </div>
                  {invalidCount > 0 && (
                    <div className="text-right border-l border-border pl-6">
                      <p className="text-xs text-muted-foreground">Errors Found</p>
                      <p className="text-base font-bold text-destructive flex items-center justify-end gap-1.5 mt-0.5">
                        <AlertCircle className="h-4 w-4" />
                        {invalidCount}
                      </p>
                    </div>
                  )}
                </div>

                <div className="border-l border-border pl-4 flex gap-2">
                  <Button
                    onClick={clearImport}
                    variant="outline"
                    className="h-9 px-3 text-destructive border-destructive/20 hover:bg-destructive/10"
                    title="Remove and upload different file"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Preview Table */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold text-foreground">Import Preview & Verification</h3>
                <span className="text-xs text-muted-foreground">Showing {paginatedRows.length} of {parsedData.length} entries</span>
              </div>

              <div className="overflow-hidden rounded-lg border border-border bg-card">
                <Table className="min-w-[1200px]">
                  <TableHeader>
                    <TableRow className="bg-muted/50 border-b border-border">
                      <TableHead className="w-16 text-center">Row</TableHead>
                      <TableHead className="w-24 text-center">Status</TableHead>
                      <TableHead className="w-64">KPI Name</TableHead>
                      <TableHead className="w-40">Theme</TableHead>
                      <TableHead className="w-40">Sub-Theme</TableHead>
                      <TableHead className="w-24 text-center">Unit</TableHead>
                      <TableHead className="w-20 text-center">Weight</TableHead>
                      <TableHead className="w-20 text-center">Baseline</TableHead>
                      <TableHead className="w-20 text-center">Target</TableHead>
                      <TableHead className="w-20 text-center">Cycle Year</TableHead>

                    </TableRow>
                  </TableHeader>

                  <TableBody>
                    {paginatedRows.map((row) => (
                      <TableRow
                        key={row.rowNum}
                        className={`border-b border-border/40 hover:bg-muted/10 transition-colors ${!row.isValid ? 'bg-destructive/5 dark:bg-destructive/10' : ''
                          }`}
                      >
                        <TableCell className="text-center font-mono text-xs text-muted-foreground">{row.rowNum}</TableCell>
                        <TableCell className="text-center">
                          {row.isValid ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400">
                              <CheckCircle2 className="h-3 w-3" />
                              Ready
                            </span>
                          ) : (
                            <div className="group relative inline-block">
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 cursor-help">
                                <AlertCircle className="h-3 w-3" />
                                {row.errors.length} Error{row.errors.length > 1 ? 's' : ''}
                              </span>
                              <div className="absolute z-10 bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block w-64 p-3 rounded-lg bg-popover text-popover-foreground border border-border shadow-md text-left text-xs space-y-1">
                                <p className="font-semibold text-destructive mb-1">Validation Errors:</p>
                                {row.errors.map((err, index) => (
                                  <p key={index} className="flex items-start gap-1">
                                    <span className="text-destructive">•</span>
                                    <span>{err}</span>
                                  </p>
                                ))}
                              </div>
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="font-medium">
                          <span className="line-clamp-2" title={row.kpiName}>{row.kpiName || '—'}</span>
                        </TableCell>
                        <TableCell><span className="truncate max-w-[150px] block" title={row.theme}>{row.theme || '—'}</span></TableCell>
                        <TableCell><span className="truncate max-w-[150px] block" title={row.subTheme}>{row.subTheme || '—'}</span></TableCell>
                        <TableCell className="text-center font-semibold text-xs font-mono">{row.unit || '—'}</TableCell>
                        <TableCell className="text-center font-mono text-sm">{row.weight}</TableCell>
                        <TableCell className="text-center font-mono text-sm">{row.baseline}</TableCell>
                        <TableCell className="text-center font-mono text-sm">{row.target}</TableCell>
                        <TableCell className="text-center font-mono text-sm">{row.cycleYear}</TableCell>

                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <TablePagination
                currentPage={currentPage}
                totalItems={parsedData.length}
                itemsPerPage={itemsPerPage}
                onPageChange={setCurrentPage}
              />
            </div>

            {/* Actions Bar */}
            <div className="flex items-center justify-between border-t border-border pt-6 mt-4">
              <div className="text-sm text-muted-foreground">
                {validCount > 0 ? (
                  <span>Ready to import <strong className="text-foreground">{validCount}</strong> valid KPI{validCount > 1 ? 's' : ''}. {invalidCount > 0 && 'Invalid rows will be skipped.'}</span>
                ) : (
                  <span className="text-destructive font-semibold">No valid rows available to import. Please check validation errors.</span>
                )}
              </div>

              <div className="flex gap-3">
                <Button
                  onClick={clearImport}
                  variant="outline"
                  className="bg-card text-foreground hover:bg-muted border border-border"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleImportSubmit}
                  disabled={validCount === 0 || importing}
                  className="bg-primary hover:bg-primary/95 text-white flex items-center gap-2 rounded-lg font-semibold px-6 shadow-md shadow-primary/10"
                >
                  {importing ? 'Importing...' : 'Proceed with Import'}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

export default ImportKpi;
