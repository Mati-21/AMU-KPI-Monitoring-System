import { ArrowLeft } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';

import ContractDetail from '../components/ContractDetail';
import { useContract, useContracts } from '../hooks/useContracts';

/**
 * One contract on its own page. The year's other contracts are needed to find the office above it.
 */
const ContractPage = () => {
  const { contractId } = useParams();
  const { data: contract } = useContract(contractId);
  const yearId = contract?.fiscalYear.id;
  const { data: contracts = [] } = useContracts(yearId);

  return (
    <div className="flex min-h-full bg-background">
      <main className="flex min-w-0 flex-1 flex-col space-y-5 p-6">
        <div>
          <Link to={yearId ? `/assign-kpi?year=${yearId}` : '/assign-kpi'} className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
            Back to Contracts
          </Link>
          <h1 className="text-2xl font-bold text-foreground">KPI Contract</h1>
        </div>
        <ContractDetail contractId={contractId} contracts={contracts} />
      </main>
    </div>
  );
};

export default ContractPage;
