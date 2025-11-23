import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import MainLayout from '@/components/layout/MainLayout';
import PageTitle from '@/components/ui/PageTitle';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowLeft, Plus, BarChart, BarChart3, Search } from 'lucide-react';
import BudgetList from './BudgetList';
import BudgetForm from './BudgetForm';
import BudgetView from './BudgetView';
import BudgetDeviationReport from './BudgetDeviationReport';
import BudgetMultiYearComparison from './BudgetMultiYearComparison';

type ViewMode = 'list' | 'create' | 'edit' | 'view' | 'deviations' | 'multi-year';

const BudgetPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedBudgetId, setSelectedBudgetId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // Filter states
  const [filterYear, setFilterYear] = useState<number | null>(null);
  const [filterLocationId, setFilterLocationId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string | null>('all');
  const [searchText, setSearchText] = useState('');

  const showFilters = user?.role === 'prowincjal' || user?.role === 'admin';

  // Fetch locations for filter
  const { data: locations } = useQuery({
    queryKey: ['locations-for-filter'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('locations')
        .select('id, name')
        .order('name');
      if (error) throw error;
      return data;
    },
    enabled: showFilters,
  });

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

  const handleViewDeviations = () => {
    setViewMode('deviations');
    setSelectedBudgetId(null);
  };

  const handleViewMultiYear = () => {
    setViewMode('multi-year');
    setSelectedBudgetId(null);
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

  const handleClearFilters = () => {
    setFilterYear(null);
    setFilterLocationId(null);
    setFilterStatus('all');
    setSearchText('');
  };

  // Generate year options (current year - 2 to current year + 3)
  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 6 }, (_, i) => currentYear - 2 + i);

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
              <>
                <Button onClick={handleViewDeviations} variant="outline">
                  <BarChart className="mr-2 h-4 w-4" />
                  Raport odchyleń
                </Button>
                <Button onClick={handleViewMultiYear} variant="outline">
                  <BarChart3 className="mr-2 h-4 w-4" />
                  Porównanie wieloletnie
                </Button>
                <Button onClick={handleCreateNew}>
                  <Plus className="mr-2 h-4 w-4" />
                  Nowy budżet
                </Button>
              </>
            )}
          </div>
        </div>

        {viewMode === 'list' && showFilters && (
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Search className="h-5 w-5 text-muted-foreground" />
                  <Label>Filtry wyszukiwania</Label>
                </div>
                <div className="grid gap-4 md:grid-cols-4">
                  <div className="space-y-2">
                    <Label htmlFor="filter-year">Rok</Label>
                    <Select
                      value={filterYear?.toString() || 'all'}
                      onValueChange={(value) => setFilterYear(value === 'all' ? null : parseInt(value))}
                    >
                      <SelectTrigger id="filter-year">
                        <SelectValue placeholder="Wszystkie" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Wszystkie</SelectItem>
                        {yearOptions.map(year => (
                          <SelectItem key={year} value={year.toString()}>
                            {year}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="filter-location">Lokalizacja</Label>
                    <Select
                      value={filterLocationId || 'all'}
                      onValueChange={(value) => setFilterLocationId(value === 'all' ? null : value)}
                    >
                      <SelectTrigger id="filter-location">
                        <SelectValue placeholder="Wszystkie" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Wszystkie</SelectItem>
                        {locations?.map(location => (
                          <SelectItem key={location.id} value={location.id}>
                            {location.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="filter-status">Status</Label>
                    <Select
                      value={filterStatus || 'all'}
                      onValueChange={(value) => setFilterStatus(value)}
                    >
                      <SelectTrigger id="filter-status">
                        <SelectValue placeholder="Wszystkie" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Wszystkie</SelectItem>
                        <SelectItem value="draft">Projekt</SelectItem>
                        <SelectItem value="submitted">Złożony</SelectItem>
                        <SelectItem value="approved">Zatwierdzony</SelectItem>
                        <SelectItem value="rejected">Odrzucony</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="filter-search">Szukaj</Label>
                    <Input
                      id="filter-search"
                      placeholder="Nazwa lokalizacji lub twórcy"
                      value={searchText}
                      onChange={(e) => setSearchText(e.target.value)}
                    />
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button variant="outline" onClick={handleClearFilters}>
                    Wyczyść filtry
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {viewMode === 'list' && (
          <BudgetList
            key={refreshKey}
            onView={handleView}
            onEdit={handleEdit}
            filterYear={filterYear}
            filterLocationId={filterLocationId}
            filterStatus={filterStatus}
            searchText={searchText}
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

        {viewMode === 'deviations' && (
          <BudgetDeviationReport />
        )}

        {viewMode === 'multi-year' && (
          <BudgetMultiYearComparison />
        )}
      </div>
    </MainLayout>
  );
};

export default BudgetPage;