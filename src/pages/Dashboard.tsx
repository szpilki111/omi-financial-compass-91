
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import MainLayout from '@/components/layout/MainLayout';
import { useAuth } from '@/context/AuthContext';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';
import FinancialCard from '@/components/dashboard/FinancialCard';
import QuickAccessCard from '@/components/dashboard/QuickAccessCard';
import NotificationCard from '@/components/dashboard/NotificationCard';
import ReportStatusCard from '@/components/dashboard/ReportStatusCard';
import { FileText, TrendingUp, TrendingDown, Plus, BarChart, Database, BookOpen, Activity, CheckCircle, Clock } from 'lucide-react';

const Dashboard = () => {
  const { user } = useAuth();

  // Pobieranie powiadomień o zmianach statusów raportów
  const { data: notifications, isLoading: loadingNotifications } = useQuery({
    queryKey: ['notifications', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      // Dla adminów i prowincjałów - powiadomienia o zmianach statusów raportów
      if (user.role === 'admin' || user.role === 'prowincjal') {
        const { data: recentReports, error } = await supabase
          .from('reports')
          .select(`
            id,
            title,
            status,
            submitted_at,
            reviewed_at,
            location_id,
            locations!inner(name)
          `)
          .order('updated_at', { ascending: false })
          .limit(5);

        if (error) throw error;

        return recentReports?.map(report => ({
          id: report.id,
          title: `Raport: ${report.title}`,
          message: `${report.locations.name} - Status: ${getStatusText(report.status)}`,
          date: format(new Date(report.reviewed_at || report.submitted_at || new Date()), 'PPP', { locale: pl }),
          priority: report.status === 'submitted' ? 'medium' : 'low',
          read: false,
          action_label: 'Zobacz raport',
          action_link: `/reports/${report.id}`
        })) || [];
      } else {
        // Dla lokalnych ekonomów - standardowe powiadomienia
        const { data, error } = await supabase
          .from('notifications')
          .select('*')
          .eq('user_id', user.id)
          .eq('read', false)
          .order('created_at', { ascending: false })
          .limit(3);

        if (error) throw error;
        return data || [];
      }
    },
    enabled: !!user?.id
  });

  // Pobieranie danych finansowych z podsumowań raportów
  const { data: currentMonthData, isLoading: loadingCurrentMonth } = useQuery({
    queryKey: ['current-month-reports-data', user?.location, user?.role],
    queryFn: async () => {
      if (!user) return null;

      const currentDate = new Date();
      const currentMonth = currentDate.getMonth() + 1;
      const currentYear = currentDate.getFullYear();

      let query = supabase
        .from('reports')
        .select(`
          id,
          report_details!inner(
            income_total,
            expense_total,
            balance
          )
        `)
        .eq('month', currentMonth)
        .eq('year', currentYear)
        .eq('status', 'approved');

      // Dla lokalnych ekonomów - tylko ich lokalizacja
      if (user.role === 'ekonom' && user.location) {
        query = query.eq('location_id', user.location);
      }

      const { data, error } = await query;
      if (error) throw error;

      if (!data || data.length === 0) {
        return { income: 0, expense: 0, balance: 0 };
      }

      // Sumowanie danych z wszystkich raportów
      const totals = data.reduce((acc, report) => {
        const details = report.report_details;
        return {
          income: acc.income + Number(details.income_total || 0),
          expense: acc.expense + Number(details.expense_total || 0),
          balance: acc.balance + Number(details.balance || 0)
        };
      }, { income: 0, expense: 0, balance: 0 });

      return totals;
    },
    enabled: !!user
  });

  // Pobieranie danych z poprzedniego miesiąca do porównania
  const { data: previousMonthData } = useQuery({
    queryKey: ['previous-month-reports-data', user?.location, user?.role],
    queryFn: async () => {
      if (!user) return null;

      const currentDate = new Date();
      const previousMonth = currentDate.getMonth() === 0 ? 12 : currentDate.getMonth();
      const previousYear = currentDate.getMonth() === 0 ? currentDate.getFullYear() - 1 : currentDate.getFullYear();

      let query = supabase
        .from('reports')
        .select(`
          id,
          report_details!inner(
            income_total,
            expense_total
          )
        `)
        .eq('month', previousMonth)
        .eq('year', previousYear)
        .eq('status', 'approved');

      // Dla lokalnych ekonomów - tylko ich lokalizacja
      if (user.role === 'ekonom' && user.location) {
        query = query.eq('location_id', user.location);
      }

      const { data, error } = await query;
      if (error) throw error;

      if (!data || data.length === 0) {
        return { income: 0, expense: 0 };
      }

      // Sumowanie danych z wszystkich raportów
      const totals = data.reduce((acc, report) => {
        const details = report.report_details;
        return {
          income: acc.income + Number(details.income_total || 0),
          expense: acc.expense + Number(details.expense_total || 0)
        };
      }, { income: 0, expense: 0 });

      return totals;
    },
    enabled: !!user
  });

  // Pobieranie ostatniej aktywności użytkownika
  const { data: recentActivity, isLoading: loadingActivity } = useQuery({
    queryKey: ['recent-activity', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      if (user.role === 'admin' || user.role === 'prowincjal') {
        // Dla adminów i prowincjałów - ostatnio zrecenzowane raporty
        const { data, error } = await supabase
          .from('reports')
          .select(`
            id,
            title,
            status,
            reviewed_at,
            location_id,
            locations!inner(name)
          `)
          .eq('reviewed_by', user.id)
          .not('reviewed_at', 'is', null)
          .order('reviewed_at', { ascending: false })
          .limit(5);

        if (error) throw error;
        return data || [];
      } else {
        // Dla lokalnych ekonomów - ostatnie transakcje
        const { data, error } = await supabase
          .from('transactions')
          .select(`
            *,
            debit_account:accounts!debit_account_id(number, name),
            credit_account:accounts!credit_account_id(number, name)
          `)
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(5);

        if (error) throw error;
        return data || [];
      }
    },
    enabled: !!user?.id
  });

  // Pobieranie informacji o placówce (tylko dla lokalnych ekonomów)
  const { data: locationInfo } = useQuery({
    queryKey: ['location-info', user?.location],
    queryFn: async () => {
      if (!user?.location || user.role !== 'ekonom') return null;
      
      const { data, error } = await supabase
        .from('locations')
        .select('name')
        .eq('id', user.location)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!user?.location && user?.role === 'ekonom'
  });

  const getStatusText = (status: string) => {
    switch (status) {
      case 'draft': return 'Wersja robocza';
      case 'submitted': return 'Złożony';
      case 'approved': return 'Zaakceptowany';
      case 'to_be_corrected': return 'Do poprawy';
      default: return status;
    }
  };

  const calculatePercentageChange = (current: number, previous: number) => {
    if (!previous || previous === 0) return 0;
    return ((current - previous) / Math.abs(previous)) * 100;
  };

  const currentIncome = currentMonthData?.income || 0;
  const currentExpense = currentMonthData?.expense || 0;
  const currentBalance = currentMonthData?.balance || 0;

  const previousIncome = previousMonthData?.income || 0;
  const previousExpense = previousMonthData?.expense || 0;

  const incomeChange = calculatePercentageChange(currentIncome, previousIncome);
  const expenseChange = calculatePercentageChange(currentExpense, previousExpense);

  const currentMonth = format(new Date(), 'LLLL', { locale: pl });

  const getWelcomeMessage = () => {
    if (user?.role === 'admin') {
      return 'Panel administracyjny - Przegląd wszystkich placówek';
    } else if (user?.role === 'prowincjal') {
      return 'Panel prowincjała - Nadzór nad raportami';
    } else {
      return locationInfo?.name ? `${locationInfo.name} - Podsumowanie finansowe` : 'Podsumowanie finansowe';
    }
  };

  const getDataSource = () => {
    if (user?.role === 'ekonom') {
      return 'Na podstawie zaakceptowanych raportów z placówki';
    } else {
      return 'Na podstawie zaakceptowanych raportów ze wszystkich placówek';
    }
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Nagłówek z powitaniem */}
        <div className="bg-white p-6 rounded-lg shadow-sm">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Witaj, {user?.name || 'Użytkowniku'}
          </h1>
          <p className="text-gray-600">
            {getWelcomeMessage()}
          </p>
          <p className="text-sm text-gray-500 mt-1">
            {getDataSource()}
          </p>
        </div>

        {/* Karty finansowe */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <FinancialCard
            title="Bilans bieżący"
            amount={currentBalance}
            subtitle={`Stan na koniec ${currentMonth}`}
            icon={<FileText className="h-6 w-6" />}
            loading={loadingCurrentMonth}
            trend="neutral"
          />

          <FinancialCard
            title={`Przychody (${currentMonth})`}
            amount={currentIncome}
            subtitle={incomeChange !== 0 ? `${incomeChange > 0 ? '+' : ''}${incomeChange.toFixed(1)}% w/w poprz. miesiąc` : 'Brak danych porównawczych'}
            icon={<TrendingUp className="h-6 w-6" />}
            trend={incomeChange > 0 ? 'up' : incomeChange < 0 ? 'down' : 'neutral'}
            trendColor="green"
            loading={loadingCurrentMonth}
          />

          <FinancialCard
            title={`Rozchody (${currentMonth})`}
            amount={currentExpense}
            subtitle={expenseChange !== 0 ? `${expenseChange > 0 ? '+' : ''}${expenseChange.toFixed(1)}% w/w poprz. miesiąc` : 'Brak danych porównawczych'}
            icon={<TrendingDown className="h-6 w-6" />}
            trend={expenseChange > 0 ? 'up' : expenseChange < 0 ? 'down' : 'neutral'}
            trendColor="red"
            loading={loadingCurrentMonth}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Szybki dostęp i ostatnia aktywność */}
          <div className="lg:col-span-2 space-y-6">
            <div>
              <h2 className="text-lg font-semibold mb-4">Szybki dostęp</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {user?.role === 'ekonom' && (
                  <QuickAccessCard
                    title="Nowa operacja KPiR"
                    icon={<Plus className="h-6 w-6" />}
                    onClick={() => window.location.href = '/kpir'}
                  />
                )}
                <QuickAccessCard
                  title="Raporty"
                  icon={<FileText className="h-6 w-6" />}
                  onClick={() => window.location.href = '/reports'}
                />
                <QuickAccessCard
                  title="Wizualizacja danych"
                  icon={<BarChart className="h-6 w-6" />}
                  onClick={() => window.location.href = '/wizualizacja'}
                />
                <QuickAccessCard
                  title="Baza wiedzy"
                  icon={<BookOpen className="h-6 w-6" />}
                  onClick={() => {/* Implement knowledge base navigation */}}
                />
              </div>
            </div>

            {/* Status raportu - tylko dla lokalnych ekonomów */}
            {user?.role === 'ekonom' && (
              <div>
                <h2 className="text-lg font-semibold mb-4">Status raportu</h2>
                <ReportStatusCard />
              </div>
            )}

            {/* Ostatnia aktywność */}
            <div>
              <h2 className="text-lg font-semibold mb-4">
                {user?.role === 'admin' || user?.role === 'prowincjal' ? 'Ostatnie recenzje raportów' : 'Ostatnia aktywność'}
              </h2>
              <div className="bg-white p-6 rounded-lg shadow-sm">
                {loadingActivity ? (
                  <div className="text-center p-4 text-gray-500">Ładowanie aktywności...</div>
                ) : recentActivity && recentActivity.length > 0 ? (
                  <div className="space-y-3">
                    {recentActivity.map((item, index) => (
                      <div key={item.id || index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-blue-100 rounded-lg">
                            {user?.role === 'admin' || user?.role === 'prowincjal' ? (
                              <CheckCircle className="h-4 w-4 text-blue-600" />
                            ) : (
                              <Activity className="h-4 w-4 text-blue-600" />
                            )}
                          </div>
                          <div>
                            {user?.role === 'admin' || user?.role === 'prowincjal' ? (
                              <>
                                <p className="font-medium text-sm">{item.title}</p>
                                <p className="text-xs text-gray-500">
                                  {item.locations?.name} - Status: {getStatusText(item.status)} - 
                                  {format(new Date(item.reviewed_at), 'dd.MM.yyyy HH:mm', { locale: pl })}
                                </p>
                              </>
                            ) : (
                              <>
                                <p className="font-medium text-sm">{item.description}</p>
                                <p className="text-xs text-gray-500">
                                  {format(new Date(item.date), 'dd.MM.yyyy', { locale: pl })} - 
                                  {item.debit_account?.number} → {item.credit_account?.number}
                                </p>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          {user?.role === 'admin' || user?.role === 'prowincjal' ? (
                            <p className="text-xs text-gray-500">
                              <Clock className="h-3 w-3 inline mr-1" />
                              Zrecenzowano
                            </p>
                          ) : (
                            <>
                              <p className="font-medium text-sm">
                                {new Intl.NumberFormat('pl-PL', {
                                  style: 'currency',
                                  currency: 'PLN'
                                }).format(Number(item.amount))}
                              </p>
                              <p className="text-xs text-gray-500">{item.settlement_type}</p>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center p-4 text-gray-500 italic">
                    Brak ostatniej aktywności
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Powiadomienia */}
          <div>
            <h2 className="text-lg font-semibold mb-4">
              {user?.role === 'admin' || user?.role === 'prowincjal' ? 'Zmiany statusów raportów' : 'Powiadomienia'}
            </h2>
            <div className="space-y-3">
              {loadingNotifications ? (
                <div className="text-center p-4 text-gray-500">Ładowanie powiadomień...</div>
              ) : notifications && notifications.length > 0 ? (
                notifications.map((notification) => (
                  <NotificationCard
                    key={notification.id}
                    notification={{
                      id: notification.id,
                      title: notification.title,
                      message: notification.message,
                      date: notification.date,
                      priority: notification.priority as 'low' | 'medium' | 'high',
                      read: notification.read || false,
                      action_label: notification.action_label,
                      action_link: notification.action_link
                    }}
                  />
                ))
              ) : (
                <div className="bg-white p-4 rounded-lg shadow-sm text-center text-gray-500">
                  {user?.role === 'admin' || user?.role === 'prowincjal' ? 'Brak nowych zmian statusów' : 'Brak nowych powiadomień'}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default Dashboard;
