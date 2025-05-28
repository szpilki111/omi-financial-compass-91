import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import MainLayout from '@/components/layout/MainLayout';
import PageTitle from '@/components/ui/PageTitle';
import { Spinner } from '@/components/ui/Spinner';
import { useToast } from '@/hooks/use-toast';
import FinancialCard from '@/components/dashboard/FinancialCard';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Legend,
  BarChart,
  Bar,
} from 'recharts';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';
import { Calendar, TrendingUp, Building2, DollarSign, TrendingDown, BarChart3 } from 'lucide-react';

interface LocationFinancialData {
  location_id: string;
  location_name: string;
  income_total: number;
  expense_total: number;
  balance: number;
  period: string;
  year: number;
  month: number;
}

interface ComparisonData {
  location: string;
  current_period: number;
  previous_period: number;
  change: number;
  change_percent: number;
}

interface ChartData {
  period: string;
  year: number;
  month: number;
  [key: string]: string | number;
}

const chartConfig = {
  income: {
    label: "Dochody",
    color: "hsl(142, 76%, 36%)",
  },
  expense: {
    label: "Wydatki", 
    color: "hsl(0, 84%, 60%)",
  },
  balance: {
    label: "Bilans",
    color: "hsl(221, 83%, 53%)",
  },
};

const DataVisualizationPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [financialData, setFinancialData] = useState<LocationFinancialData[]>([]);
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [comparisonData, setComparisonData] = useState<ComparisonData[]>([]);
  
  // Filtry
  const [selectedPeriod, setSelectedPeriod] = useState<'month' | 'quarter' | 'year'>('month');
  const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString());
  const [selectedComparison, setSelectedComparison] = useState<'year_over_year' | 'month_over_month'>('month_over_month');
  const [selectedMetric, setSelectedMetric] = useState<'income' | 'expense' | 'balance'>('expense');

  const years = ['2024', '2025', '2026'];

  // Sprawdź czy użytkownik to ekonom (widzi tylko swoją placówkę)
  const isEkonom = user?.role === 'ekonom';

  const fetchFinancialData = async () => {
    setLoading(true);
    try {
      console.log('=== DEBUG: Rozpoczęcie pobierania danych finansowych z transakcji ===');
      
      // Pobierz wszystkie transakcje z podstawowymi danymi
      let transactionsQuery = supabase
        .from('transactions')
        .select(`
          id,
          date,
          amount,
          currency,
          location_id,
          debit_account_id,
          credit_account_id,
          debit_account:debit_account_id(number, name, type),
          credit_account:credit_account_id(number, name, type),
          locations!inner(name)
        `)
        .order('date', { ascending: true });

      // Filtruj według uprawnień użytkownika
      if (user?.role === 'ekonom' && user?.location) {
        transactionsQuery = transactionsQuery.eq('location_id', user.location);
      }

      const { data: transactions, error: transactionsError } = await transactionsQuery;

      console.log('DEBUG: Pobrane transakcje:', transactions);
      console.log('DEBUG: Błąd transakcji:', transactionsError);

      if (transactionsError) {
        throw transactionsError;
      }

      if (!transactions || transactions.length === 0) {
        console.log('DEBUG: Brak transakcji w systemie');
        setFinancialData([]);
        setChartData([]);
        setComparisonData([]);
        return;
      }

      // Grupuj transakcje według lokalizacji i okresów
      const financialDataMap = new Map<string, LocationFinancialData>();

      transactions.forEach((transaction: any) => {
        const transactionDate = new Date(transaction.date);
        const year = transactionDate.getFullYear();
        const month = transactionDate.getMonth() + 1;
        const key = `${transaction.location_id}-${year}-${month}`;
        
        if (!financialDataMap.has(key)) {
          financialDataMap.set(key, {
            location_id: transaction.location_id,
            location_name: transaction.locations.name,
            income_total: 0,
            expense_total: 0,
            balance: 0,
            period: format(transactionDate, 'MMM yyyy', { locale: pl }),
            year: year,
            month: month
          });
        }

        const locationData = financialDataMap.get(key)!;
        const amount = Number(transaction.amount) || 0;

        // Klasyfikuj jako przychody lub koszty na podstawie kont
        // Konta 7xx to przychody, 4xx to koszty
        const debitAccountNumber = transaction.debit_account?.number || '';
        const creditAccountNumber = transaction.credit_account?.number || '';

        if (creditAccountNumber.startsWith('7')) {
          // Kredyt na koncie 7xx = przychód
          locationData.income_total += amount;
        } else if (debitAccountNumber.startsWith('4')) {
          // Debet na koncie 4xx = koszt
          locationData.expense_total += amount;
        }

        locationData.balance = locationData.income_total - locationData.expense_total;
      });

      const processedFinancialData = Array.from(financialDataMap.values());
      console.log('DEBUG: Przetworzone dane finansowe:', processedFinancialData);
      setFinancialData(processedFinancialData);

      // Przygotuj dane do wykresów
      const chartDataMap = new Map<string, any>();
      processedFinancialData.forEach(item => {
        const key = `${item.year}-${item.month.toString().padStart(2, '0')}`;
        const monthName = format(new Date(item.year, item.month - 1, 1), 'MMM yyyy', { locale: pl });
        
        if (!chartDataMap.has(key)) {
          chartDataMap.set(key, {
            period: monthName,
            year: item.year,
            month: item.month
          });
        }
        
        const existing = chartDataMap.get(key);
        existing[`${item.location_name}_income`] = item.income_total;
        existing[`${item.location_name}_expense`] = item.expense_total;
        existing[`${item.location_name}_balance`] = item.balance;
      });

      const sortedChartData = Array.from(chartDataMap.values()).sort((a, b) => {
        if (a.year !== b.year) return a.year - b.year;
        return a.month - b.month;
      });

      console.log('DEBUG: Dane do wykresów:', sortedChartData);
      setChartData(sortedChartData);

      // Przygotuj dane porównawcze
      generateComparisonData(processedFinancialData);

    } catch (error) {
      console.error('DEBUG: Błąd podczas pobierania danych finansowych:', error);
      toast({
        title: "Błąd",
        description: "Nie udało się pobrać danych finansowych",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const generateComparisonData = (data: LocationFinancialData[]) => {
    const currentYear = parseInt(selectedYear);
    const currentMonth = new Date().getMonth() + 1;
    
    // Grupuj dane według lokalizacji
    const locationMap = new Map<string, LocationFinancialData[]>();
    data.forEach(item => {
      if (!locationMap.has(item.location_name)) {
        locationMap.set(item.location_name, []);
      }
      locationMap.get(item.location_name)!.push(item);
    });

    const comparison: ComparisonData[] = [];
    
    locationMap.forEach((items, locationName) => {
      let currentPeriodValue = 0;
      let previousPeriodValue = 0;

      if (selectedComparison === 'month_over_month') {
        // Porównanie miesiąc do miesiąca
        const currentMonthData = items.find(item => 
          item.year === currentYear && item.month === currentMonth
        );
        const previousMonthData = items.find(item => 
          (item.year === currentYear && item.month === currentMonth - 1) ||
          (item.year === currentYear - 1 && item.month === 12 && currentMonth === 1)
        );

        currentPeriodValue = currentMonthData ? getMetricValue(currentMonthData, selectedMetric) : 0;
        previousPeriodValue = previousMonthData ? getMetricValue(previousMonthData, selectedMetric) : 0;
      } else {
        // Porównanie rok do roku
        const currentYearData = items.filter(item => item.year === currentYear);
        const previousYearData = items.filter(item => item.year === currentYear - 1);

        currentPeriodValue = currentYearData.reduce((sum, item) => sum + getMetricValue(item, selectedMetric), 0);
        previousPeriodValue = previousYearData.reduce((sum, item) => sum + getMetricValue(item, selectedMetric), 0);
      }

      const change = currentPeriodValue - previousPeriodValue;
      const changePercent = previousPeriodValue !== 0 ? (change / Math.abs(previousPeriodValue)) * 100 : 0;

      comparison.push({
        location: locationName,
        current_period: currentPeriodValue,
        previous_period: previousPeriodValue,
        change: change,
        change_percent: changePercent
      });
    });

    setComparisonData(comparison);
  };

  const getMetricValue = (data: LocationFinancialData, metric: 'income' | 'expense' | 'balance'): number => {
    switch (metric) {
      case 'income': return data.income_total;
      case 'expense': return data.expense_total;
      case 'balance': return data.balance;
      default: return 0;
    }
  };

  const getMetricLabel = (metric: 'income' | 'expense' | 'balance'): string => {
    switch (metric) {
      case 'income': return 'Dochody';
      case 'expense': return 'Wydatki';
      case 'balance': return 'Bilans';
      default: return '';
    }
  };

  useEffect(() => {
    fetchFinancialData();
  }, [user]);

  useEffect(() => {
    if (financialData.length > 0) {
      generateComparisonData(financialData);
    }
  }, [selectedComparison, selectedMetric, selectedYear, financialData]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pl-PL', {
      style: 'currency',
      currency: 'PLN',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const getChangeColor = (change: number, metric: string) => {
    if (change === 0) return 'text-gray-500';
    if (metric === 'expense') {
      // Dla wydatków: wzrost = źle (czerwony), spadek = dobrze (zielony)
      return change > 0 ? 'text-red-600' : 'text-green-600';
    } else {
      // Dla dochodów i bilansu: wzrost = dobrze (zielony), spadek = źle (czerwony)
      return change > 0 ? 'text-green-600' : 'text-red-600';
    }
  };

  // Oblicz łączne sumy dla kart podsumowujących
  const totalIncome = financialData.reduce((sum, item) => sum + item.income_total, 0);
  const totalExpense = financialData.reduce((sum, item) => sum + item.expense_total, 0);
  const totalBalance = totalIncome - totalExpense;

  if (loading) {
    return (
      <MainLayout>
        <div className="flex justify-center items-center h-64">
          <Spinner size="lg" />
        </div>
      </MainLayout>
    );
  }

  if (!financialData.length) {
    return (
      <MainLayout>
        <PageTitle 
          title="Wizualizacja danych" 
          subtitle="Analiza finansowa na podstawie transakcji"
        />
        <div className="bg-white p-8 rounded-lg shadow-sm text-center">
          <div className="text-center space-y-4">
            <p className="text-omi-gray-500">Brak danych transakcji do wyświetlenia.</p>
            <div className="text-sm text-gray-600 space-y-2">
              <p>Możliwe przyczyny:</p>
              <ul className="list-disc list-inside text-left max-w-md mx-auto">
                <li>Brak transakcji w systemie</li>
                <li>Transakcje nie mają poprawnie przypisanych kont</li>
                <li>Problem z uprawnieniami dostępu do danych</li>
              </ul>
            </div>
          </div>
        </div>
      </MainLayout>
    );
  }

  // Przygotuj unikalne lokalizacje dla wykresów
  const uniqueLocations = Array.from(new Set(financialData.map(item => item.location_name)));
  const colors = ['#2563eb', '#dc2626', '#16a34a', '#ca8a04', '#9333ea', '#c2410c'];

  return (
    <MainLayout>
      <div className="space-y-6">
        <PageTitle 
          title="Wizualizacja danych" 
          subtitle={isEkonom ? "Analiza finansowa z porównaniami między miesiącami" : "Analiza finansowa z porównaniami między placówkami"}
        />

        {/* Karty podsumowujące - podobne do obrazka */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <FinancialCard
            title="Przychody"
            amount={totalIncome}
            subtitle="Suma wszystkich przychodów (konta 7xx)"
            icon={<DollarSign className="h-6 w-6" />}
            trend="up"
            trendColor="green"
          />
          <FinancialCard
            title="Rozchody"
            amount={totalExpense}
            subtitle="Suma wszystkich kosztów (konta 4xx)"
            icon={<TrendingDown className="h-6 w-6" />}
            trend="down"
            trendColor="red"
          />
          <FinancialCard
            title="Bilans"
            amount={totalBalance}
            subtitle="Przychody - Rozchody"
            icon={<BarChart3 className="h-6 w-6" />}
            trend={totalBalance >= 0 ? "up" : "down"}
            trendColor={totalBalance >= 0 ? "green" : "red"}
          />
        </div>

        {/* Filtry */}
        <div className="bg-white p-6 rounded-lg shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Calendar className="h-4 w-4 inline mr-1" />
                Okres
              </label>
              <Select value={selectedPeriod} onValueChange={(value: 'month' | 'quarter' | 'year') => setSelectedPeriod(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="month">Miesiąc</SelectItem>
                  <SelectItem value="quarter">Kwartał</SelectItem>
                  <SelectItem value="year">Rok</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Rok</label>
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {years.map(year => (
                    <SelectItem key={year} value={year}>{year}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <TrendingUp className="h-4 w-4 inline mr-1" />
                Typ porównania
              </label>
              <Select value={selectedComparison} onValueChange={(value: 'year_over_year' | 'month_over_month') => setSelectedComparison(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="month_over_month">Miesiąc do miesiąca</SelectItem>
                  <SelectItem value="year_over_year">Rok do roku</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Metryka</label>
              <Select value={selectedMetric} onValueChange={(value: 'income' | 'expense' | 'balance') => setSelectedMetric(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="income">Dochody</SelectItem>
                  <SelectItem value="expense">Wydatki</SelectItem>
                  <SelectItem value="balance">Bilans</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Tabela porównawcza */}
        <div className="bg-white p-6 rounded-lg shadow-sm">
          <h2 className="text-xl font-semibold mb-4 flex items-center">
            {isEkonom ? (
              <>
                <Calendar className="h-5 w-5 mr-2" />
                Porównanie {getMetricLabel(selectedMetric).toLowerCase()} między miesiącami
              </>
            ) : (
              <>
                <Building2 className="h-5 w-5 mr-2" />
                Porównanie {getMetricLabel(selectedMetric).toLowerCase()} między placówkami
              </>
            )}
          </h2>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{isEkonom ? 'Miesiąc' : 'Placówka'}</TableHead>
                <TableHead className="text-right">Okres bieżący</TableHead>
                <TableHead className="text-right">Okres poprzedni</TableHead>
                <TableHead className="text-right">Zmiana</TableHead>
                <TableHead className="text-right">Zmiana %</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {comparisonData.map((item, index) => (
                <TableRow key={index}>
                  <TableCell className="font-medium">{item.location}</TableCell>
                  <TableCell className="text-right">{formatCurrency(item.current_period)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(item.previous_period)}</TableCell>
                  <TableCell className={`text-right font-medium ${getChangeColor(item.change, selectedMetric)}`}>
                    {item.change > 0 ? '+' : ''}{formatCurrency(item.change)}
                  </TableCell>
                  <TableCell className={`text-right font-medium ${getChangeColor(item.change, selectedMetric)}`}>
                    {item.change_percent > 0 ? '+' : ''}{item.change_percent.toFixed(1)}%
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Wykres liniowy - Trendy czasowe dla wydatków */}
        <div className="bg-white p-6 rounded-lg shadow-sm">
          <h2 className="text-xl font-semibold mb-4">
            {isEkonom ? 'Trendy wydatków w czasie' : 'Trendy wydatków w czasie według placówek'}
          </h2>
          <ChartContainer config={chartConfig} className="h-96 w-full">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="period" 
                angle={-45}
                textAnchor="end"
                height={80}
                fontSize={12}
              />
              <YAxis 
                tickFormatter={formatCurrency}
                fontSize={12}
              />
              <ChartTooltip 
                content={<ChartTooltipContent 
                  formatter={(value: number, name: string) => [
                    formatCurrency(value), 
                    name.replace('_expense', '')
                  ]}
                />} 
              />
              <Legend />
              {uniqueLocations.map((location, index) => (
                <Line 
                  key={location}
                  type="monotone" 
                  dataKey={`${location}_expense`} 
                  stroke={colors[index % colors.length]} 
                  strokeWidth={3}
                  name={location}
                  dot={{ r: 4 }}
                />
              ))}
            </LineChart>
          </ChartContainer>
        </div>

        {/* Wykres słupkowy - Porównanie dochodów */}
        <div className="bg-white p-6 rounded-lg shadow-sm">
          <h2 className="text-xl font-semibold mb-4">
            {isEkonom ? 'Porównanie dochodów między miesiącami' : 'Porównanie dochodów między placówkami'}
          </h2>
          <ChartContainer config={chartConfig} className="h-96 w-full">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="period" 
                angle={-45}
                textAnchor="end"
                height={80}
                fontSize={12}
              />
              <YAxis 
                tickFormatter={formatCurrency}
                fontSize={12}
              />
              <ChartTooltip 
                content={<ChartTooltipContent 
                  formatter={(value: number, name: string) => [
                    formatCurrency(value), 
                    name.replace('_income', '')
                  ]}
                />} 
              />
              <Legend />
              {uniqueLocations.map((location, index) => (
                <Bar 
                  key={location}
                  dataKey={`${location}_income`} 
                  fill={colors[index % colors.length]} 
                  name={location}
                />
              ))}
            </BarChart>
          </ChartContainer>
        </div>
      </div>
    </MainLayout>
  );
};

export default DataVisualizationPage;
