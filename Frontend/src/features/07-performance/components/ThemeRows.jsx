import { Fragment } from 'react';

import { TableCell, TableRow } from '../../../shared/components/ui/Table';
import { groupByTheme, totalWeight } from '../lib/sheetRules';

const SHADE = 'bg-muted';

/**
 * The body of a KPI table grouped by Theme and Sub-theme, with a weight sub total after each sub-theme and a grand
 * total. `renderRow` draws one KPI; `columns` is how many columns the table has, `weightColumn` where weight sits.
 * `showTotals` leaves the weight rows out where a table holds only part of the contract.
 * `shaded` ({ from, count }) keeps a darker band down some columns, the group rows and total rows included.
 */
const ThemeRows = ({ rows, columns, weightColumn, renderRow, showTotals = true, shaded = null }) => {
  const shadeOf = (index) => (shaded && index >= shaded.from && index < shaded.from + shaded.count ? SHADE : undefined);
  // Empty cells from one column up to, not including, another, so the shaded band carries through
  const filler = (from, to) => Array.from({ length: Math.max(0, to - from) }, (_, offset) => <TableCell key={from + offset} className={shadeOf(from + offset)} />);
  // A group heading is one colour across the whole row, the shaded columns included
  const labelRow = (label, className, cellClassName) => {
    const span = shaded ? Math.min(shaded.from, columns) : columns;
    return (
      <TableRow className={className}>
        <TableCell colSpan={span} className={cellClassName}>
          {label}
        </TableCell>
        {shaded && Array.from({ length: columns - span }, (_, offset) => <TableCell key={span + offset} />)}
      </TableRow>
    );
  };
  const totalRow = (label, weight, strong) => (
    <TableRow className={strong ? 'border-t-2 border-border font-semibold' : 'font-medium'}>
      <TableCell className="text-foreground">{label}</TableCell>
      {filler(1, weightColumn)}
      <TableCell className="text-foreground">{weight}</TableCell>
      {filler(weightColumn + 1, columns)}
    </TableRow>
  );

  return (
    <>
      {groupByTheme(rows).map(({ theme, groups }) => (
        <Fragment key={theme.id}>
          {labelRow(`Theme: ${theme.name}`, 'bg-primary/15 hover:bg-primary/15', 'font-semibold text-foreground')}
          {groups.map((group) => (
            <Fragment key={group.subTheme?.id ?? 'none'}>
              {group.subTheme && labelRow(`Sub-theme: ${group.subTheme.name}`, 'bg-primary/[0.07] hover:bg-primary/[0.07]', 'font-medium text-foreground')}
              {group.rows.map(renderRow)}
              {showTotals && totalRow('Sub Total', group.weight, false)}
            </Fragment>
          ))}
        </Fragment>
      ))}
      {showTotals && rows.length > 0 && totalRow('Grand Total', totalWeight(rows), true)}
    </>
  );
};

export default ThemeRows;
