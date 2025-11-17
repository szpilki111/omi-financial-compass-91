import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import MainLayout from '@/components/layout/MainLayout';
import PageTitle from '@/components/ui/PageTitle';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Plus } from 'lucide-react';
import BudgetList from './BudgetList';
import BudgetForm from './BudgetForm';
import BudgetView from './BudgetView';

type ViewMode = 'list' | 'create' | 'edit' | 'view';

const BudgetPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedBudgetId, setSelectedBudgetId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleCreateNew = () => {
    setViewMode('create');
    setSelectedBudgetId(null);
  };

  const handleEdit = (budgetId: string) => {
    setViewMode('edit');
    setSelectedBudgetId(budgetId);
  };

  const handleView = (budgetId: string) => {
    setViewMode('view');
    setSelectedBudgetId(budgetId);
  };

  const handleBack = () => {
    setViewMode('list');
    setSelectedBudgetId(null);
    setRefreshKey(prev => prev + 1);
  };

  const handleSaved = () => {
    setViewMode('list');
    setSelectedBudgetId(null);
    setRefreshKey(prev => prev + 1);
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <PageTitle title="Planowanie budżetowe" />
          <div className="flex gap-2">
            {viewMode !== 'list' && (
              <Button onClick={handleBack} variant="outline">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Powrót
              </Button>
            )}
            {viewMode === 'list' && (
              <Button onClick={handleCreateNew}>
                <Plus className="mr-2 h-4 w-4" />
                Nowy budżet
              </Button>
            )}
          </div>
        </div>

        {viewMode === 'list' && (
          <BudgetList
            key={refreshKey}
            onView={handleView}
            onEdit={handleEdit}
          />
        )}

        {(viewMode === 'create' || viewMode === 'edit') && (
          <BudgetForm
            budgetId={selectedBudgetId}
            onSaved={handleSaved}
            onCancel={handleBack}
          />
        )}

        {viewMode === 'view' && selectedBudgetId && (
          <BudgetView
            budgetId={selectedBudgetId}
            onEdit={handleEdit}
            onBack={handleBack}
          />
        )}
      </div>
    </MainLayout>
  );
};

export default BudgetPage;
