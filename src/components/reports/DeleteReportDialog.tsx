
import React from 'react';
import {
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface DeleteReportDialogProps {
  reportId: string;
  reportTitle: string;
  onReportDeleted: () => void;
}

const DeleteReportDialog: React.FC<DeleteReportDialogProps> = ({
  reportId,
  reportTitle,
  onReportDeleted,
}) => {
  const { toast } = useToast();
  const [isDeleting, setIsDeleting] = React.useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    console.log('🗑️ Usuwanie raportu:', reportId);

    try {
      // Usuń szczegóły raportu
      const { error: detailsError } = await supabase
        .from('report_details')
        .delete()
        .eq('report_id', reportId);

      if (detailsError) {
        console.error('❌ Błąd usuwania szczegółów raportu:', detailsError);
        throw detailsError;
      }

      // Usuń wpisy raportu
      const { error: entriesError } = await supabase
        .from('report_entries')
        .delete()
        .eq('report_id', reportId);

      if (entriesError) {
        console.error('❌ Błąd usuwania wpisów raportu:', entriesError);
        throw entriesError;
      }

      // Usuń szczegóły kont raportu
      const { error: accountDetailsError } = await supabase
        .from('report_account_details')
        .delete()
        .eq('report_id', reportId);

      if (accountDetailsError) {
        console.error('❌ Błąd usuwania szczegółów kont raportu:', accountDetailsError);
        throw accountDetailsError;
      }

      // Usuń sam raport
      const { error: reportError } = await supabase
        .from('reports')
        .delete()
        .eq('id', reportId);

      if (reportError) {
        console.error('❌ Błąd usuwania raportu:', reportError);
        throw reportError;
      }

      console.log('✅ Raport został usunięty pomyślnie');
      
      toast({
        title: "Sukces",
        description: "Raport został usunięty pomyślnie.",
        variant: "default",
      });

      onReportDeleted();

    } catch (error) {
      console.error('❌ BŁĄD PODCZAS USUWANIA RAPORTU:', error);
      toast({
        title: "Błąd",
        description: "Wystąpił problem podczas usuwania raportu.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>Usuń raport</AlertDialogTitle>
        <AlertDialogDescription>
          Czy na pewno chcesz usunąć raport "{reportTitle}"?
          <br />
          <br />
          Ta operacja jest nieodwracalna i usunie wszystkie dane związane z tym raportem.
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel disabled={isDeleting}>
          Anuluj
        </AlertDialogCancel>
        <AlertDialogAction
          onClick={handleDelete}
          disabled={isDeleting}
          className="bg-red-600 hover:bg-red-700"
        >
          {isDeleting ? 'Usuwanie...' : 'Usuń raport'}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  );
};

export default DeleteReportDialog;
