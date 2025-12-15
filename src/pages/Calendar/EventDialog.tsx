import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { DatePicker } from "@/components/ui/date-picker";
import { CalendarEvent, EVENT_TYPE_CONFIG, EventType, EventPriority } from "./types";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { format } from "date-fns";

interface EventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event?: CalendarEvent | null;
  selectedDate?: Date;
  onSave: () => void;
}

export function EventDialog({ open, onOpenChange, event, selectedDate, onSave }: EventDialogProps) {
  const { user } = useAuth();
  const isEditing = !!event?.id && event.source === 'calendar';
  
  const [title, setTitle] = useState(event?.title || "");
  const [description, setDescription] = useState(event?.description || "");
  const [eventDate, setEventDate] = useState<Date | undefined>(
    event?.event_date ? new Date(event.event_date) : selectedDate
  );
  const [eventType, setEventType] = useState<EventType>(
    (event?.event_type as EventType) || "other"
  );
  const [priority, setPriority] = useState<EventPriority>(event?.priority || "medium");
  const [isRecurring, setIsRecurring] = useState(event?.is_recurring || false);
  const [recurringPattern, setRecurringPattern] = useState<'yearly' | 'monthly' | 'weekly'>(
    (event?.recurring_pattern as 'yearly' | 'monthly' | 'weekly') || "yearly"
  );
  const [isGlobal, setIsGlobal] = useState(event?.is_global || false);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!title.trim() || !eventDate) {
      toast.error("Wypełnij wymagane pola (tytuł i data)");
      return;
    }

    setIsSaving(true);
    try {
      const eventData = {
        title: title.trim(),
        description: description.trim() || null,
        event_date: format(eventDate, "yyyy-MM-dd"),
        event_type: eventType,
        priority,
        is_recurring: isRecurring,
        recurring_pattern: isRecurring ? recurringPattern : null,
        is_global: user?.role === 'admin' || user?.role === 'prowincjal' ? isGlobal : false,
        location_id: (user?.location && typeof user.location === 'object') ? (user.location as any)?.id : (user?.location || null),
        created_by: user?.id,
        user_id: user?.id,
      };

      if (isEditing && event?.id) {
        const { error } = await supabase
          .from("calendar_events")
          .update(eventData)
          .eq("id", event.id);
        
        if (error) throw error;
        toast.success("Wydarzenie zaktualizowane");
      } else {
        const { error } = await supabase
          .from("calendar_events")
          .insert(eventData);
        
        if (error) throw error;
        toast.success("Wydarzenie dodane");
      }

      onSave();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error saving event:", error);
      toast.error("Błąd zapisu: " + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!event?.id || event.source !== 'calendar') return;
    
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("calendar_events")
        .delete()
        .eq("id", event.id);
      
      if (error) throw error;
      toast.success("Wydarzenie usunięte");
      onSave();
      onOpenChange(false);
    } catch (error: any) {
      toast.error("Błąd usuwania: " + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const editableTypes: EventType[] = ['deadline', 'reminder', 'meeting', 'celebration', 'other'];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edytuj wydarzenie" : event ? "Szczegóły wydarzenia" : "Nowe wydarzenie"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="title">Tytuł *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Nazwa wydarzenia"
              disabled={event?.source !== 'calendar' && !!event}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Opis</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Opcjonalny opis"
              rows={3}
              disabled={event?.source !== 'calendar' && !!event}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Data *</Label>
              <DatePicker
                value={eventDate}
                onChange={setEventDate}
                disabled={event?.source !== 'calendar' && !!event}
              />
            </div>

            <div className="space-y-2">
              <Label>Typ wydarzenia</Label>
              <Select 
                value={eventType} 
                onValueChange={(v) => setEventType(v as EventType)}
                disabled={event?.source !== 'calendar' && !!event}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {editableTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {EVENT_TYPE_CONFIG[type].icon} {EVENT_TYPE_CONFIG[type].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Priorytet</Label>
              <Select 
                value={priority} 
                onValueChange={(v) => setPriority(v as EventPriority)}
                disabled={event?.source !== 'calendar' && !!event}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Niski</SelectItem>
                  <SelectItem value="medium">Średni</SelectItem>
                  <SelectItem value="high">Wysoki</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {(user?.role === 'admin' || user?.role === 'prowincjal') && !event && (
              <div className="space-y-2">
                <Label>Wydarzenie globalne</Label>
                <div className="flex items-center space-x-2 pt-2">
                  <Switch
                    checked={isGlobal}
                    onCheckedChange={setIsGlobal}
                  />
                  <span className="text-sm text-muted-foreground">
                    Widoczne dla wszystkich
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <Switch
                checked={isRecurring}
                onCheckedChange={setIsRecurring}
                disabled={event?.source !== 'calendar' && !!event}
              />
              <Label>Wydarzenie cykliczne</Label>
            </div>
            
            {isRecurring && (
              <Select 
                value={recurringPattern} 
                onValueChange={(v) => setRecurringPattern(v as 'yearly' | 'monthly' | 'weekly')}
                disabled={event?.source !== 'calendar' && !!event}
              >
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="weekly">Co tydzień</SelectItem>
                  <SelectItem value="monthly">Co miesiąc</SelectItem>
                  <SelectItem value="yearly">Co rok</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2">
          {isEditing && (
            <Button variant="destructive" onClick={handleDelete} disabled={isSaving}>
              Usuń
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {event?.source !== 'calendar' && event ? "Zamknij" : "Anuluj"}
          </Button>
          {(!event || event.source === 'calendar') && (
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? "Zapisywanie..." : isEditing ? "Zapisz" : "Dodaj"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
