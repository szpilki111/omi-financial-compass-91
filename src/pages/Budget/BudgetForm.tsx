import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { toast } from 'sonner';
import { BudgetFormData, BudgetPlan } from '@/types/budget';
import { generateForecast, INCOME_ACCOUNTS, EXPENSE_ACCOUNTS, formatCurrency } from '@/utils/budgetUtils';
import { sendBudgetNotification } from '@/utils/budgetNotifications';
import BudgetItemsTable from './BudgetItemsTable';
import { Spinner } from '@/components/ui/Spinner';
import { Upload, X, FileText } from 'lucide-react';

interface BudgetFormProps {
  budgetId: string | null;
  onSaved: () => void;
  onCancel: () => void;
}

// Helper function for detailed error messages
const getBudgetSaveErrorMessage = (error: any, action: 'draft' | 'submitted'): string => {
  const errorMessage = error?.message || '';
  const errorCode = error?.code || '';
  const errorDetails = error?.details || '';

  // Check for duplicate key / unique constraint
  if (errorCode === '23505' || errorMessage.includes('duplicate key') || errorMessage.includes('unique constraint')) {
    return `[BŁĄD DANYCH UŻYTKOWNIKA] Budżet dla tej lokalizacji i roku już istnieje. Wybierz inny rok lub lokalizację.`;
  }

  // Check for RLS / permissions errors
  if (
    errorCode === '42501' || 
    errorMessage.includes('row-level security') || 
    errorMessage.includes('permission denied') ||
    errorMessage.includes('policy')
  ) {
    return `[BŁĄD UPRAWNIEŃ APLIKACJI] Nie masz uprawnień do ${action === 'submitted' ? 'złożenia' : 'zapisania'} tego budżetu. Skontaktuj się z administratorem.`;
  }

  // Generic application error
  return `[BŁĄD APLIKACJI] Nie udało się ${action === 'submitted' ? 'złożyć' : 'zapisać'} budżetu. Szczegóły: ${errorMessage || errorDetails || 'nieznany błąd'}. Spróbuj ponownie lub skontaktuj się z administratorem.`;
};

