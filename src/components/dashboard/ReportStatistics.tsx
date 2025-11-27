import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Loader2, TrendingUp, TrendingDown, CheckCircle, Clock, AlertCircle } from 'lucide-react';

interface ReportStats {
  total: number;
  submitted: number;
  approved: number;
  draft: number;
  pending: number;
  submissionRate: number;
  approvalRate: number;
  avgApprovalDays: number | null;
  onTimeRate: number;
}

export const ReportStatistics: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.role === 'prowincjal';

  const { data: stats, isLoading } = useQuery({
    queryKey: ['report-statistics', user?.location],
    queryFn: async () => {
      const currentYear = new Date().getFullYear();
      const currentMonth = new Date().getMonth() + 1;

      // Build query based on role
      let query = supabase
        .from('reports')
        .select('*')
        .eq('year', currentYear);

      if (!isAdmin && user?.location) {
        query = query.eq('location_id', user.location);
      }

      const { data: reports, error } = await query;

      if (error) throw error;

      // Calculate statistics
      const total = reports?.length || 0;
      const submitted = reports?.filter(r => r.status === 'submitted').length || 0;
      const approved = reports?.filter(r => r.status === 'approved').length || 0;
      const draft = reports?.filter(r => r.status === 'draft').length || 0;
      const pending = reports?.filter(r => r.status === 'pending').length || 0;

      // Submission rate (reports submitted on time / total expected)
      const expectedReports = isAdmin ? currentMonth * (await getLocationCount()) : currentMonth;
      const submissionRate = expectedReports > 0 ? ((submitted + approved) / expectedReports) * 100 : 0;

      // Approval rate
      const approvalRate = (submitted + approved) > 0 ? (approved / (submitted + approved)) * 100 : 0;

      // Calculate average approval time
      const approvedReports = reports?.filter(r => r.status === 'approved' && r.reviewed_at && r.submitted_at);
      let avgApprovalDays: number | null = null;
      if (approvedReports && approvedReports.length > 0) {
        const totalDays = approvedReports.reduce((sum, r) => {
          const submittedDate = new Date(r.submitted_at!);
          const approvedDate = new Date(r.reviewed_at!);
          return sum + Math.ceil((approvedDate.getTime() - submittedDate.getTime()) / (1000 * 60 * 60 * 24));
        }, 0);
        avgApprovalDays = Math.round(totalDays / approvedReports.length);
      }

      // On-time submission rate (submitted before 10th of following month)
      const onTimeReports = reports?.filter(r => {
        if (!r.submitted_at) return false;
        const submittedDate = new Date(r.submitted_at);
        const deadline = new Date(r.year, r.month, 10); // 10th of following month
        return submittedDate <= deadline;
      }).length || 0;

      const onTimeRate = (submitted + approved) > 0 ? (onTimeReports / (submitted + approved)) * 100 : 0;

      return {
        total,
        submitted,
        approved,
        draft,
        pending,
        submissionRate: Math.round(submissionRate),
        approvalRate: Math.round(approvalRate),
        avgApprovalDays,
        onTimeRate: Math.round(onTimeRate)
      } as ReportStats;
    },
    enabled: !!user
  });

  const getLocationCount = async () => {
    const { count } = await supabase
      .from('locations')
      .select('*', { count: 'exact', head: true });
    return count || 1;
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-48">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!stats) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CheckCircle className="h-5 w-5" />
          Statystyki raportów {new Date().getFullYear()}
        </CardTitle>
        <CardDescription>
          {isAdmin ? 'Podsumowanie dla wszystkich placówek' : 'Podsumowanie dla Twojej placówki'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Status breakdown */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="text-center p-3 bg-muted/50 rounded-lg">
            <div className="text-2xl font-bold text-primary">{stats.approved}</div>
            <div className="text-xs text-muted-foreground">Zatwierdzone</div>
          </div>
          <div className="text-center p-3 bg-muted/50 rounded-lg">
            <div className="text-2xl font-bold text-yellow-600">{stats.submitted}</div>
            <div className="text-xs text-muted-foreground">Złożone</div>
          </div>
          <div className="text-center p-3 bg-muted/50 rounded-lg">
            <div className="text-2xl font-bold text-muted-foreground">{stats.draft}</div>
            <div className="text-xs text-muted-foreground">Szkice</div>
          </div>
          <div className="text-center p-3 bg-muted/50 rounded-lg">
            <div className="text-2xl font-bold">{stats.total}</div>
            <div className="text-xs text-muted-foreground">Razem</div>
          </div>
        </div>

        {/* Key metrics */}
        <div className="space-y-4">
          {/* Submission rate */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium">Wskaźnik złożeń</span>
              <span className="text-sm text-muted-foreground flex items-center gap-1">
                {stats.submissionRate}%
                {stats.submissionRate >= 80 ? (
                  <TrendingUp className="h-4 w-4 text-green-500" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-red-500" />
                )}
              </span>
            </div>
            <Progress value={stats.submissionRate} className="h-2" />
          </div>

          {/* On-time rate */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium">Terminowość</span>
              <span className="text-sm text-muted-foreground flex items-center gap-1">
                {stats.onTimeRate}%
                {stats.onTimeRate >= 90 ? (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                ) : stats.onTimeRate >= 70 ? (
                  <Clock className="h-4 w-4 text-yellow-500" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-red-500" />
                )}
              </span>
            </div>
            <Progress value={stats.onTimeRate} className="h-2" />
          </div>

          {/* Approval rate */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium">Wskaźnik zatwierdzeń</span>
              <span className="text-sm text-muted-foreground">{stats.approvalRate}%</span>
            </div>
            <Progress value={stats.approvalRate} className="h-2" />
          </div>
        </div>

        {/* Additional info */}
        {stats.avgApprovalDays !== null && (
          <div className="flex items-center justify-between pt-4 border-t">
            <span className="text-sm text-muted-foreground">Średni czas zatwierdzenia</span>
            <Badge variant="secondary">
              {stats.avgApprovalDays} {stats.avgApprovalDays === 1 ? 'dzień' : 'dni'}
            </Badge>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ReportStatistics;
