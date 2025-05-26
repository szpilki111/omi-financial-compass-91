
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

  const handleApproval = async (action: 'approved' | 'rejected') => {
    setIsProcessing(true);
    
    try {
      const { data: user } = await supabase.auth.getUser();
      
      if (!user.user) {
        throw new Error('Użytkownik nie jest zalogowany');
      }

      const { error } = await supabase
        .from('reports')
        .update({
          status: action,
          reviewed_at: new Date().toISOString(),
          reviewed_by: user.user.id,
          comments: comments || null
        })
        .eq('id', reportId);

      if (error) throw error;

      toast({
        title: action === 'approved' ? "Raport zaakceptowany" : "Raport odrzucony",
        description: `Raport został ${action === 'approved' ? 'zaakceptowany' : 'odrzucony'} pomyślnie.`,
      });

      onApprovalComplete();
    } catch (error) {
      console.error('Błąd podczas zatwierdzania raportu:', error);
      toast({
        title: "Błąd",
        description: "Wystąpił problem podczas przetwarzania raportu.",
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
            onClick={() => handleApproval('rejected')}
            disabled={isProcessing}
            variant="destructive"
            className="flex items-center gap-2"
          >
            {isProcessing ? (
              <Spinner size="sm" />
            ) : (
              <XCircle size={16} />
            )}
            Odrzuć
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default ReportApprovalActions;