const BudgetForm = ({ budgetId, onSaved, onCancel }: BudgetFormProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isEditing = !!budgetId;

  const [formData, setFormData] = useState<BudgetFormData>({
    year: new Date().getFullYear() + 1,
    location_id: user?.location || '',
    forecast_method: 'last_year',
    additional_expenses: 0,
    additional_expenses_description: '',
    planned_cost_reduction: 0,
    planned_cost_reduction_description: '',
  });

  // String states for modifier inputs
  const [additionalExpensesInput, setAdditionalExpensesInput] = useState('0');
  const [plannedCostReductionInput, setPlannedCostReductionInput] = useState('0');

  const [comments, setComments] = useState('');
  const [attachments, setAttachments] = useState<string[]>([]);
  const [uploadingFile, setUploadingFile] = useState(false);

  const [budgetItems, setBudgetItems] = useState<{
    income: { account_prefix: string; account_name: string; forecasted: number; planned: number; previous: number }[];
    expenses: { account_prefix: string; account_name: string; forecasted: number; planned: number; previous: number }[];
  }>({ income: [], expenses: [] });

  const [isGeneratingForecast, setIsGeneratingForecast] = useState(false);

  // Fetch locations for selection
  const { data: locations } = useQuery({
    queryKey: ['locations-for-budget', user?.id],
    queryFn: async () => {
      if (user?.role === 'admin' || user?.role === 'prowincjal') {
        const { data, error } = await supabase
          .from('locations')
          .select('id, name')
          .order('name');
        if (error) throw error;
        return data;
      } else {
        const { data, error } = await supabase
          .from('locations')
          .select('id, name')
          .eq('id', user?.location)
          .single();
        if (error) throw error;
        return [data];
      }
    },
    enabled: !!user,
  });

  // Fetch existing budget if editing
  const { data: existingBudget, isLoading: isLoadingBudget } = useQuery({
    queryKey: ['budget-plan', budgetId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('budget_plans')
        .select('*, budget_items(*)')
        .eq('id', budgetId!)
        .single();
      if (error) throw error;
      return data as BudgetPlan & { budget_items: any[] };
    },
    enabled: isEditing,
  });

  useEffect(() => {
    if (existingBudget) {
      setFormData({
        year: existingBudget.year,
        location_id: existingBudget.location_id,
        forecast_method: existingBudget.forecast_method,
        additional_expenses: existingBudget.additional_expenses,
        additional_expenses_description: existingBudget.additional_expenses_description || '',
        planned_cost_reduction: existingBudget.planned_cost_reduction,
        planned_cost_reduction_description: existingBudget.planned_cost_reduction_description || '',
      });
      
      // Initialize string inputs from existing budget
      setAdditionalExpensesInput(String(existingBudget.additional_expenses || 0));
      setPlannedCostReductionInput(String(existingBudget.planned_cost_reduction || 0));
      
      setComments(existingBudget.comments || '');
      setAttachments(existingBudget.attachments || []);

      // Load budget items
      const income = existingBudget.budget_items
        .filter((item: any) => item.account_type === 'income')
        .map((item: any) => ({
          account_prefix: item.account_prefix,
          account_name: item.account_name,
          forecasted: item.forecasted_amount || 0,
          planned: item.planned_amount,
          previous: item.previous_year_amount || 0,
        }));

      const expenses = existingBudget.budget_items
        .filter((item: any) => item.account_type === 'expense')
        .map((item: any) => ({
          account_prefix: item.account_prefix,
          account_name: item.account_name,
          forecasted: item.forecasted_amount || 0,
          planned: item.planned_amount,
          previous: item.previous_year_amount || 0,
        }));

      setBudgetItems({ income, expenses });
    }
  }, [existingBudget]);

  const handleGenerateForecast = async () => {
    if (!formData.location_id || !formData.year) {
      toast.error('Wybierz lokalizację i rok');
      return;
    }

    if (formData.forecast_method === 'manual') {
      // For manual mode, create empty budget items
      const incomeItems = INCOME_ACCOUNTS.map(account => ({
        account_prefix: account.prefix,
        account_name: account.name,
        forecasted: 0,
        planned: 0,
        previous: 0,
      }));

      const expenseItems = EXPENSE_ACCOUNTS.map(account => ({
        account_prefix: account.prefix,
        account_name: account.name,
        forecasted: 0,
        planned: 0,
        previous: 0,
      }));

      setBudgetItems({ income: incomeItems, expenses: expenseItems });
      toast.success('Budżet utworzony - wprowadź kwoty ręcznie');
      return;
    }

    setIsGeneratingForecast(true);
    try {
      const forecast = await generateForecast(
        formData.location_id,
        formData.year,
        formData.forecast_method,
        formData.additional_expenses,
        formData.planned_cost_reduction
      );

      // Map forecast to budget items with account names
      const incomeItems = forecast.income.map(f => {
        const account = INCOME_ACCOUNTS.find(a => a.prefix === f.account_prefix);
        return {
          account_prefix: f.account_prefix,
          account_name: account?.name || f.account_prefix,
          forecasted: f.total,
          planned: f.total,
          previous: f.total,
        };
      });

      const expenseItems = forecast.expenses.map(f => {
        const account = EXPENSE_ACCOUNTS.find(a => a.prefix === f.account_prefix);
        return {
          account_prefix: f.account_prefix,
          account_name: account?.name || f.account_prefix,
          forecasted: f.total,
          planned: f.total,
          previous: f.total,
        };
      });

      setBudgetItems({ income: incomeItems, expenses: expenseItems });
      toast.success('Prognoza wygenerowana');
    } catch (error) {
      console.error('[BUDGET] Error generating forecast:', error);
      toast.error('[BŁĄD APLIKACJI] Błąd generowania prognozy budżetu. Sprawdź czy istnieją dane finansowe dla wybranej lokalizacji.');
    } finally {
      setIsGeneratingForecast(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setUploadingFile(true);
    try {
      const uploadedUrls: string[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
        const filePath = `${formData.location_id}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('budget-attachments')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('budget-attachments')
          .getPublicUrl(filePath);

        uploadedUrls.push(filePath);
      }

      setAttachments([...attachments, ...uploadedUrls]);
      toast.success('Załączniki dodane');
    } catch (error) {
      console.error('[BUDGET] Error uploading files:', error);
      toast.error('[BŁĄD APLIKACJI] Błąd przesyłania załączników do storage. Spróbuj ponownie.');
    } finally {
      setUploadingFile(false);
    }
  };

  const handleRemoveAttachment = async (filePath: string) => {
    try {
      const { error } = await supabase.storage
        .from('budget-attachments')
        .remove([filePath]);

      if (error) throw error;

      setAttachments(attachments.filter(a => a !== filePath));
      toast.success('Załącznik usunięty');
    } catch (error) {
      console.error('[BUDGET] Error removing attachment:', error);
      toast.error('[BŁĄD APLIKACJI] Błąd usuwania załącznika ze storage. Spróbuj ponownie.');
    }
  };

  const handleCopyFromPreviousYear = async () => {
    if (!formData.location_id || !formData.year) {
      toast.error('Wybierz lokalizację i rok');
      return;
    }

    const previousYear = formData.year - 1;

    setIsGeneratingForecast(true);
    try {
      // Fetch previous year's budget
      const { data: prevBudget, error: budgetError } = await supabase
        .from('budget_plans')
        .select('id')
        .eq('location_id', formData.location_id)
        .eq('year', previousYear)
        .maybeSingle();

      if (budgetError || !prevBudget) {
        toast.error(`Nie znaleziono budżetu z ${previousYear} roku dla tej lokalizacji`);
        setIsGeneratingForecast(false);
        return;
      }

      // Fetch budget items from previous year
      const { data: prevItems, error: itemsError } = await supabase
        .from('budget_items')
        .select('*')
        .eq('budget_plan_id', prevBudget.id);

      if (itemsError || !prevItems) {
        toast.error('[BŁĄD APLIKACJI] Błąd pobierania pozycji budżetowych z poprzedniego roku');
        setIsGeneratingForecast(false);
        return;
      }

      // Map to current budget items
      const incomeItems = prevItems
        .filter(item => item.account_type === 'income')
        .map(item => ({
          account_prefix: item.account_prefix,
          account_name: item.account_name,
          forecasted: item.planned_amount,
          planned: item.planned_amount,
          previous: item.planned_amount,
        }));

      const expenseItems = prevItems
        .filter(item => item.account_type === 'expense')
        .map(item => ({
          account_prefix: item.account_prefix,
          account_name: item.account_name,
          forecasted: item.planned_amount,
          planned: item.planned_amount,
          previous: item.planned_amount,
        }));

      setBudgetItems({ income: incomeItems, expenses: expenseItems });
      toast.success(`Skopiowano budżet z ${previousYear} roku`);
    } catch (error) {
      console.error('[BUDGET] Error copying budget:', error);
      toast.error('[BŁĄD APLIKACJI] Błąd kopiowania budżetu z poprzedniego roku');
    } finally {
      setIsGeneratingForecast(false);
    }
  };

  const saveMutation = useMutation({
    mutationFn: async (status: 'draft' | 'submitted') => {
      // Save budget plan
      const budgetData: any = {
        location_id: formData.location_id,
        year: formData.year,
        status,
        forecast_method: formData.forecast_method,
        additional_expenses: formData.additional_expenses,
        additional_expenses_description: formData.additional_expenses_description || null,
        planned_cost_reduction: formData.planned_cost_reduction,
        planned_cost_reduction_description: formData.planned_cost_reduction_description || null,
        comments: comments || null,
        attachments: attachments.length > 0 ? attachments : null,
      };

      if (status === 'submitted') {
        budgetData.submitted_at = new Date().toISOString();
        budgetData.submitted_by = user?.id;
      }

      let planId = budgetId;

      if (isEditing) {
        const { error } = await supabase
          .from('budget_plans')
          .update(budgetData)
          .eq('id', budgetId!);
        if (error) throw error;
      } else {
        budgetData.created_by = user?.id;
        const { data, error } = await supabase
          .from('budget_plans')
          .insert(budgetData)
          .select()
          .single();
        if (error) throw error;
        planId = data.id;
      }

      // Delete existing items and insert new ones
      if (planId) {
        await supabase
          .from('budget_items')
          .delete()
          .eq('budget_plan_id', planId);

        const allItems = [
          ...budgetItems.income.map(item => ({
            budget_plan_id: planId,
            account_prefix: item.account_prefix,
            account_name: item.account_name,
            account_type: 'income',
            planned_amount: item.planned,
            forecasted_amount: item.forecasted,
            previous_year_amount: item.previous,
          })),
          ...budgetItems.expenses.map(item => ({
            budget_plan_id: planId,
            account_prefix: item.account_prefix,
            account_name: item.account_name,
            account_type: 'expense',
            planned_amount: item.planned,
            forecasted_amount: item.forecasted,
            previous_year_amount: item.previous,
          })),
        ];

        const { error: itemsError } = await supabase
          .from('budget_items')
          .insert(allItems);
        if (itemsError) throw itemsError;
      }

      return planId;
    },
    onSuccess: (_, status) => {
      toast.success(status === 'submitted' ? 'Budżet złożony do zatwierdzenia' : 'Budżet zapisany jako projekt');
      queryClient.invalidateQueries({ queryKey: ['budget-plans'] });
      onSaved();
    },
    onError: (error, status) => {
      console.error(`[BUDGET] Error saving budget as ${status}:`, error);
      const errorMessage = getBudgetSaveErrorMessage(error, status);
      toast.error(errorMessage);
    },
  });

  const handleAdditionalExpensesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(',', '.');
    setAdditionalExpensesInput(value);

    if (value === '' || value === '-') {
      // Tymczasowo 0 w liczbie, ale pozwalamy na string
      return;
    }

    const parsed = parseFloat(value);
    if (!isNaN(parsed)) {
      setFormData({ ...formData, additional_expenses: Math.max(0, parsed) });
    }
  };

  const handlePlannedCostReductionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(',', '.');
    setPlannedCostReductionInput(value);

    if (value === '' || value === '-') {
      return;
    }

    const parsed = parseFloat(value);
    if (!isNaN(parsed)) {
      setFormData({ ...formData, planned_cost_reduction: Math.max(0, parsed) });
    }
  };

  const handleAdditionalExpensesBlur = () => {
    if (additionalExpensesInput === '' || additionalExpensesInput === '-') {
      setAdditionalExpensesInput('0');
      setFormData({ ...formData, additional_expenses: 0 });
    }
  };

  const handlePlannedCostReductionBlur = () => {
    if (plannedCostReductionInput === '' || plannedCostReductionInput === '-') {
      setPlannedCostReductionInput('0');
      setFormData({ ...formData, planned_cost_reduction: 0 });
    }
  };

  if (isLoadingBudget) {
    return (
      <Card>
        <CardContent className="flex justify-center py-8">
          <Spinner />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{isEditing ? 'Edycja budżetu' : 'Nowy budżet'}</CardTitle>
          <CardDescription>
            Wypełnij poniższe informacje aby utworzyć plan budżetowy
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Basic Info */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="year">Rok budżetu</Label>
              <Input
                id="year"
                type="number"
                value={formData.year}
                onChange={(e) => setFormData({ ...formData, year: parseInt(e.target.value) })}
                disabled={isEditing}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="location">Lokalizacja</Label>
              <Select
                value={formData.location_id}
                onValueChange={(value) => setFormData({ ...formData, location_id: value })}
                disabled={isEditing || (user?.role !== 'admin' && user?.role !== 'prowincjal')}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Wybierz lokalizację" />
                </SelectTrigger>
                <SelectContent>
                  {locations?.map((loc) => (
                    <SelectItem key={loc.id} value={loc.id}>
                      {loc.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Forecast Method */}
          <div className="space-y-2">
            <Label>Metoda prognozowania</Label>
            <RadioGroup
              value={formData.forecast_method}
              onValueChange={(value: any) => setFormData({ ...formData, forecast_method: value })}
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="last_year" id="last_year" />
                <Label htmlFor="last_year">Ostatni rok</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="avg_3_years" id="avg_3_years" />
                <Label htmlFor="avg_3_years">Średnia z 3 lat</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="manual" id="manual" />
                <Label htmlFor="manual">Ręcznie</Label>
              </div>
            </RadioGroup>
          </div>

          {/* Modifiers */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="additional_expenses">Prognozowane inne wydatki</Label>
              <Input
                id="additional_expenses"
                type="text"
                value={additionalExpensesInput}
                onChange={handleAdditionalExpensesChange}
                onBlur={handleAdditionalExpensesBlur}
              />
              <Textarea
                placeholder="Opis (np. rozbudowa sklepu)"
                value={formData.additional_expenses_description}
                onChange={(e) => setFormData({ ...formData, additional_expenses_description: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="planned_cost_reduction">Planowana redukcja kosztów</Label>
              <Input
                id="planned_cost_reduction"
                type="text"
                value={plannedCostReductionInput}
                onChange={handlePlannedCostReductionChange}
                onBlur={handlePlannedCostReductionBlur}
              />
              <Textarea
                placeholder="Opis (np. zwolnienie pracowników)"
                value={formData.planned_cost_reduction_description}
                onChange={(e) => setFormData({ ...formData, planned_cost_reduction_description: e.target.value })}
              />
            </div>
          </div>

          {(formData.forecast_method !== 'manual' || budgetItems.income.length === 0) && (
            <div className="flex gap-2">
              <Button
                onClick={handleGenerateForecast}
                disabled={isGeneratingForecast || !formData.location_id}
              >
                {isGeneratingForecast ? 'Generowanie...' : formData.forecast_method === 'manual' ? 'Utwórz puste pozycje' : 'Wygeneruj prognozę'}
              </Button>
              {!isEditing && (
                <Button
                  variant="outline"
                  onClick={handleCopyFromPreviousYear}
                  disabled={isGeneratingForecast || !formData.location_id}
                >
                  Kopiuj z {formData.year - 1} roku
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Notes and Attachments */}
      <Card>
        <CardHeader>
          <CardTitle>Notatki i załączniki</CardTitle>
          <CardDescription>
            Dodaj dodatkowe informacje i dokumenty do budżetu
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="comments">Notatki</Label>
            <Textarea
              id="comments"
              placeholder="Dodatkowe informacje, komentarze..."
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              rows={4}
            />
          </div>

          <div className="space-y-2">
            <Label>Załączniki</Label>
            <div className="flex gap-2">
              <input
                type="file"
                id="file-upload"
                multiple
                className="hidden"
                onChange={handleFileUpload}
                disabled={uploadingFile}
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => document.getElementById('file-upload')?.click()}
                disabled={uploadingFile}
              >
                <Upload className="mr-2 h-4 w-4" />
                {uploadingFile ? 'Przesyłanie...' : 'Dodaj załączniki'}
              </Button>
            </div>

            {attachments.length > 0 && (
              <div className="space-y-2 mt-4">
                {attachments.map((filePath, index) => {
                  const fileName = filePath.split('/').pop() || filePath;
                  return (
                    <div key={index} className="flex items-center justify-between p-2 border rounded">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{fileName}</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveAttachment(filePath)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {budgetItems.income.length > 0 && (
        <BudgetItemsTable
          incomeItems={budgetItems.income}
          expenseItems={budgetItems.expenses}
          onUpdateIncome={(items) => setBudgetItems({ ...budgetItems, income: items })}
          onUpdateExpenses={(items) => setBudgetItems({ ...budgetItems, expenses: items })}
        />
      )}

      <div className="flex gap-2 justify-end">
        <Button variant="outline" onClick={onCancel}>
          Anuluj
        </Button>
        <Button
          variant="secondary"
          onClick={() => saveMutation.mutate('draft')}
          disabled={saveMutation.isPending || budgetItems.income.length === 0}
        >
          Zapisz jako projekt
        </Button>
        <Button
          onClick={() => saveMutation.mutate('submitted')}
          disabled={saveMutation.isPending || budgetItems.income.length === 0}
        >
          Złóż do zatwierdzenia
        </Button>
      </div>
    </div>
  );
};

export default BudgetForm;