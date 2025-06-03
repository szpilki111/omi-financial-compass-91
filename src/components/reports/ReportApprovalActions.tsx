
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, XCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Spinner } from '@/components/ui/Spinner';

interface ReportApprovalActionsProps {
  reportId: string;
  onApprovalComplete: () => void;
}

const ReportApprovalActions: React.FC<ReportApprovalActionsProps> = ({
  reportId,
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

      const successMessage = action === 'approved' 
        ? "Raport został zaakceptowany pomyślnie" 
        : "Raport został odesłany do poprawek";

      toast({
        title: action === 'approved' ? "Raport zaakceptowany" : "Raport wymaga poprawek",
        description: successMessage,
      });

      // Wyczyść komentarze po pomyślnej akcji
      setComments('');
      
      // Wywołaj callback
      onApprovalComplete();
      
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
