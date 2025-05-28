
import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import MainLayout from '@/components/layout/MainLayout';
import PageTitle from '@/components/ui/PageTitle';
import { Spinner } from '@/components/ui/Spinner';
import { useToast } from '@/hooks/use-toast';
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
import { Calendar, TrendingUp, Building2 } from 'lucide-react';

interface LocationData {
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
  const [locationData, setLocationData] = useState<LocationData[]>([]);
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [comparisonData, setComparisonData] = useState<ComparisonData[]>([]);
  
  // Filtry
  const [selectedPeriod, setSelectedPeriod] = useState<'month' | 'quarter' | 'year'>('month');
  const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString());
  const [selectedComparison, setSelectedComparison] = useState<'year_over_year' | 'month_over_month'>('month_over_month');
  const [selectedMetric, setSelectedMetric] = useState<'income' | 'expense' | 'balance'>('expense');

  const years = ['2024', '2025', '2026'];

  const fetchVisualizationData = async () => {
    setLoading(true);
    try {
      // Sprawdź rolę użytkownika
      const { data: userRole } = await supabase.rpc('get_user_role');
      
      let query = supabase
        .from('reports')
        .select(`
          month,
          year,
          period,
          location_id,
          locations!inner(name),
          report_details!inner(
            income_total,
            expense_total,
            balance
          )
        `)
        .eq('status', 'accepted');

      // Jeśli użytkownik jest ekonomem, pobierz tylko dane jego placówki
      if (userRole === 'ekonom') {
        const { data: locationId } = await supabase.rpc('get_user_location_id');
        if (locationId) {
          query = query.eq('location_id', locationId);
        }
      }

      const { data: reports, error } = await query.order('year', { ascending: true }).order('month', { ascending: true });

      if (error) {
        throw error;
      }

      console.log('Pobrane raporty:', reports);

      // Przetwórz dane dla tabeli lokalizacji
      const processedLocationData: LocationData[] = reports?.map((report: any) => ({
        location_id: report.location_id,
        location_name: report.locations.name,
        income_total: Number(report.report_details.income_total) || 0,
        expense_total: Number(report.report_details.expense_total) || 0,
        balance: Number(report.report_details.balance) || 0,
        period: report.period,
        year: report.year,
        month: report.month
      })) || [];

      setLocationData(processedLocationData);

      // Przygotuj dane do wykresów
      const chartDataMap = new Map<string, any>();
      processedLocationData.forEach(item => {
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

      setChartData(sortedChartData);

      // Przygotuj dane porównawcze
      generateComparisonData(processedLocationData);

    } catch (error) {
      console.error('Błąd podczas pobierania danych wizualizacji:', error);
      toast({
        title: "Błąd",
        description: "Nie udało się pobrać danych do wizualizacji",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const generateComparisonData = (data: LocationData[]) => {
    const currentYear = parseInt(selectedYear);
    const currentMonth = new Date().getMonth() + 1;
    
    // Grupuj dane według lokalizacji
    const locationMap = new Map<string, LocationData[]>();
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

  const getMetricValue = (data: LocationData, metric: 'income' | 'expense' | 'balance'): number => {
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
    fetchVisualizationData();
  }, [user]);

  useEffect(() => {
    if (locationData.length > 0) {
      generateComparisonData(locationData);
    }
  }, [selectedComparison, selectedMetric, selectedYear, locationData]);

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

  if (loading) {
    return (
      <MainLayout>
        <div className="flex justify-center items-center h-64">
          <Spinner size="lg" />
        </div>
      </MainLayout>
    );
  }

  if (!locationData.length) {
    return (
      <MainLayout>
        <PageTitle 
          title="Wizualizacja danych" 
          subtitle="Analiza finansowa na podstawie zaakceptowanych raportów"
        />
        <div className="bg-white p-8 rounded-lg shadow-sm text-center">
          <p className="text-omi-gray-500">Brak danych do wyświetlenia. Upewnij się, że istnieją zaakceptowane raporty.</p>
        </div>
      </MainLayout>
    );
  }

  // Przygotuj unikalne lokalizacje dla wykresów
  const uniqueLocations = Array.from(new Set(locationData.map(item => item.location_name)));
  const colors = ['#2563eb', '#dc2626', '#16a34a', '#ca8a04', '#9333ea', '#c2410c'];

  return (
    <MainLayout>
      <div className="space-y-6">
        <PageTitle 
          title="Wizualizacja danych" 
          subtitle="Analiza finansowa z porównaniami między placówkami"
        />

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
            <Building2 className="h-5 w-5 mr-2" />
            Porównanie {getMetricLabel(selectedMetric).toLowerCase()} między placówkami
          </h2>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Placówka</TableHead>
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
          <h2 className="text-xl font-semibold mb-4">Trendy wydatków w czasie według placówek</h2>
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
          <h2 className="text-xl font-semibold mb-4">Porównanie dochodów między placówkami</h2>
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

        {/* Podsumowanie statystyk */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-lg shadow-sm">
            <h3 className="text-lg font-semibold text-green-600 mb-2">Łączne dochody</h3>
            <p className="text-3xl font-bold">
              {formatCurrency(locationData.reduce((sum, item) => sum + item.income_total, 0))}
            </p>
            <p className="text-sm text-omi-gray-500 mt-1">
              Wszystkie placówki
            </p>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm">
            <h3 className="text-lg font-semibold text-red-600 mb-2">Łączne wydatki</h3>
            <p className="text-3xl font-bold">
              {formatCurrency(locationData.reduce((sum, item) => sum + item.expense_total, 0))}
            </p>
            <p className="text-sm text-omi-gray-500 mt-1">
              Wszystkie placówki
            </p>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm">
            <h3 className="text-lg font-semibold text-blue-600 mb-2">Bilans końcowy</h3>
            <p className="text-3xl font-bold">
              {formatCurrency(locationData.reduce((sum, item) => sum + item.balance, 0))}
            </p>
            <p className="text-sm text-omi-gray-500 mt-1">
              Wszystkie placówki
            </p>
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default DataVisualizationPage;
