import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, XCircle, Unlock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Spinner } from '@/components/ui/Spinner';

interface ReportApprovalActionsProps {
  reportId: string;
  reportMonth: number;
  reportYear: number;
  locationId: string;
  currentStatus?: string;
  onApprovalComplete: () => void;
}

const ReportApprovalActions: React.FC<ReportApprovalActionsProps> = ({
  reportId,
  reportMonth,
  reportYear,
  locationId,
  currentStatus,
  onApprovalComplete
}) => {
  const [comments, setComments] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  const handleApproval = async (action: 'approved' | 'to_be_corrected') => {
    if (!reportId) {
      toast({
        title: "Błąd",
        description: "Brak ID raportu",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    
    try {
      console.log('Rozpoczynanie procesu zatwierdzania raportu:', reportId, 'akcja:', action);
      
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('Użytkownik nie jest zalogowany');
      }

      console.log('Użytkownik zalogowany:', user.id);

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (profileError) {
        console.error('Błąd pobierania profilu:', profileError);
        throw new Error('Nie udało się sprawdzić uprawnień użytkownika');
      }

      console.log('Rola użytkownika:', profile.role);

      if (profile.role !== 'admin' && profile.role !== 'prowincjal') {
        throw new Error('Brak uprawnień do zatwierdzania raportów. Tylko admin i prowincjał mogą zatwierdzać raporty.');
      }

      const { data: report, error: reportCheckError } = await supabase
        .from('reports')
        .select('status')
        .eq('id', reportId)
        .single();

      if (reportCheckError) {
        console.error('Błąd sprawdzania raportu:', reportCheckError);
        throw new Error('Nie udało się znaleźć raportu');
      }

      if (report.status !== 'submitted') {
        throw new Error('Raport nie jest w stanie umożliwiającym zatwierdzenie');
      }

      console.log('Aktualizowanie raportu w bazie danych...');
      
      const updateData = {
        status: action,
        reviewed_at: new Date().toISOString(),
        reviewed_by: user.id,
        comments: comments.trim() || null
      };

      console.log('Dane do aktualizacji:', updateData);

      const { error: updateError } = await supabase
        .from('reports')
        .update(updateData)
        .eq('id', reportId);

      if (updateError) {
        console.error('Błąd aktualizacji raportu:', updateError);
        throw updateError;
      }

      console.log('Raport zaktualizowany pomyślnie');

      // If report is approved, lock all documents for this period
      if (action === 'approved') {
        console.log('Blokowanie dokumentów dla okresu:', reportMonth, reportYear, locationId);
        
        // Get start and end dates of the report month (timezone-safe)
        const startDateStr = `${reportYear}-${String(reportMonth).padStart(2, '0')}-01`;
        const lastDay = new Date(reportYear, reportMonth, 0).getDate();
        const endDateStr = `${reportYear}-${String(reportMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

        // Mark documents as locked by adding validation info
        const { error: lockError } = await supabase
          .from('documents')
          .update({ 
            validation_errors: [{ type: 'locked_by_report', reportId, message: 'Dokument zablokowany - raport zatwierdzony' }]
          })
          .eq('location_id', locationId)
          .gte('document_date', startDateStr)
          .lte('document_date', endDateStr);

        if (lockError) {
          console.error('Błąd blokowania dokumentów:', lockError);
          // Don't throw - report is already approved, just log the error
          toast({
            title: "Uwaga",
            description: "Raport zatwierdzony, ale nie udało się zablokować dokumentów automatycznie.",
            variant: "default",
          });
        } else {
          console.log('Dokumenty zablokowane pomyślnie');
        }
      }

      const successMessage = action === 'approved' 
        ? "Raport został zaakceptowany pomyślnie. Dokumenty z tego okresu zostały zablokowane." 
        : "Raport został odesłany do poprawek";

      toast({
        title: action === 'approved' ? "Raport zaakceptowany" : "Raport wymaga poprawek",
        description: successMessage,
      });

      // Wyczyść komentarze po pomyślnej akcji
      setComments('');
      
      // Wywołaj callback - to powinno odświeżyć dane bez pełnego reload strony
      onApprovalComplete();
      window.location.reload();
    } catch (error) {
      console.error('Błąd podczas zatwierdzania raportu:', error);
      
      let errorMessage = "Wystąpił problem podczas przetwarzania raportu.";
      
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      toast({
        title: "Błąd",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle unlocking an approved report
  const handleUnlock = async () => {
    if (!reportId) return;

    setIsProcessing(true);
    
    try {
      console.log('Odblokowywanie raportu:', reportId);
      
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('Użytkownik nie jest zalogowany');
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (profileError || profile.role !== 'admin') {
        throw new Error('Tylko administrator może odblokować zatwierdzony raport');
      }

      // Update report status to draft
      const { error: updateError } = await supabase
        .from('reports')
        .update({
          status: 'draft',
          reviewed_at: null,
          reviewed_by: null,
          comments: null
        })
        .eq('id', reportId);

      if (updateError) {
        console.error('Błąd odblokowywania raportu:', updateError);
        throw updateError;
      }

      // Unlock documents for this period
      // Timezone-safe date construction
      const startDateStr = `${reportYear}-${String(reportMonth).padStart(2, '0')}-01`;
      const lastDay = new Date(reportYear, reportMonth, 0).getDate();
      const endDateStr = `${reportYear}-${String(reportMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

      const { error: unlockError } = await supabase
        .from('documents')
        .update({ validation_errors: null })
        .eq('location_id', locationId)
        .gte('document_date', startDateStr)
        .lte('document_date', endDateStr);

      if (unlockError) {
        console.error('Błąd odblokowywania dokumentów:', unlockError);
      }

      toast({
        title: "Raport odblokowany",
        description: "Raport został przywrócony do statusu roboczego. Dokumenty z tego okresu zostały odblokowane.",
      });

      onApprovalComplete();
      window.location.reload();
    } catch (error) {
      console.error('Błąd podczas odblokowywania raportu:', error);
      
      toast({
        title: "Błąd",
        description: error instanceof Error ? error.message : "Wystąpił problem podczas odblokowywania raportu.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Show unlock button for approved reports (admin only)
  if (currentStatus === 'approved') {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Zarządzanie raportem</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Ten raport został zatwierdzony. Jako administrator możesz go odblokować, aby umożliwić poprawki.
          </p>
          <Button
            onClick={handleUnlock}
            disabled={isProcessing}
            variant="outline"
            className="flex items-center gap-2"
          >
            {isProcessing ? (
              <Spinner size="sm" />
            ) : (
              <Unlock size={16} />
            )}
            Odblokuj raport do edycji
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Zatwierdź raport</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">
            Komentarze (opcjonalne)
          </label>
          <Textarea
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            placeholder="Dodaj komentarz do raportu..."
            rows={3}
            disabled={isProcessing}
          />
        </div>
        
        <div className="flex gap-2">
          <Button
            onClick={() => handleApproval('approved')}
            disabled={isProcessing}
            className="flex items-center gap-2 bg-green-600 hover:bg-green-700"
          >
            {isProcessing ? (
              <Spinner size="sm" />
            ) : (
              <CheckCircle size={16} />
            )}
            Akceptuj
          </Button>
          
          <Button
            onClick={() => handleApproval('to_be_corrected')}
            disabled={isProcessing}
            variant="destructive"
            className="flex items-center gap-2"
          >
            {isProcessing ? (
              <Spinner size="sm" />
            ) : (
              <XCircle size={16} />
            )}
            Do poprawy
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default ReportApprovalActions;
