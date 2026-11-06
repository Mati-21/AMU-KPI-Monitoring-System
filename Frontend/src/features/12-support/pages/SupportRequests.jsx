import { useEffect, useState } from 'react';
import { formatEthiopianDateTime } from '../../../shared/lib/ethiopianDate';
import { CheckCircle2, Clock, Inbox, Mail, RotateCcw } from 'lucide-react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '../../../shared/api/axios';
import { Badge } from '../../../shared/components/ui/Badge';
import Button from '../../../shared/components/ui/Button';
import SearchInput from '../../../shared/components/ui/SearchInput';
import { TablePagination } from '../../../shared/components/ui/Table';
import { queryKeys } from '../../../shared/config/queryKeys';
import { apiErrorMessage } from '../../../shared/lib/apiError';
import { useNotification } from '../../09-notifications/context/NotificationContext';

const QUERY_KEY = queryKeys.support.all;
const PAGE_SIZE = 10;
const SEARCH_DELAY_MS = 300;

const STATUS = {
  NEW: { label: 'New', icon: Inbox, className: 'bg-blue-500/10 text-blue-600 border-blue-500/30' },
  IN_PROGRESS: { label: 'In Progress', icon: Clock, className: 'bg-amber-500/10 text-amber-600 border-amber-500/30' },
  RESOLVED: { label: 'Resolved', icon: CheckCircle2, className: 'bg-green-500/10 text-green-600 border-green-500/30' },
};
const TABS = ['ALL', ...Object.keys(STATUS)];

const StatusBadge = ({ status }) => (
  <Badge variant="outline" className={STATUS[status].className}>
    {STATUS[status].label}
  </Badge>
);

const RequestPanel = ({ request, onChanged }) => {
  const { notify } = useNotification();
  const queryClient = useQueryClient();
  const [note, setNote] = useState(request.resolutionNote ?? '');

  const update = useMutation({
    mutationFn: (values) => api.patch(`/support-requests/${request.id}`, values).then(({ data }) => data.data),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      onChanged(updated);
      notify('Request updated.', 'success');
    },
    onError: (error) => notify(apiErrorMessage(error, 'Could not update this request.'), 'error'),
  });

  return (
    <div className="space-y-4 rounded-lg border border-border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-foreground">{request.requesterName}</h2>
          <p className="text-xs text-muted-foreground">{formatEthiopianDateTime(request.createdAt)}</p>
        </div>
        <StatusBadge status={request.status} />
      </div>
      <p className="whitespace-pre-wrap text-sm text-foreground">{request.message}</p>
      <a href={`mailto:${request.requesterEmail}?subject=${encodeURIComponent('Your support request')}`} className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline underline-offset-4">
        <Mail className="h-4 w-4" />
        Reply to {request.requesterEmail}
      </a>
      <label className="block space-y-1">
        <span className="text-xs text-muted-foreground">Internal note</span>
        <textarea value={note} onChange={(event) => setNote(event.target.value)} rows={3} className="w-full rounded-md border border-input bg-background p-2 text-sm" />
      </label>
      {request.handledBy && (
        <p className="text-xs text-muted-foreground">
          Last handled by {request.handledBy.firstName} {request.handledBy.lastName}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {request.status === 'NEW' && (
          <Button size="sm" variant="outline" disabled={update.isPending} onClick={() => update.mutate({ status: 'IN_PROGRESS', resolutionNote: note })}>
            Start Working
          </Button>
        )}
        {request.status !== 'RESOLVED' ? (
          <Button size="sm" disabled={update.isPending} onClick={() => update.mutate({ status: 'RESOLVED', resolutionNote: note })}>
            Mark Resolved
          </Button>
        ) : (
          <Button size="sm" variant="outline" className="gap-1" disabled={update.isPending} onClick={() => update.mutate({ status: 'IN_PROGRESS', resolutionNote: note })}>
            <RotateCcw className="h-4 w-4" />
            Reopen
          </Button>
        )}
      </div>
    </div>
  );
};

const SupportRequests = () => {
  const [tab, setTab] = useState('ALL');
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setAppliedSearch(search.trim());
      setPage(1);
    }, SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [search]);

  const params = { search: appliedSearch, page, limit: PAGE_SIZE, ...(tab !== 'ALL' && { status: tab }) };
  const { data, isLoading, error } = useQuery({
    queryKey: [...QUERY_KEY, params],
    queryFn: () => api.get('/support-requests', { params }).then((response) => response.data.data),
    placeholderData: keepPreviousData,
  });
  const requests = data?.requests ?? [];
  const counts = data?.counts ?? {};
  const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
  const countOf = (name) => (name === 'ALL' ? total : (counts[name] ?? 0));

  return (
    <div className="flex flex-1 overflow-y-auto bg-background">
      <main className="flex-1 min-w-0 space-y-5 p-6">
        <h1 className="text-2xl font-bold text-foreground">Support Requests</h1>

        <div className="flex flex-wrap items-center gap-2">
          {TABS.map((name) => (
            <Button
              key={name}
              size="sm"
              variant={tab === name ? 'default' : 'outline'}
              onClick={() => {
                setTab(name);
                setPage(1);
              }}
            >
              {name === 'ALL' ? 'All' : STATUS[name].label} ({countOf(name)})
            </Button>
          ))}
          <SearchInput value={search} onChange={setSearch} placeholder="Search name, email or message..." className="max-w-xs" />
        </div>

        {error && <p className="text-sm text-red-500">{apiErrorMessage(error, 'Could not load requests.')}</p>}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="space-y-2">
            {isLoading && <p className="text-sm text-muted-foreground">Loading...</p>}
            {!isLoading && requests.length === 0 && <p className="text-sm text-muted-foreground">No requests here.</p>}
            {requests.map((request) => (
              <button
                key={request.id}
                type="button"
                onClick={() => setSelected(request)}
                className={`w-full rounded-lg border p-4 text-left transition hover:bg-accent/30 ${selected?.id === request.id ? 'border-primary' : 'border-border'} bg-card`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-semibold text-foreground">{request.requesterName}</p>
                  <StatusBadge status={request.status} />
                </div>
                <p className="mt-1 truncate text-xs text-muted-foreground">{request.message}</p>
              </button>
            ))}
            <TablePagination currentPage={page} totalItems={data?.pagination?.total ?? 0} itemsPerPage={PAGE_SIZE} onPageChange={setPage} />
          </div>
          {selected ? <RequestPanel key={`${selected.id}-${selected.updatedAt}`} request={selected} onChanged={setSelected} /> : <p className="text-sm text-muted-foreground">Choose a request to read it.</p>}
        </div>
      </main>
    </div>
  );
};

export default SupportRequests;
