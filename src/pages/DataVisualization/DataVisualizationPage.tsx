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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import MultiYearTrends from './MultiYearTrends';

interface ReportFinancialData {
  location_id: string;
  location_name: string;
  income_total: number;
  expense_total: number;
  balance: number;
  period: string;
  year: number;
  month: number;
  report_id: string;
  status: string;
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
  const [reportData, setReportData] = useState<ReportFinancialData[]>([]);
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [comparisonData, setComparisonData] = useState<ComparisonData[]>([]);
  
  // Filtry
  const [selectedPeriod, setSelectedPeriod] = useState<'month' | 'quarter' | 'year'>('month');
  const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString());
  const [selectedComparison, setSelectedComparison] = useState<'year_over_year' | 'month_over_month'>('month_over_month');
  const [selectedMetric, setSelectedMetric] = useState<'income' | 'expense' | 'balance'>('expense');
  const [activeTab, setActiveTab] = useState<'overview' | 'trends'>('overview');
  const [trendLocation, setTrendLocation] = useState<string>('all');

  const years = ['2022', '2023', '2024', '2025', '2026', '2027'];

  // Sprawdź czy użytkownik to ekonom (widzi tylko swoją placówkę)
  const isEkonom = user?.role === 'ekonom';

  const fetchReportData = async () => {
    setLoading(true);
    try {
      console.log('=== DEBUG: Rozpoczęcie pobierania danych z raportów ===');
      
      // Używamy tej samej logiki co w ReportsList - najpierw pobieramy raporty
      const { data: userRole } = await supabase.rpc('get_user_role');
      console.log('Rola użytkownika:', userRole);
      
      let query = supabase.from('reports').select(`
        *,
        location:locations(name),
        submitted_by_profile:profiles!submitted_by(name),
        reviewed_by_profile:profiles!reviewed_by(name)
      `)
      .in('status', ['submitted', 'approved'])
      .order('year', { ascending: true })
      .order('month', { ascending: true });

      // Filtruj według uprawnień użytkownika
      if (userRole === 'ekonom') {
        const { data: locationId } = await supabase.rpc('get_user_location_id');
        console.log('ID lokalizacji użytkownika:', locationId);
        
        if (locationId) {
          query = query.eq('location_id', locationId);
        }
      }

      const { data: reportsData, error: reportsError } = await query;

      console.log('DEBUG: Pobrane raporty:', reportsData);
      console.log('DEBUG: Błąd raportów:', reportsError);

      if (reportsError) {
        throw reportsError;
      }

      if (!reportsData || reportsData.length === 0) {
        console.log('DEBUG: Brak raportów w systemie');
        setReportData([]);
        setChartData([]);
        setComparisonData([]);
        return;
      }

      // Pobierz szczegóły finansowe dla wszystkich raportów w osobnym zapytaniu
      const reportIds = reportsData.map(report => report.id);
      const { data: reportDetails, error: detailsError } = await supabase
        .from('report_details')
        .select('*')
        .in('report_id', reportIds);

      if (detailsError) {
        console.error('Błąd pobierania szczegółów raportów:', detailsError);
        throw detailsError;
      }

      console.log('DEBUG: Pobrane szczegóły raportów:', reportDetails);

      if (!reportDetails || reportDetails.length === 0) {
        console.log('DEBUG: Brak szczegółów finansowych dla raportów');
        setReportData([]);
        setChartData([]);
        setComparisonData([]);
        return;
      }

      // Stwórz mapę szczegółów według report_id
      const detailsMap = new Map();
      reportDetails.forEach(detail => {
        detailsMap.set(detail.report_id, detail);
      });

      // Połącz raporty ze szczegółami i przekształć dane
      const transformedReportData: ReportFinancialData[] = [];
      
      reportsData.forEach((report: any) => {
        const details = detailsMap.get(report.id);
        if (details) {
          transformedReportData.push({
            location_id: report.location_id,
            location_name: report.location?.name || 'Nieznana',
            income_total: Number(details.income_total) || 0,
            expense_total: Number(details.expense_total) || 0,
            balance: Number(details.balance) || 0,
            period: report.period,
            year: report.year,
            month: report.month,
            report_id: report.id,
            status: report.status
          });
        }
      });

      console.log('DEBUG: Przetworzone dane raportów:', transformedReportData);
      setReportData(transformedReportData);

      // Przygotuj dane do wykresów
      const chartDataMap = new Map<string, any>();
      transformedReportData.forEach(item => {
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
        const locationKey = item.location_name.replace(/[^a-zA-Z0-9]/g, '');
        existing[`${locationKey}Income`] = item.income_total;
        existing[`${locationKey}Expense`] = item.expense_total;
        existing[`${locationKey}Balance`] = item.balance;
      });

      const sortedChartData = Array.from(chartDataMap.values()).sort((a, b) => {
        if (a.year !== b.year) return a.year - b.year;
        return a.month - b.month;
      });

      console.log('DEBUG: Dane do wykresów:', sortedChartData);
      setChartData(sortedChartData);

      // Przygotuj dane porównawcze
      generateComparisonData(transformedReportData);

    } catch (error) {
      console.error('DEBUG: Błąd podczas pobierania danych raportów:', error);
      toast({
        title: "Błąd",
        description: "Nie udało się pobrać danych z raportów",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const generateComparisonData = (data: ReportFinancialData[]) => {
    const currentYear = parseInt(selectedYear);
    const currentMonth = new Date().getMonth() + 1;
    
    // Grupuj dane według lokalizacji
    const locationMap = new Map<string, ReportFinancialData[]>();
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

  const getMetricValue = (data: ReportFinancialData, metric: 'income' | 'expense' | 'balance'): number => {
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
    fetchReportData();
  }, [user]);

  useEffect(() => {
    if (reportData.length > 0) {
      generateComparisonData(reportData);
    }
  }, [selectedComparison, selectedMetric, selectedYear, reportData]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pl-PL', {
      style: 'currency',
      currency: 'PLN',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatYAxisCurrency = (value: number) => {
    if (Math.abs(value) >= 1000000) {
      return `${(value / 1000000).toFixed(1)}M zł`;
    } else if (Math.abs(value) >= 1000) {
      return `${(value / 1000).toFixed(1)}K zł`;
    } else {
      return `${value.toFixed(0)} zł`;
    }
  };

  const generateYAxisTicks = (data: ChartData[], metric: string) => {
    if (!data.length) return [];
    
    let min = Infinity;
    let max = -Infinity;
    
    data.forEach(item => {
      uniqueLocations.forEach(location => {
        const key = getSafeKey(location, metric);
        const value = item[key] as number;
        if (typeof value === 'number') {
          min = Math.min(min, value);
          max = Math.max(max, value);
        }
      });
    });

    if (min === Infinity || max === -Infinity) return [];

    const margin = (max - min) * 0.1;
    const adjustedMin = Math.max(0, min - margin);
    const adjustedMax = max + margin;

    const tickCount = 6;
    const step = (adjustedMax - adjustedMin) / (tickCount - 1);
    
    const ticks = [];
    for (let i = 0; i < tickCount; i++) {
      ticks.push(adjustedMin + (step * i));
    }
    
    return ticks;
  };

  const getChangeColor = (change: number, metric: string) => {
    if (change === 0) return 'text-gray-500';
    if (metric === 'expense') {
      return change > 0 ? 'text-red-600' : 'text-green-600';
    } else {
      return change > 0 ? 'text-green-600' : 'text-red-600';
    }
  };

  // Oblicz łączne sumy dla kart podsumowujących
  const totalIncome = reportData.reduce((sum, item) => sum + item.income_total, 0);
  const totalExpense = reportData.reduce((sum, item) => sum + item.expense_total, 0);
  const totalBalance = totalIncome - totalExpense;

  const getSafeKey = (locationName: string, metric: string) => {
    const safeLocationName = locationName.replace(/[^a-zA-Z0-9]/g, '');
    const capitalizedMetric = metric.charAt(0).toUpperCase() + metric.slice(1);
    return `${safeLocationName}${capitalizedMetric}`;
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="flex justify-center items-center h-64">
          <Spinner size="lg" />
        </div>
      </MainLayout>
    );
  }

  if (!reportData.length) {
    return (
      <MainLayout>
        <PageTitle 
          title="Wizualizacja danych" 
          subtitle="Analiza finansowa na podstawie zatwierdzonych raportów"
        />
        <div className="bg-white p-8 rounded-lg shadow-sm text-center">
          <div className="text-center space-y-4">
            <p className="text-omi-gray-500">Brak zatwierdzonych raportów do wyświetlenia.</p>
            <div className="text-sm text-gray-600 space-y-2">
              <p>Możliwe przyczyny:</p>
              <ul className="list-disc list-inside text-left max-w-md mx-auto">
                <li>Brak złożonych lub zatwierdzonych raportów w systemie</li>
                <li>Raporty nie mają obliczonych danych finansowych</li>
                <li>Problem z uprawnieniami dostępu do danych</li>
              </ul>
            </div>
          </div>
        </div>
      </MainLayout>
    );
  }

  const uniqueLocations = Array.from(new Set(reportData.map(item => item.location_name)));
  const colors = ['#2563eb', '#dc2626', '#16a34a', '#ca8a04', '#9333ea', '#c2410c'];

  const expenseYAxisTicks = generateYAxisTicks(chartData, 'expense');
  const incomeYAxisTicks = generateYAxisTicks(chartData, 'income');

  return (
    <MainLayout>
      <div className="space-y-6">
        <PageTitle 
          title="Wizualizacja danych" 
          subtitle={isEkonom ? "Analiza finansowa na podstawie raportów z porównaniami między miesiącami" : "Analiza finansowa na podstawie raportów z porównaniami między placówkami"}
        />

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'overview' | 'trends')}>
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="overview">Przegląd</TabsTrigger>
            <TabsTrigger value="trends">Trendy wieloletnie</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6 mt-6">
            {/* Karty podsumowujące */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <FinancialCard
                title="Przychody (raporty)"
                amount={totalIncome}
                subtitle="Suma wszystkich przychodów z zatwierdzonych raportów"
                icon={<DollarSign className="h-6 w-6" />}
                trend="up"
                trendColor="green"
              />
              <FinancialCard
                title="Rozchody (raporty)"
                amount={totalExpense}
                subtitle="Suma wszystkich kosztów z zatwierdzonych raportów"
                icon={<TrendingDown className="h-6 w-6" />}
                trend="down"
                trendColor="red"
              />
              <FinancialCard
                title="Bilans (raporty)"
                amount={totalBalance}
                subtitle="Przychody - Rozchody z raportów"
                icon={<BarChart3 className="h-6 w-6" />}
                trend={totalBalance >= 0 ? "up" : "down"}
                trendColor={totalBalance >= 0 ? "green" : "red"}
              />
            </div>

            {/* Filtry */}
            <div className="bg-card p-6 rounded-lg shadow-sm border border-border">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
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
                  <label className="block text-sm font-medium text-foreground mb-2">Rok</label>
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
                  <label className="block text-sm font-medium text-foreground mb-2">
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
                  <label className="block text-sm font-medium text-foreground mb-2">Metryka</label>
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
            <div className="bg-card p-6 rounded-lg shadow-sm border border-border">
              <h2 className="text-xl font-semibold mb-4 flex items-center">
                {isEkonom ? (
                  <>
                    <Calendar className="h-5 w-5 mr-2" />
                    Porównanie {getMetricLabel(selectedMetric).toLowerCase()} między miesiącami (na podstawie raportów)
                  </>
                ) : (
                  <>
                    <Building2 className="h-5 w-5 mr-2" />
                    Porównanie {getMetricLabel(selectedMetric).toLowerCase()} między placówkami (na podstawie raportów)
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
            <div className="bg-card p-6 rounded-lg shadow-sm border border-border">
              <h2 className="text-xl font-semibold mb-4">
                {isEkonom ? 'Trendy wydatków w czasie (z raportów)' : 'Trendy wydatków w czasie według placówek (z raportów)'}
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
                    tickFormatter={formatYAxisCurrency}
                    fontSize={12}
                    domain={['dataMin - dataMin*0.1', 'dataMax + dataMax*0.1']}
                    ticks={expenseYAxisTicks}
                    type="number"
                  />
                  <ChartTooltip 
                    content={<ChartTooltipContent 
                      formatter={(value: number, name: string) => [
                        formatCurrency(value), 
                        name.replace(/([A-Z])/g, ' $1').replace('Expense', ' (wydatki)')
                      ]}
                    />} 
                  />
                  <Legend />
                  {uniqueLocations.map((location, index) => {
                    const expenseKey = getSafeKey(location, 'expense');
                    return (
                      <Line 
                        key={location}
                        type="monotone" 
                        dataKey={expenseKey}
                        stroke={colors[index % colors.length]} 
                        strokeWidth={3}
                        name={location}
                        dot={{ r: 4 }}
                      />
                    );
                  })}
                </LineChart>
              </ChartContainer>
            </div>

            {/* Wykres słupkowy - Porównanie dochodów */}
            <div className="bg-card p-6 rounded-lg shadow-sm border border-border">
              <h2 className="text-xl font-semibold mb-4">
                {isEkonom ? 'Porównanie dochodów między miesiącami (z raportów)' : 'Porównanie dochodów między placówkami (z raportów)'}
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
                    tickFormatter={formatYAxisCurrency}
                    fontSize={12}
                    domain={['dataMin - dataMin*0.1', 'dataMax + dataMax*0.1']}
                    ticks={incomeYAxisTicks}
                    type="number"
                  />
                  <ChartTooltip 
                    content={<ChartTooltipContent 
                      formatter={(value: number, name: string) => [
                        formatCurrency(value), 
                        name.replace(/([A-Z])/g, ' $1').replace('Income', ' (dochody)')
                      ]}
                    />} 
                  />
                  <Legend />
                  {uniqueLocations.map((location, index) => {
                    const incomeKey = getSafeKey(location, 'income');
                    return (
                      <Bar 
                        key={location}
                        dataKey={incomeKey}
                        fill={colors[index % colors.length]} 
                        name={location}
                      />
                    );
                  })}
                </BarChart>
              </ChartContainer>
            </div>
          </TabsContent>

          <TabsContent value="trends" className="mt-6">
            <MultiYearTrends
              reportData={reportData}
              locations={uniqueLocations}
              selectedLocation={trendLocation}
              onLocationChange={setTrendLocation}
            />
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
};

export default DataVisualizationPage;
