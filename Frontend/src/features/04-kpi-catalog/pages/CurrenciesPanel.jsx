import { useState } from 'react';
import { Edit3 } from 'lucide-react';

import { Badge } from '../../../shared/components/ui/Badge';
import Button from '../../../shared/components/ui/Button';
import { apiErrorMessage } from '../../../shared/lib/apiError';
import { formatDate, todayIso } from '../../02-offices/lib/officeTree';
import { useCan } from '../../03-access-control/hooks/useCan';
import { useNotification } from '../../09-notifications/context/NotificationContext';
import RecordDialog from '../components/RecordDialog';
import RecordTable, { IconAction } from '../components/RecordTable';
import { useCurrencies, useExchangeRates, useSaveRecord } from '../hooks/useCatalog';

const CURRENCY_FIELDS = [
  { key: 'code', label: 'Code', required: true, hint: 'Three letters, such as ETB or USD.' },
  { key: 'name', label: 'Name', required: true },
  { key: 'symbol', label: 'Symbol' },
];

const rateFields = (currencies) => {
  const options = currencies.map((currency) => ({ value: currency.id, label: `${currency.code} - ${currency.name}` }));
  return [
    { key: 'fromCurrencyId', label: 'From', type: 'select', required: true, options },
    { key: 'toCurrencyId', label: 'To', type: 'select', required: true, options },
    { key: 'rate', label: 'Rate', type: 'number', required: true, min: 0, step: 'any', hint: 'How much of the To currency one unit of the From currency buys.' },
    { key: 'rateDate', label: 'Date', type: 'date', required: true },
    { key: 'source', label: 'Source', hint: 'For example National Bank of Ethiopia.' },
  ];
};

const CurrenciesPanel = () => {
  const can = useCan();
  const { notify } = useNotification();
  const { data: currencies = [], isLoading, error } = useCurrencies();
  const { data: rates = [], isLoading: ratesLoading, error: ratesError } = useExchangeRates();
  const saveCurrency = useSaveRecord('currencies');
  const saveRate = useSaveRecord('exchange-rates');
  const [currencyDialog, setCurrencyDialog] = useState(null);
  const [addingRate, setAddingRate] = useState(false);
  const canManage = can('kpi:manage');

  const makeReporting = (currency) =>
    saveCurrency.mutate(
      { id: currency.id, values: { isReportingCurrency: true } },
      {
        onSuccess: () => notify(`${currency.code} is now the reporting currency.`, 'success'),
        onError: (failure) => notify(apiErrorMessage(failure, 'Could not change the reporting currency.'), 'error'),
      }
    );

  const currencyColumns = [
    { label: 'Code', render: (row) => <span className="font-medium text-foreground">{row.code}</span> },
    { label: 'Name', render: (row) => row.name },
    { label: 'Symbol', render: (row) => row.symbol || '-' },
    { label: 'Reporting Currency', render: (row) => (row.isReportingCurrency ? <Badge variant="outline">Reporting</Badge> : '-') },
    ...(canManage
      ? [
          {
            label: 'Actions',
            render: (row) => (
              <div className="flex items-center gap-2">
                <IconAction icon={Edit3} label={`Edit ${row.code}`} onClick={() => setCurrencyDialog({ record: row })} />
                {!row.isReportingCurrency && (
                  <Button type="button" size="sm" variant="outline" onClick={() => makeReporting(row)}>
                    Make Reporting
                  </Button>
                )}
              </div>
            ),
          },
        ]
      : []),
  ];

  const rateColumns = [
    { label: 'Date', render: (row) => formatDate(row.rateDate) },
    { label: 'From', render: (row) => row.fromCurrency.code },
    { label: 'To', render: (row) => row.toCurrency.code },
    { label: 'Rate', render: (row) => Number(row.rate) },
    { label: 'Source', render: (row) => row.source || '-' },
  ];

  return (
    <div className="flex flex-col gap-5">
      <RecordTable title="Currencies" description="For money KPIs. Results are converted to the reporting currency." addLabel="Add Currency" onAdd={canManage ? () => setCurrencyDialog({}) : null} columns={currencyColumns} rows={currencies} isLoading={isLoading} error={error} />
      <RecordTable title="Exchange Rates" description="Rates cannot be edited, because reported values point at the rate they used. Add a new one instead." addLabel="Add Rate" onAdd={canManage && currencies.length >= 2 ? () => setAddingRate(true) : null} columns={rateColumns} rows={rates} isLoading={ratesLoading} error={ratesError} emptyText="No rates yet. Add two currencies first." />

      {currencyDialog && <RecordDialog title={currencyDialog.record ? 'Edit Currency' : 'Add Currency'} description="A currency money KPIs can report in." fields={CURRENCY_FIELDS} record={currencyDialog.record} mutation={saveCurrency} onClose={() => setCurrencyDialog(null)} />}
      {addingRate && <RecordDialog title="Add Exchange Rate" description={`The rate on a given day, such as ${todayIso()}.`} fields={rateFields(currencies)} mutation={saveRate} onClose={() => setAddingRate(false)} />}
    </div>
  );
};

export default CurrenciesPanel;
