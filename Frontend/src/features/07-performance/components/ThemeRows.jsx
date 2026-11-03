import { Fragment } from 'react';

import { TableCell, TableRow } from '../../../shared/components/ui/Table';
import { groupByTheme, totalWeight } from '../lib/sheetRules';

/**
 * The body of a KPI table grouped by Theme and Sub-theme, with a weight sub total after each sub-theme and a grand
 * total. `renderRow` draws one KPI; `columns` is how many columns the table has, `weightColumn` where weight sits.
 * `showTotals` leaves the weight rows out where a table holds only part of the contract.
 */
const ThemeRows = ({ rows, columns, weightColumn, renderRow, showTotals = true }) => {
  const filler = (count) => Array.from({ length: count }, (_, index) => <TableCell key={index} />);
  const totalRow = (label, weight, strong) => (
    <TableRow className={strong ? 'border-t-2 border-border font-semibold' : 'font-medium'}>
      <TableCell className="text-foreground">{label}</TableCell>
      {filler(weightColumn - 1)}
      <TableCell className="text-foreground">{weight}</TableCell>
      {filler(columns - weightColumn - 1)}
    </TableRow>
  );

  return (
    <>
      {groupByTheme(rows).map(({ theme, groups }) => (
        <Fragment key={theme.id}>
          <TableRow className="bg-muted/70 hover:bg-muted/70">
            <TableCell colSpan={columns} className="font-semibold text-foreground">
              Theme: {theme.name}
            </TableCell>
          </TableRow>
          {groups.map((group) => (
            <Fragment key={group.subTheme?.id ?? 'none'}>
              {group.subTheme && (
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableCell colSpan={columns} className="font-medium text-foreground">
                    Sub-theme: {group.subTheme.name}
                  </TableCell>
                </TableRow>
              )}
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
