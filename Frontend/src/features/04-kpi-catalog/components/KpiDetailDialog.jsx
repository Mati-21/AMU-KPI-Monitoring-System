import { Badge } from '../../../shared/components/ui/Badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../../../shared/components/ui/dialog';
import { optionLabel } from '../../10-system/lib/settingValues';
import { useThemeTree } from '../hooks/useCatalog';
import { themeNames } from '../lib/kpiRules';

const Detail = ({ label, children, wide }) => (
  <div className={wide ? 'sm:col-span-2' : ''}>
    <p className="text-xs text-muted-foreground">{label}</p>
    <p className="whitespace-pre-wrap text-sm text-foreground wrap-break-word">{children || '-'}</p>
  </div>
);

const words = (value) => (value ? optionLabel(value) : null);

const KpiDetailDialog = ({ kpi, onClose }) => {
  const { data: themes = [] } = useThemeTree();
  const { theme, subTheme } = themeNames(themes, kpi.themeId);

  return (
  <Dialog open onOpenChange={(next) => !next && onClose()}>
    <DialogContent className="max-h-[90vh] overflow-y-auto bg-card sm:max-w-2xl">
      <DialogHeader>
        <DialogTitle>
          {kpi.name}
        </DialogTitle>
        <DialogDescription>{kpi.description}</DialogDescription>
      </DialogHeader>
      <div className="flex flex-wrap gap-2">
        <Badge variant="outline">{kpi.isActive ? 'Active' : 'Retired'}</Badge>
        {kpi.isLocked && <Badge variant="outline">In use by {kpi.liveAssignmentCount} assignment(s)</Badge>}
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Detail label="Theme">{theme ?? kpi.theme?.name}</Detail>
        <Detail label="Sub-Theme">{subTheme}</Detail>
        <Detail label="Measurement Type">{words(kpi.measurementType)}</Detail>
        <Detail label="Direction">{words(kpi.direction)}</Detail>
        <Detail label="Target Type">{words(kpi.targetType)}</Detail>
        <Detail label="Reporting Frequency">{kpi.defaultFrequency?.name}</Detail>
        {kpi.remark && <Detail label="Remark">{kpi.remark}</Detail>}
        {kpi.unit && <Detail label="Unit">{kpi.unit.name}</Detail>}
        {kpi.currency && <Detail label="Currency">{kpi.currency.code}</Detail>}
        {kpi.scale && <Detail label="Scale">{kpi.scale.name}</Detail>}
        {kpi.numeratorLabel && <Detail label="Numerator">{kpi.numeratorLabel}</Detail>}
        {kpi.denominatorLabel && <Detail label="Denominator">{kpi.denominatorLabel}</Detail>}
        {kpi.maintenanceTolerance !== null && <Detail label="Allowed Variation">{String(kpi.maintenanceTolerance)}</Detail>}
        <Detail label="Combining Offices">{words(kpi.aggregationMethod)}</Detail>
        <Detail label="Combining Periods">{words(kpi.periodRollupMethod)}</Detail>
        <Detail label="Scoring Method">{words(kpi.scoringMethod)}</Detail>
        {kpi.replaces && <Detail label="Replaces">{kpi.replaces.name}</Detail>}
        {kpi.replacedBy?.length > 0 && <Detail label="Replaced By">{kpi.replacedBy[0].name}</Detail>}
      </div>
    </DialogContent>
  </Dialog>
  );
};

export default KpiDetailDialog;
