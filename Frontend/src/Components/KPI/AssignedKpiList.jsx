import { useMemo, useState } from 'react';
import { Eye, FileText, FileJson, FileSpreadsheet, Download } from 'lucide-react';
import { Badge } from '../UI/Badge';
import { Card, CardContent } from '../UI/Card';
import Button from '../UI/Button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../UI/Table';
import { ScrollArea } from '../UI/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../UI/dialog';
import Checkbox from '../UI/Checkbox';
import * as XLSX from 'xlsx';
import html2pdf from 'html2pdf.js';

const getThemeBadgeColor = (theme) => {
  if (theme.includes('Learning')) return 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/20';
  if (theme.includes('Research')) return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/20';
  if (theme.includes('Community')) return 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/20';
  return 'bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-500/20';
};

const AssignedKpiList = ({ kpis, emptyMessage = 'No KPIs found matching your criteria.' }) => {
  const [selectedRowId, setSelectedRowId] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const selectedRow = useMemo(() => kpis.find((row) => String(row.id) === String(selectedRowId)) || null, [kpis, selectedRowId]);

  const toggleRow = (id) => {
    setSelectedIds((prev) => {
      const s = new Set(prev.map(String));
      if (s.has(String(id))) {
        s.delete(String(id));
      } else {
        s.add(String(id));
      }
      return Array.from(s);
    });
  };

  const selectAll = () => setSelectedIds(kpis.map((r) => String(r.id)));
  const deselectAll = () => setSelectedIds([]);
  // invert selection removed per request

  const exportCsv = (rows) => {
    if (!rows || !rows.length) return;
    const headers = ['No', 'KPI', 'Theme', 'SubTheme', 'Unit', 'Weight', 'Baseline', 'Target', 'Remark'];
    const csv = [headers.join(',')]
      .concat(
        rows.map((r) =>
          [
            r.no,
            `"${(r.kpi || '').replace(/"/g, '""')}"`,
            `"${(r.theme || '').replace(/"/g, '""')}"`,
            `"${(r.subTheme || '').replace(/"/g, '""')}"`,
            r.unit,
            r.weight,
            r.baseline,
            r.target,
            `"${(r.remark || '').replace(/"/g, '""')}"`,
          ].join(',')
        )
      )
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'kpis.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportJson = (rows) => {
    const blob = new Blob([JSON.stringify(rows, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'kpis.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportXlsx = (rows) => {
    if (!rows || !rows.length) return;
    const data = rows.map((r) => ({
      No: r.no,
      KPI: r.kpi,
      Theme: r.theme,
      SubTheme: r.subTheme,
      Unit: r.unit,
      Weight: r.weight,
      Baseline: r.baseline,
      Target: r.target,
      Remark: r.remark,
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'KPIs');
    XLSX.writeFile(wb, 'kpis.xlsx');
  };

  const exportPdf = async (rows) => {
    if (!rows || !rows.length) return;
    const table = document.createElement('table');
    table.style.borderCollapse = 'collapse';
    table.style.width = '100%';
    table.style.fontFamily = 'Arial, sans-serif';

    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    ['No', 'KPI', 'Theme', 'SubTheme', 'Unit', 'Weight', 'Baseline', 'Target', 'Remark'].forEach((h) => {
      const th = document.createElement('th');
      th.style.border = '1px solid #ddd';
      th.style.padding = '6px';
      th.style.textAlign = 'left';
      th.style.background = '#f6f6f6';
      th.textContent = h;
      headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    rows.forEach((r) => {
      const tr = document.createElement('tr');
      [r.no, r.kpi, r.theme, r.subTheme, r.unit, r.weight, r.baseline, r.target, r.remark].forEach((cell) => {
        const td = document.createElement('td');
        td.style.border = '1px solid #ddd';
        td.style.padding = '6px';
        td.style.fontSize = '12px';
        td.textContent = cell;
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);

    const container = document.createElement('div');
    container.style.padding = '10px';
    container.appendChild(table);
    container.style.position = 'fixed';
    container.style.left = '-9999px';
    document.body.appendChild(container);

    try {
      await html2pdf()
        .from(container)
        .set({ margin: 10, filename: 'kpis.pdf', html2canvas: { scale: 2 } })
        .save();
    } catch (e) {
      // fallback: ignore
      // console.error(e);
    } finally {
      document.body.removeChild(container);
    }
  };

  return (
    <>
      <Card>
        <div className="p-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={selectAll}>
              Select all
            </Button>
            <Button size="sm" variant="outline" onClick={deselectAll}>
              Deselect
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              className="bg-muted/10 hover:bg-muted/20 px-2.5 py-1 rounded"
              onClick={() => exportCsv(selectedIds.length ? kpis.filter((r) => selectedIds.includes(String(r.id))) : kpis)}
              aria-label="Export CSV"
              title="Export CSV"
            >
              <FileText className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="bg-muted/10 hover:bg-muted/20 px-2.5 py-1 rounded"
              onClick={() => exportJson(selectedIds.length ? kpis.filter((r) => selectedIds.includes(String(r.id))) : kpis)}
              aria-label="Export JSON"
              title="Export JSON"
            >
              <FileJson className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="bg-muted/10 hover:bg-muted/20 px-2.5 py-1 rounded"
              onClick={() => exportXlsx(selectedIds.length ? kpis.filter((r) => selectedIds.includes(String(r.id))) : kpis)}
              aria-label="Export Excel"
              title="Export Excel"
            >
              <FileSpreadsheet className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="bg-muted/10 hover:bg-muted/20 px-2.5 py-1 rounded"
              onClick={() => exportPdf(selectedIds.length ? kpis.filter((r) => selectedIds.includes(String(r.id))) : kpis)}
              aria-label="Export PDF"
              title="Export PDF"
            >
              <Download className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <CardContent className="p-0">
          <ScrollArea className="w-full">
            <div className="min-w-200">
              <Table>
                <TableHeader>
                  <TableRow className="bg-primary/10">
                    <TableHead className="w-12 text-center font-bold text-foreground border-r">
                      <div className="flex items-center justify-center">
                        <Checkbox
                          id="select-all-kpis"
                          checked={kpis.length > 0 && selectedIds.length === kpis.length}
                          onCheckedChange={(checked) => (checked ? selectAll() : deselectAll())}
                        />
                      </div>
                    </TableHead>
                    <TableHead className="w-15 text-center font-bold text-foreground border-r">No.</TableHead>
                    <TableHead className="w-55 font-bold text-foreground border-r">KPI</TableHead>
                    <TableHead className="w-40 font-bold text-foreground border-r">Theme</TableHead>
                    <TableHead className="w-35 font-bold text-foreground border-r">Sub-Theme</TableHead>
                    <TableHead className="w-15 text-center font-bold text-foreground border-r">Unit</TableHead>
                    <TableHead className="w-17.5 text-center font-bold text-foreground border-r">Weight</TableHead>
                    <TableHead className="w-22.5 text-center font-bold text-foreground border-r">Baseline</TableHead>
                    <TableHead className="w-20 text-center font-bold text-foreground border-r">Target</TableHead>
                    <TableHead className="w-45 font-bold text-foreground border-r">Remark</TableHead>
                    <TableHead className="w-17.5 text-center font-bold text-foreground">View</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {kpis.map((row) => (
                    <TableRow key={row.id} className="hover:bg-muted/30">
                      <TableCell className="h-12 text-center border-r text-sm">
                        <div className="flex items-center justify-center">
                          <Checkbox
                            id={`select-kpi-${row.id}`}
                            checked={selectedIds.includes(String(row.id))}
                            onCheckedChange={() => toggleRow(row.id)}
                          />
                        </div>
                      </TableCell>
                      <TableCell className="h-12 text-center border-r text-sm font-medium">{row.no}</TableCell>
                      <TableCell className="h-12 border-r text-sm" title={row.kpi}>
                        <div className="flex flex-col gap-0.5">
                          <p className="truncate max-w-55">{row.kpi}</p>
                          {row.isEvidenceRequired && (
                            <span className="inline-flex items-center px-1 py-0.5 rounded-full text-[9px] font-bold bg-blue-50 text-blue-600 border border-blue-200 w-fit">
                              EVIDENCE REQ
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="border-r">
                        <Badge variant="outline" className={`text-xs ${getThemeBadgeColor(row.theme)}`}>
                          {row.theme.replace('Theme ', '').split(':')[0].trim()}
                        </Badge>
                      </TableCell>
                      <TableCell className="h-12 border-r text-sm text-muted-foreground" title={row.subTheme}>
                        <p className="truncate max-w-35">{row.subTheme}</p>
                      </TableCell>
                      <TableCell className="h-12 text-center border-r text-sm">{row.unit}</TableCell>
                      <TableCell className="h-12 text-center border-r text-sm font-medium">{row.weight}</TableCell>
                      <TableCell className="h-12 text-center border-r text-sm">{row.baseline}</TableCell>
                      <TableCell className="h-12 text-center border-r text-sm">{row.target}</TableCell>
                      <TableCell className="h-12 border-r text-sm text-muted-foreground" title={row.remark}>
                        <p className="truncate max-w-45">{row.remark}</p>
                      </TableCell>
                      <TableCell className="h-12 text-center">
                        <button
                          type="button"
                          onClick={() => setSelectedRowId(row.id)}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border hover:bg-muted"
                          aria-label="View full row details"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {kpis.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                        {emptyMessage}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      <Dialog open={Boolean(selectedRow)} onOpenChange={(open) => !open && setSelectedRowId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Full KPI Information</DialogTitle>
          </DialogHeader>

          {selectedRow ? (
            <div className="space-y-2 text-sm">
              <p>
                <span className="font-semibold">No:</span> {selectedRow.no}
              </p>
              <p>
                <span className="font-semibold">KPI:</span> {selectedRow.kpi}
              </p>
              <p>
                <span className="font-semibold">Theme:</span> {selectedRow.theme}
              </p>
              <p>
                <span className="font-semibold">Sub-Theme:</span> {selectedRow.subTheme}
              </p>
              <p>
                <span className="font-semibold">Unit:</span> {selectedRow.unit}
              </p>
              <p>
                <span className="font-semibold">Weight:</span> {selectedRow.weight}
              </p>
              <p>
                <span className="font-semibold">Baseline:</span> {selectedRow.baseline}
              </p>
              <p>
                <span className="font-semibold">Target:</span> {selectedRow.target}
              </p>
              <p>
                <span className="font-semibold">Remark:</span> {selectedRow.remark}
              </p>
              <p>
                <span className="font-semibold">Evidence Required:</span> {selectedRow.isEvidenceRequired ? 'Yes' : 'No'}
              </p>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default AssignedKpiList;
