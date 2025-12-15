import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
  LineChart,
  Line,
  ComposedChart,
  Bar,
} from 'recharts';
import { TrendingUp, TrendingDown, Minus, Calendar, BarChart3 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

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

interface MultiYearTrendsProps {
  reportData: ReportFinancialData[];
  locations: string[];
  selectedLocation?: string;
  onLocationChange?: (location: string) => void;
}

const monthNames = ['Sty', 'Lut', 'Mar', 'Kwi', 'Maj', 'Cze', 'Lip', 'Sie', 'Wrz', 'Paź', 'Lis', 'Gru'];

const yearColors: Record<number, string> = {
  2022: 'hsl(280, 70%, 50%)',
  2023: 'hsl(220, 70%, 50%)',
  2024: 'hsl(142, 70%, 45%)',
  2025: 'hsl(35, 90%, 50%)',
  2026: 'hsl(0, 70%, 50%)',
  2027: 'hsl(180, 70%, 45%)',
};

const chartConfig = {
  income: { label: "Dochody", color: "hsl(142, 76%, 36%)" },
  expense: { label: "Wydatki", color: "hsl(0, 84%, 60%)" },
  balance: { label: "Bilans", color: "hsl(221, 83%, 53%)" },
};

const MultiYearTrends: React.FC<MultiYearTrendsProps> = ({
  reportData,
  locations,
  selectedLocation,
  onLocationChange,
}) => {
  const [metric, setMetric] = useState<'income' | 'expense' | 'balance'>('expense');
  const [selectedYears, setSelectedYears] = useState<number[]>([2024, 2025]);
  const [chartType, setChartType] = useState<'line' | 'area' | 'composed'>('area');

  // Get available years from data
  const availableYears = useMemo(() => {
    const years = new Set(reportData.map(r => r.year));
    return Array.from(years).sort();
  }, [reportData]);

  // Filter data for selected location
  const filteredData = useMemo(() => {
    if (!selectedLocation || selectedLocation === 'all') {
      return reportData;
    }
    return reportData.filter(r => r.location_name === selectedLocation);
  }, [reportData, selectedLocation]);

  // Prepare monthly comparison data across years
  const monthlyTrendData = useMemo(() => {
    const monthlyData: Record<number, Record<number, { income: number; expense: number; balance: number; count: number }>> = {};
    
    filteredData.forEach(item => {
      if (!selectedYears.includes(item.year)) return;
      
      if (!monthlyData[item.month]) {
        monthlyData[item.month] = {};
      }
      if (!monthlyData[item.month][item.year]) {
        monthlyData[item.month][item.year] = { income: 0, expense: 0, balance: 0, count: 0 };
      }
      
      monthlyData[item.month][item.year].income += item.income_total;
      monthlyData[item.month][item.year].expense += item.expense_total;
      monthlyData[item.month][item.year].balance += item.balance;
      monthlyData[item.month][item.year].count += 1;
    });

    return Array.from({ length: 12 }, (_, i) => {
      const month = i + 1;
      const dataPoint: Record<string, any> = {
        month: monthNames[i],
        monthNumber: month,
      };
      
      selectedYears.forEach(year => {
        const yearData = monthlyData[month]?.[year];
        dataPoint[`income_${year}`] = yearData?.income || 0;
        dataPoint[`expense_${year}`] = yearData?.expense || 0;
        dataPoint[`balance_${year}`] = yearData?.balance || 0;
      });
      
      return dataPoint;
    });
  }, [filteredData, selectedYears]);

  // Calculate yearly totals for summary
  const yearlyTotals = useMemo(() => {
    const totals: Record<number, { income: number; expense: number; balance: number }> = {};
    
    filteredData.forEach(item => {
      if (!totals[item.year]) {
        totals[item.year] = { income: 0, expense: 0, balance: 0 };
      }
      totals[item.year].income += item.income_total;
      totals[item.year].expense += item.expense_total;
      totals[item.year].balance += item.balance;
    });

    return totals;
  }, [filteredData]);

  // Calculate year-over-year changes
  const yearOverYearChanges = useMemo(() => {
    const changes: { year: number; prevYear: number; change: number; changePercent: number }[] = [];
    
    const sortedYears = Object.keys(yearlyTotals).map(Number).sort();
    
    for (let i = 1; i < sortedYears.length; i++) {
      const currentYear = sortedYears[i];
      const prevYear = sortedYears[i - 1];
      const currentValue = yearlyTotals[currentYear]?.[metric] || 0;
      const prevValue = yearlyTotals[prevYear]?.[metric] || 0;
      const change = currentValue - prevValue;
      const changePercent = prevValue !== 0 ? (change / Math.abs(prevValue)) * 100 : 0;
      
      changes.push({ year: currentYear, prevYear, change, changePercent });
    }
    
    return changes;
  }, [yearlyTotals, metric]);

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
      return `${(value / 1000000).toFixed(1)}M`;
    } else if (Math.abs(value) >= 1000) {
      return `${(value / 1000).toFixed(0)}K`;
    }
    return `${value.toFixed(0)}`;
  };

  const getMetricLabel = (m: string) => {
    switch (m) {
      case 'income': return 'Dochody';
      case 'expense': return 'Wydatki';
      case 'balance': return 'Bilans';
      default: return '';
    }
  };

  const getTrendIcon = (change: number) => {
    if (change > 0) return <TrendingUp className="h-4 w-4" />;
    if (change < 0) return <TrendingDown className="h-4 w-4" />;
    return <Minus className="h-4 w-4" />;
  };

  const getTrendColor = (change: number, isExpense: boolean) => {
    if (change === 0) return 'text-muted-foreground';
    if (isExpense) {
      return change > 0 ? 'text-red-600' : 'text-green-600';
    }
    return change > 0 ? 'text-green-600' : 'text-red-600';
  };

  const toggleYear = (year: number) => {
    setSelectedYears(prev => {
      if (prev.includes(year)) {
        return prev.filter(y => y !== year);
      }
      return [...prev, year].sort();
    });
  };

  const renderChart = () => {
    const dataKeys = selectedYears.map(year => `${metric}_${year}`);
    
    const commonProps = {
      data: monthlyTrendData,
      margin: { top: 10, right: 30, left: 0, bottom: 0 },
    };

    const renderAreas = () => (
      <>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis dataKey="month" fontSize={12} tickLine={false} axisLine={false} />
        <YAxis tickFormatter={formatYAxisCurrency} fontSize={12} tickLine={false} axisLine={false} width={60} />
        <ChartTooltip
          content={<ChartTooltipContent
            formatter={(value: number, name: string) => {
              const year = name.split('_')[1];
              return [formatCurrency(value), `${year}`];
            }}
          />}
        />
        <Legend formatter={(value) => value.split('_')[1]} />
        {selectedYears.map((year) => (
          chartType === 'area' ? (
            <Area
              key={year}
              type="monotone"
              dataKey={`${metric}_${year}`}
              stroke={yearColors[year] || 'hsl(var(--primary))'}
              fill={yearColors[year] || 'hsl(var(--primary))'}
              fillOpacity={0.2}
              strokeWidth={2}
              name={`${getMetricLabel(metric)}_${year}`}
            />
          ) : chartType === 'line' ? (
            <Line
              key={year}
              type="monotone"
              dataKey={`${metric}_${year}`}
              stroke={yearColors[year] || 'hsl(var(--primary))'}
              strokeWidth={3}
              dot={{ r: 4 }}
              name={`${getMetricLabel(metric)}_${year}`}
            />
          ) : (
            <Bar
              key={year}
              dataKey={`${metric}_${year}`}
              fill={yearColors[year] || 'hsl(var(--primary))'}
              name={`${getMetricLabel(metric)}_${year}`}
            />
          )
        ))}
      </>
    );

    if (chartType === 'area') {
      return (
        <AreaChart {...commonProps}>
          {renderAreas()}
        </AreaChart>
      );
    } else if (chartType === 'line') {
      return (
        <LineChart {...commonProps}>
          {renderAreas()}
        </LineChart>
      );
    } else {
      return (
        <ComposedChart {...commonProps}>
          {renderAreas()}
        </ComposedChart>
      );
    }
  };

  return (
    <div className="space-y-6">
      {/* Year-over-Year Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {yearOverYearChanges.map(({ year, prevYear, change, changePercent }) => (
          <Card key={year} className="border-border">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{prevYear} → {year}</p>
                  <p className="text-lg font-bold">{getMetricLabel(metric)}</p>
                </div>
                <div className={`flex items-center gap-1 ${getTrendColor(change, metric === 'expense')}`}>
                  {getTrendIcon(change)}
                  <span className="font-semibold">{changePercent > 0 ? '+' : ''}{changePercent.toFixed(1)}%</span>
                </div>
              </div>
              <p className={`text-sm mt-2 ${getTrendColor(change, metric === 'expense')}`}>
                {change > 0 ? '+' : ''}{formatCurrency(change)}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main Trend Chart */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Trendy wieloletnie - porównanie miesięczne
            </CardTitle>
            <div className="flex flex-wrap items-center gap-4">
              {/* Location selector */}
              {locations.length > 1 && onLocationChange && (
                <Select value={selectedLocation || 'all'} onValueChange={onLocationChange}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Lokalizacja" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Wszystkie</SelectItem>
                    {locations.map(loc => (
                      <SelectItem key={loc} value={loc}>{loc}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {/* Metric selector */}
              <Select value={metric} onValueChange={(v: 'income' | 'expense' | 'balance') => setMetric(v)}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="income">Dochody</SelectItem>
                  <SelectItem value="expense">Wydatki</SelectItem>
                  <SelectItem value="balance">Bilans</SelectItem>
                </SelectContent>
              </Select>

              {/* Chart type selector */}
              <Select value={chartType} onValueChange={(v: 'line' | 'area' | 'composed') => setChartType(v)}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="area">Obszarowy</SelectItem>
                  <SelectItem value="line">Liniowy</SelectItem>
                  <SelectItem value="composed">Słupkowy</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Year checkboxes */}
          <div className="flex flex-wrap items-center gap-4 mt-4">
            <span className="text-sm text-muted-foreground">Lata:</span>
            {availableYears.map(year => (
              <div key={year} className="flex items-center gap-2">
                <Checkbox
                  id={`year-${year}`}
                  checked={selectedYears.includes(year)}
                  onCheckedChange={() => toggleYear(year)}
                />
                <Label htmlFor={`year-${year}`} className="flex items-center gap-1">
                  <span
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: yearColors[year] || 'hsl(var(--primary))' }}
                  />
                  {year}
                </Label>
              </div>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="h-[400px] w-full">
            {renderChart()}
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Yearly Totals Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Podsumowanie roczne
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-2 font-semibold">Rok</th>
                  <th className="text-right py-3 px-2 font-semibold">Dochody</th>
                  <th className="text-right py-3 px-2 font-semibold">Wydatki</th>
                  <th className="text-right py-3 px-2 font-semibold">Bilans</th>
                  <th className="text-right py-3 px-2 font-semibold">Zmiana r/r</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(yearlyTotals)
                  .sort(([a], [b]) => Number(a) - Number(b))
                  .map(([year, totals], index, arr) => {
                    const prevTotals = index > 0 ? arr[index - 1][1] : null;
                    const expenseChange = prevTotals 
                      ? ((totals.expense - prevTotals.expense) / Math.abs(prevTotals.expense) * 100) 
                      : 0;
                    
                    return (
                      <tr key={year} className="border-b border-border hover:bg-muted/50">
                        <td className="py-3 px-2 font-medium">
                          <div className="flex items-center gap-2">
                            <span
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: yearColors[Number(year)] || 'hsl(var(--primary))' }}
                            />
                            {year}
                          </div>
                        </td>
                        <td className="text-right py-3 px-2 text-green-600">
                          {formatCurrency(totals.income)}
                        </td>
                        <td className="text-right py-3 px-2 text-red-600">
                          {formatCurrency(totals.expense)}
                        </td>
                        <td className={`text-right py-3 px-2 font-medium ${totals.balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {formatCurrency(totals.balance)}
                        </td>
                        <td className="text-right py-3 px-2">
                          {index > 0 ? (
                            <Badge variant={expenseChange > 0 ? 'destructive' : 'secondary'} className="font-normal">
                              {expenseChange > 0 ? '+' : ''}{expenseChange.toFixed(1)}%
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default MultiYearTrends;
