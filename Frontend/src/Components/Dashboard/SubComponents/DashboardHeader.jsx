import CustomSelect from '../../UI/CustomSelect';
import Button from '../../UI/Button';
import { FileText } from 'lucide-react';

const DashboardHeader = ({
  config,
  derivedKpiId,
  onDerivedKpiChange,
  focusedRoleId,
  onRoleChange,
  selectedCycleYear,
  onYearChange,
  quarter,
  setQuarter,
  isExportingPdf,
  onExportPdf,
}) => {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{config.title}</h1>
        <p className="text-sm text-muted-foreground">{config.subtitle}</p>
      </div>

      <div className="w-full">
        <div className="flex items-center justify-end w-full">
          <div className="flex flex-wrap items-center justify-end gap-2 w-full pb-1">
            <Button
              variant="outline"
              size="sm"
              className="h-9 gap-1.5 text-xs shrink-0"
              disabled={isExportingPdf}
              onClick={onExportPdf}
            >
              <FileText className="w-3.5 h-3.5" /> {isExportingPdf ? 'Generating...' : 'PDF'}
            </Button>

            {Array.isArray(config.childRoleOptions) && config.childRoleOptions.length > 0 && typeof onRoleChange === 'function' ? (
              <div className="w-56 text-xs shrink-0">
                <CustomSelect
                  options={[{ label: `All ${config.subUnitLabel || 'Units'}`, value: '__ALL__' }, ...config.childRoleOptions]}
                  value={focusedRoleId}
                  onChange={onRoleChange}
                  placeholder={`Select ${config.subUnitLabel || 'Unit'}`}
                />
              </div>
            ) : (
              Array.isArray(config.derivedKpiOptions) &&
              config.derivedKpiOptions.length > 0 &&
              typeof onDerivedKpiChange === 'function' && (
                <div className="w-56 text-xs shrink-0">
                  <CustomSelect
                    options={[{ label: 'Total Performance (All KPIs)', value: '__ALL__' }, ...config.derivedKpiOptions]}
                    value={derivedKpiId}
                    onChange={onDerivedKpiChange}
                    placeholder="Total Performance (All KPIs)"
                  />
                </div>
              )
            )}

            <div className="w-40 text-xs shrink-0">
              <CustomSelect options={config.yearOptions || []} value={selectedCycleYear || ''} onChange={onYearChange} placeholder="Select year" />
            </div>

            <div className="w-40 text-xs shrink-0">
              <CustomSelect options={['All Quarters', 'Q1', 'Q2', 'Q3', 'Q4']} value={quarter} onChange={setQuarter} placeholder="All Quarters" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardHeader;
