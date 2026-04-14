import { Badge } from '../UI/Badge';
import { Card, CardContent } from '../UI/Card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../UI/Table';
import { ScrollArea } from '../UI/scroll-area';

const getThemeBadgeColor = (theme) => {
  if (theme.includes('Learning')) return 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/20';
  if (theme.includes('Research')) return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/20';
  if (theme.includes('Community')) return 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/20';
  return 'bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-500/20';
};

const AssignedKpiList = ({ kpis }) => {
  return (
    <Card>
      <CardContent className="p-0">
        <ScrollArea className="w-full">
          <div className="min-w-[800px]">
            <Table>
              <TableHeader>
                <TableRow className="bg-primary/10">
                  <TableHead className="w-[60px] text-center font-bold text-foreground border-r">No.</TableHead>
                  <TableHead className="min-w-[250px] font-bold text-foreground border-r">KPI</TableHead>
                  <TableHead className="min-w-[180px] font-bold text-foreground border-r">Theme</TableHead>
                  <TableHead className="min-w-[120px] font-bold text-foreground border-r">Sub-Theme</TableHead>
                  <TableHead className="w-[60px] text-center font-bold text-foreground border-r">Unit</TableHead>
                  <TableHead className="w-[70px] text-center font-bold text-foreground border-r">Weight</TableHead>
                  <TableHead className="w-[90px] text-center font-bold text-foreground border-r">Baseline</TableHead>
                  <TableHead className="w-[80px] text-center font-bold text-foreground border-r">Target</TableHead>
                  <TableHead className="min-w-[120px] font-bold text-foreground">Remark</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {kpis.map((row) => (
                  <TableRow key={row.id} className="hover:bg-muted/30">
                    <TableCell className="text-center border-r text-sm font-medium">{row.no}</TableCell>
                    <TableCell className="border-r text-sm">{row.kpi}</TableCell>
                    <TableCell className="border-r">
                      <Badge variant="outline" className={`text-xs ${getThemeBadgeColor(row.theme)}`}>
                        {row.theme.replace('Theme ', '').split(':')[0].trim()}
                      </Badge>
                    </TableCell>
                    <TableCell className="border-r text-sm text-muted-foreground">{row.subTheme}</TableCell>
                    <TableCell className="text-center border-r text-sm">{row.unit}</TableCell>
                    <TableCell className="text-center border-r text-sm font-medium">{row.weight}</TableCell>
                    <TableCell className="text-center border-r text-sm">{row.baseline}</TableCell>
                    <TableCell className="text-center border-r text-sm">{row.target}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{row.remark}</TableCell>
                  </TableRow>
                ))}
                {kpis.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                      No KPIs found matching your criteria.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

export default AssignedKpiList;
