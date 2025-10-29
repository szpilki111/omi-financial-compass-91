import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Plus, Edit, Trash2, CheckCircle, Clock, Circle, ChevronRight, ChevronDown } from 'lucide-react';

interface ProjectFeature {
  id: string;
  title: string;
  description: string | null;
  category: 'planned' | 'done' | 'remaining' | 'beyond_plan';
  status: 'not_started' | 'in_progress' | 'completed';
  priority: 'low' | 'medium' | 'high' | 'critical';
  implementation_percentage: number;
  notes: string | null;
  code_location: string | null;
  created_at: string;
  updated_at: string;
  parent_feature_id: string | null;
  subtasks?: ProjectFeature[];
}

const ProjectFeaturesManagement = () => {
  const { user } = useAuth();
  const [features, setFeatures] = useState<ProjectFeature[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingFeature, setEditingFeature] = useState<ProjectFeature | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: 'planned' as ProjectFeature['category'],
    status: 'not_started' as ProjectFeature['status'],
    priority: 'medium' as ProjectFeature['priority'],
    implementation_percentage: 0,
    notes: '',
    code_location: '',
    parent_feature_id: null as string | null,
  });
  const [addingSubtaskFor, setAddingSubtaskFor] = useState<string | null>(null);
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchFeatures();
  }, []);

  const fetchFeatures = async () => {
    try {
      const { data, error } = await supabase
        .from('project_features')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Organize features into parent-child hierarchy
      const featuresMap = new Map<string, ProjectFeature>();
      const rootFeatures: ProjectFeature[] = [];
      
      (data || []).forEach((feature) => {
        featuresMap.set(feature.id, { ...feature, subtasks: [] });
      });
      
      featuresMap.forEach((feature) => {
        if (feature.parent_feature_id) {
          const parent = featuresMap.get(feature.parent_feature_id);
          if (parent) {
            parent.subtasks = parent.subtasks || [];
            parent.subtasks.push(feature);
          }
        } else {
          rootFeatures.push(feature);
        }
      });
      
      setFeatures(rootFeatures);
    } catch (error) {
      console.error('Error fetching features:', error);
      toast.error('Błąd pobierania funkcjonalności');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      if (!formData.title.trim()) {
        toast.error('Tytuł jest wymagany');
        return;
      }

      const dataToSave = {
        ...formData,
        updated_by: user?.id,
        ...(editingFeature ? {} : { created_by: user?.id }),
      };

      if (editingFeature) {
        const { error } = await supabase
          .from('project_features')
          .update(dataToSave)
          .eq('id', editingFeature.id);

        if (error) throw error;
        
        // Update parent progress if this is a subtask
        if (editingFeature.parent_feature_id) {
          await updateParentProgress(editingFeature.parent_feature_id);
        }
        
        toast.success('Funkcjonalność zaktualizowana');
      } else {
        const { error } = await supabase
          .from('project_features')
          .insert([dataToSave]);

        if (error) throw error;
        
        // Update parent progress if this is a subtask
        if (dataToSave.parent_feature_id) {
          await updateParentProgress(dataToSave.parent_feature_id);
        }
        
        toast.success('Funkcjonalność dodana');
      }

      setIsDialogOpen(false);
      setAddingSubtaskFor(null);
      resetForm();
      fetchFeatures();
    } catch (error) {
      console.error('Error saving feature:', error);
      toast.error('Błąd zapisywania funkcjonalności');
    }
  };

  const updateParentProgress = async (parentId: string) => {
    try {
      const { data, error } = await supabase.rpc('calculate_parent_progress', {
        p_parent_id: parentId,
      });

      if (error) throw error;

      await supabase
        .from('project_features')
        .update({ implementation_percentage: data })
        .eq('id', parentId);
    } catch (error) {
      console.error('Error updating parent progress:', error);
    }
  };

  const handleDelete = async (id: string, parentId?: string | null) => {
    if (!confirm('Czy na pewno chcesz usunąć tę funkcjonalność?')) return;

    try {
      const { error } = await supabase
        .from('project_features')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      // Update parent progress if this was a subtask
      if (parentId) {
        await updateParentProgress(parentId);
      }
      
      toast.success('Funkcjonalność usunięta');
      fetchFeatures();
    } catch (error) {
      console.error('Error deleting feature:', error);
      toast.error('Błąd usuwania funkcjonalności');
    }
  };

  const handleEdit = (feature: ProjectFeature) => {
    setEditingFeature(feature);
    setFormData({
      title: feature.title,
      description: feature.description || '',
      category: feature.category,
      status: feature.status,
      priority: feature.priority,
      implementation_percentage: feature.implementation_percentage,
      notes: feature.notes || '',
      code_location: feature.code_location || '',
      parent_feature_id: feature.parent_feature_id,
    });
    setIsDialogOpen(true);
  };

  const handleAddSubtask = (parentFeature: ProjectFeature) => {
    setAddingSubtaskFor(parentFeature.id);
    setFormData({
      title: '',
      description: '',
      category: parentFeature.category,
      status: 'not_started',
      priority: 'medium',
      implementation_percentage: 0,
      notes: '',
      code_location: '',
      parent_feature_id: parentFeature.id,
    });
    setIsDialogOpen(true);
  };

  const toggleExpanded = (featureId: string) => {
    const newExpanded = new Set(expandedTasks);
    if (newExpanded.has(featureId)) {
      newExpanded.delete(featureId);
    } else {
      newExpanded.add(featureId);
    }
    setExpandedTasks(newExpanded);
  };

  const resetForm = () => {
    setEditingFeature(null);
    setAddingSubtaskFor(null);
    setFormData({
      title: '',
      description: '',
      category: 'planned',
      status: 'not_started',
      priority: 'medium',
      implementation_percentage: 0,
      notes: '',
      code_location: '',
      parent_feature_id: null,
    });
  };

  const getCategoryLabel = (category: string) => {
    const labels = {
      planned: 'Zaplanowane',
      done: 'Zrobione',
      remaining: 'Do zrobienia',
      beyond_plan: 'Ponad plan',
    };
    return labels[category as keyof typeof labels] || category;
  };

  const getCategoryColor = (category: string) => {
    const colors = {
      planned: 'bg-blue-100 text-blue-800',
      done: 'bg-green-100 text-green-800',
      remaining: 'bg-yellow-100 text-yellow-800',
      beyond_plan: 'bg-purple-100 text-purple-800',
    };
    return colors[category as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  const getStatusLabel = (status: string) => {
    const labels = {
      not_started: 'Nie rozpoczęto',
      in_progress: 'W trakcie',
      completed: 'Ukończone',
    };
    return labels[status as keyof typeof labels] || status;
  };

  const getStatusIcon = (status: string) => {
    const icons = {
      not_started: <Circle className="w-4 h-4" />,
      in_progress: <Clock className="w-4 h-4" />,
      completed: <CheckCircle className="w-4 h-4" />,
    };
    return icons[status as keyof typeof icons];
  };

  const getPriorityLabel = (priority: string) => {
    const labels = {
      low: 'Niski',
      medium: 'Średni',
      high: 'Wysoki',
      critical: 'Krytyczny',
    };
    return labels[priority as keyof typeof labels] || priority;
  };

  const getAllFeatures = (featuresList: ProjectFeature[]): ProjectFeature[] => {
    const all: ProjectFeature[] = [];
    featuresList.forEach((feature) => {
      all.push(feature);
      if (feature.subtasks && feature.subtasks.length > 0) {
        all.push(...getAllFeatures(feature.subtasks));
      }
    });
    return all;
  };

  const filteredFeatures = features.filter((feature) => {
    if (filterCategory !== 'all' && feature.category !== filterCategory) return false;
    if (filterStatus !== 'all' && feature.status !== filterStatus) return false;
    return true;
  });

  const allFeatures = getAllFeatures(features);

  const statistics = {
    total: allFeatures.length,
    planned: allFeatures.filter((f) => f.category === 'planned').length,
    done: allFeatures.filter((f) => f.category === 'done').length,
    remaining: allFeatures.filter((f) => f.category === 'remaining').length,
    beyond_plan: allFeatures.filter((f) => f.category === 'beyond_plan').length,
    completed: allFeatures.filter((f) => f.status === 'completed').length,
    in_progress: allFeatures.filter((f) => f.status === 'in_progress').length,
  };

  if (loading) {
    return <div className="text-center py-4">Ładowanie...</div>;
  }

  return (
    <div className="space-y-4">
      {/* Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{statistics.total}</div>
            <div className="text-sm text-muted-foreground">Wszystkie funkcjonalności</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-green-600">{statistics.done}</div>
            <div className="text-sm text-muted-foreground">Zrobione</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-yellow-600">{statistics.remaining}</div>
            <div className="text-sm text-muted-foreground">Do zrobienia</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-purple-600">{statistics.beyond_plan}</div>
            <div className="text-sm text-muted-foreground">Ponad plan</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Funkcjonalności projektu</CardTitle>
            <Dialog open={isDialogOpen} onOpenChange={(open) => {
              setIsDialogOpen(open);
              if (!open) resetForm();
            }}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Dodaj funkcjonalność
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>
                    {editingFeature 
                      ? 'Edytuj funkcjonalność' 
                      : addingSubtaskFor 
                        ? 'Nowe podzadanie' 
                        : 'Nowa funkcjonalność'}
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div>
                    <Label htmlFor="title">Tytuł *</Label>
                    <Input
                      id="title"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      placeholder="Nazwa funkcjonalności"
                    />
                  </div>
                  <div>
                    <Label htmlFor="description">Opis</Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Szczegółowy opis funkcjonalności"
                      rows={4}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="category">Kategoria</Label>
                      <Select
                        value={formData.category}
                        onValueChange={(value) => setFormData({ ...formData, category: value as ProjectFeature['category'] })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="planned">Zaplanowane</SelectItem>
                          <SelectItem value="done">Zrobione</SelectItem>
                          <SelectItem value="remaining">Do zrobienia</SelectItem>
                          <SelectItem value="beyond_plan">Ponad plan</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="status">Status</Label>
                      <Select
                        value={formData.status}
                        onValueChange={(value) => setFormData({ ...formData, status: value as ProjectFeature['status'] })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="not_started">Nie rozpoczęto</SelectItem>
                          <SelectItem value="in_progress">W trakcie</SelectItem>
                          <SelectItem value="completed">Ukończone</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="priority">Priorytet</Label>
                      <Select
                        value={formData.priority}
                        onValueChange={(value) => setFormData({ ...formData, priority: value as ProjectFeature['priority'] })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Niski</SelectItem>
                          <SelectItem value="medium">Średni</SelectItem>
                          <SelectItem value="high">Wysoki</SelectItem>
                          <SelectItem value="critical">Krytyczny</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="percentage">Procent implementacji (%)</Label>
                      <Input
                        id="percentage"
                        type="number"
                        min="0"
                        max="100"
                        value={formData.implementation_percentage}
                        onChange={(e) => setFormData({ ...formData, implementation_percentage: parseInt(e.target.value) || 0 })}
                        disabled={!!addingSubtaskFor || (editingFeature?.subtasks && editingFeature.subtasks.length > 0)}
                      />
                      {(addingSubtaskFor || (editingFeature?.subtasks && editingFeature.subtasks.length > 0)) && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Postęp jest wyliczany automatycznie na podstawie podzadań
                        </p>
                      )}
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="code_location">Lokalizacja w kodzie</Label>
                    <Input
                      id="code_location"
                      value={formData.code_location}
                      onChange={(e) => setFormData({ ...formData, code_location: e.target.value })}
                      placeholder="np. src/components/Dashboard.tsx"
                    />
                  </div>
                  <div>
                    <Label htmlFor="notes">Notatki</Label>
                    <Textarea
                      id="notes"
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      placeholder="Dodatkowe informacje, uwagi techniczne"
                      rows={3}
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                      Anuluj
                    </Button>
                    <Button onClick={handleSave}>
                      {editingFeature ? 'Zaktualizuj' : 'Dodaj'}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex gap-4 mb-4">
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filtruj po kategorii" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Wszystkie kategorie</SelectItem>
                <SelectItem value="planned">Zaplanowane</SelectItem>
                <SelectItem value="done">Zrobione</SelectItem>
                <SelectItem value="remaining">Do zrobienia</SelectItem>
                <SelectItem value="beyond_plan">Ponad plan</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filtruj po statusie" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Wszystkie statusy</SelectItem>
                <SelectItem value="not_started">Nie rozpoczęto</SelectItem>
                <SelectItem value="in_progress">W trakcie</SelectItem>
                <SelectItem value="completed">Ukończone</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Table */}
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tytuł</TableHead>
                  <TableHead>Kategoria</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Priorytet</TableHead>
                  <TableHead className="text-right">Postęp</TableHead>
                  <TableHead className="text-right">Akcje</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredFeatures.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      Brak funkcjonalności do wyświetlenia
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredFeatures.map((feature) => (
                    <React.Fragment key={feature.id}>
                      <TableRow>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {feature.subtasks && feature.subtasks.length > 0 && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0"
                                onClick={() => toggleExpanded(feature.id)}
                              >
                                {expandedTasks.has(feature.id) ? (
                                  <ChevronDown className="w-4 h-4" />
                                ) : (
                                  <ChevronRight className="w-4 h-4" />
                                )}
                              </Button>
                            )}
                            <div>
                              <div className="font-medium">{feature.title}</div>
                              {feature.description && (
                                <div className="text-sm text-muted-foreground line-clamp-1">
                                  {feature.description}
                                </div>
                              )}
                              {feature.subtasks && feature.subtasks.length > 0 && (
                                <div className="text-xs text-muted-foreground mt-1">
                                  {feature.subtasks.length} podzadań
                                </div>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={getCategoryColor(feature.category)}>
                            {getCategoryLabel(feature.category)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getStatusIcon(feature.status)}
                            <span className="text-sm">{getStatusLabel(feature.status)}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">{getPriorityLabel(feature.priority)}</span>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-24 bg-gray-200 rounded-full h-2">
                              <div
                                className="bg-primary h-2 rounded-full"
                                style={{ width: `${feature.implementation_percentage}%` }}
                              />
                            </div>
                            <span className="text-sm font-medium">{feature.implementation_percentage}%</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleAddSubtask(feature)}
                              title="Dodaj podzadanie"
                            >
                              <Plus className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(feature)}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(feature.id, feature.parent_feature_id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                      {expandedTasks.has(feature.id) && feature.subtasks?.map((subtask) => (
                        <TableRow key={subtask.id} className="bg-muted/50">
                          <TableCell>
                            <div className="pl-10">
                              <div className="font-medium text-sm">{subtask.title}</div>
                              {subtask.description && (
                                <div className="text-xs text-muted-foreground line-clamp-1">
                                  {subtask.description}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge className={getCategoryColor(subtask.category)}>
                              {getCategoryLabel(subtask.category)}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {getStatusIcon(subtask.status)}
                              <span className="text-sm">{getStatusLabel(subtask.status)}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm">{getPriorityLabel(subtask.priority)}</span>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <div className="w-24 bg-gray-200 rounded-full h-2">
                                <div
                                  className="bg-primary h-2 rounded-full"
                                  style={{ width: `${subtask.implementation_percentage}%` }}
                                />
                              </div>
                              <span className="text-sm font-medium">{subtask.implementation_percentage}%</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEdit(subtask)}
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDelete(subtask.id, subtask.parent_feature_id)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </React.Fragment>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ProjectFeaturesManagement;