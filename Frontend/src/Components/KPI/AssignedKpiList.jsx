import { useMemo, useState } from 'react';
import { Eye } from 'lucide-react';
import { Badge } from '../UI/Badge';
import { Card, CardContent } from '../UI/Card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../UI/Table';
import { ScrollArea } from '../UI/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../UI/dialog';

const getThemeBadgeColor = (theme) => {
  if (theme.includes('Learning')) return 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/20';
  if (theme.includes('Research')) return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/20';
  if (theme.includes('Community')) return 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/20';
  return 'bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-500/20';
};

const AssignedKpiList = ({ kpis, emptyMessage = 'No KPIs found matching your criteria.' }) => {
  const [selectedRowId, setSelectedRowId] = useState(null);
  const selectedRow = useMemo(() => kpis.find((row) => String(row.id) === String(selectedRowId)) || null, [kpis, selectedRowId]);

  return (
    <>
      <Card>
        <CardContent className="p-0">
          <ScrollArea className="w-full">
            <div className="min-w-200">
              <Table>
                <TableHeader>
                  <TableRow className="bg-primary/10">
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
