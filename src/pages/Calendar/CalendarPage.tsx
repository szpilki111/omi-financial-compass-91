import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import MainLayout from "@/components/layout/MainLayout";
import PageTitle from "@/components/ui/PageTitle";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarView } from "./CalendarView";
import { EventsList } from "./EventsList";
import { UpcomingEvents } from "./UpcomingEvents";
import { EventDialog } from "./EventDialog";
import { CalendarEvent, EventType, EventPriority } from "./types";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { Plus, Filter } from "lucide-react";
import { format, startOfMonth, endOfMonth, addMonths, subMonths, eachDayOfInterval, getDate } from "date-fns";
import { pl } from "date-fns/locale";

export function CalendarPage() {
  const { user } = useAuth();
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [locationFilter, setLocationFilter] = useState<string>("all");

  const isAdminOrProvincial = user?.role === 'admin' || user?.role === 'prowincjal';

  // Fetch locations for filter (admin/provincial only)
  const { data: locations = [] } = useQuery({
    queryKey: ["calendar-locations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("locations")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: isAdminOrProvincial,
  });

  // Fetch calendar events
  const { data: calendarEvents = [], refetch: refetchEvents } = useQuery({
    queryKey: ["calendar-events", currentMonth, locationFilter],
    queryFn: async () => {
      const startDate = format(subMonths(startOfMonth(currentMonth), 1), "yyyy-MM-dd");
      const endDate = format(addMonths(endOfMonth(currentMonth), 1), "yyyy-MM-dd");

      let query = supabase
        .from("calendar_events")
        .select(`
          *,
          locations!calendar_events_location_id_fkey(name)
        `)
        .gte("event_date", startDate)
        .lte("event_date", endDate);

      if (locationFilter && locationFilter !== "all") {
        query = query.eq("location_id", locationFilter);
      }

      const { data, error } = await query;
      if (error) throw error;

      return (data || []).map(e => ({
        ...e,
        event_type: e.event_type as EventType,
        priority: e.priority as EventPriority,
        source: 'calendar' as const,
        location_name: e.locations?.name,
      })) as CalendarEvent[];
    },
  });

  // Fetch reports for timeline
  const { data: reportEvents = [] } = useQuery({
    queryKey: ["calendar-reports", currentMonth, locationFilter],
    queryFn: async () => {
      const startDate = format(subMonths(startOfMonth(currentMonth), 1), "yyyy-MM-dd");
      const endDate = format(addMonths(endOfMonth(currentMonth), 1), "yyyy-MM-dd");

      let query = supabase
        .from("reports")
        .select(`
          id, title, status, submitted_at, reviewed_at, location_id,
          locations!reports_location_id_fkey(name)
        `)
        .or(`submitted_at.gte.${startDate},reviewed_at.gte.${startDate}`)
        .or(`submitted_at.lte.${endDate},reviewed_at.lte.${endDate}`);

      if (locationFilter && locationFilter !== "all") {
        query = query.eq("location_id", locationFilter);
      }

      const { data, error } = await query;
      if (error) throw error;

      const events: CalendarEvent[] = [];
      (data || []).forEach(report => {
        if (report.submitted_at) {
          events.push({
            id: `report-submitted-${report.id}`,
            title: `Raport: ${report.title}`,
            description: `Status: ${report.status === 'submitted' ? 'Oczekujący' : report.status}`,
            event_date: report.submitted_at.split('T')[0],
            event_type: 'report_submitted',
            priority: 'medium',
            is_recurring: false,
            is_global: false,
            source: 'reports',
            location_name: report.locations?.name,
            location_id: report.location_id,
            created_at: report.submitted_at,
            updated_at: report.submitted_at,
          });
        }
        if (report.reviewed_at && report.status === 'approved') {
          events.push({
            id: `report-approved-${report.id}`,
            title: `Zatwierdzono: ${report.title}`,
            event_date: report.reviewed_at.split('T')[0],
            event_type: 'report_approved',
            priority: 'low',
            is_recurring: false,
            is_global: false,
            source: 'reports',
            location_name: report.locations?.name,
            location_id: report.location_id,
            created_at: report.reviewed_at,
            updated_at: report.reviewed_at,
          });
        }
      });
      return events;
    },
  });

  // Fetch budgets for timeline
  const { data: budgetEvents = [] } = useQuery({
    queryKey: ["calendar-budgets", currentMonth, locationFilter],
    queryFn: async () => {
      const startDate = format(subMonths(startOfMonth(currentMonth), 1), "yyyy-MM-dd");
      const endDate = format(addMonths(endOfMonth(currentMonth), 1), "yyyy-MM-dd");

      let query = supabase
        .from("budget_plans")
        .select(`
          id, year, status, submitted_at, approved_at, location_id,
          locations!budget_plans_location_id_fkey(name)
        `)
        .or(`submitted_at.gte.${startDate},approved_at.gte.${startDate}`)
        .or(`submitted_at.lte.${endDate},approved_at.lte.${endDate}`);

      if (locationFilter && locationFilter !== "all") {
        query = query.eq("location_id", locationFilter);
      }

      const { data, error } = await query;
      if (error) throw error;

      const events: CalendarEvent[] = [];
      (data || []).forEach(budget => {
        if (budget.submitted_at) {
          events.push({
            id: `budget-submitted-${budget.id}`,
            title: `Budżet ${budget.year} złożony`,
            event_date: budget.submitted_at.split('T')[0],
            event_type: 'budget_submitted',
            priority: 'medium',
            is_recurring: false,
            is_global: false,
            source: 'budgets',
            location_name: budget.locations?.name,
            location_id: budget.location_id,
            created_at: budget.submitted_at,
            updated_at: budget.submitted_at,
          });
        }
        if (budget.approved_at) {
          events.push({
            id: `budget-approved-${budget.id}`,
            title: `Budżet ${budget.year} zatwierdzony`,
            event_date: budget.approved_at.split('T')[0],
            event_type: 'budget_approved',
            priority: 'low',
            is_recurring: false,
            is_global: false,
            source: 'budgets',
            location_name: budget.locations?.name,
            location_id: budget.location_id,
            created_at: budget.approved_at,
            updated_at: budget.approved_at,
          });
        }
      });
      return events;
    },
  });

  // Generate recurring deadline events (5th of each month)
  const deadlineEvents = useMemo(() => {
    const events: CalendarEvent[] = [];
    const monthStart = subMonths(startOfMonth(currentMonth), 1);
    const monthEnd = addMonths(endOfMonth(currentMonth), 1);
    
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
    days.forEach(day => {
      if (getDate(day) === 5) {
        events.push({
          id: `deadline-${format(day, 'yyyy-MM')}`,
          title: `Termin raportu za ${format(subMonths(day, 1), 'LLLL yyyy', { locale: pl })}`,
          event_date: format(day, 'yyyy-MM-dd'),
          event_type: 'deadline',
          priority: 'high',
          is_recurring: true,
          recurring_pattern: 'monthly',
          is_global: true,
          source: 'calendar',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      }
    });
    return events;
  }, [currentMonth]);

  // Combine all events
  const allEvents = useMemo(() => {
    return [...calendarEvents, ...reportEvents, ...budgetEvents, ...deadlineEvents];
  }, [calendarEvents, reportEvents, budgetEvents, deadlineEvents]);

  // Filter events for selected date
  const selectedDateEvents = useMemo(() => {
    if (!selectedDate) return allEvents;
    const dateKey = format(selectedDate, "yyyy-MM-dd");
    return allEvents.filter(e => e.event_date === dateKey);
  }, [allEvents, selectedDate]);

  const handleEventClick = (event: CalendarEvent) => {
    setSelectedEvent(event);
    setDialogOpen(true);
  };

  const handleAddEvent = () => {
    setSelectedEvent(null);
    setDialogOpen(true);
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <PageTitle 
            title="Kalendarz wydarzeń" 
            subtitle="Terminy, raporty, budżety i ważne daty"
          />
          
          <div className="flex items-center gap-2">
            {isAdminOrProvincial && (
              <Select value={locationFilter} onValueChange={setLocationFilter}>
                <SelectTrigger className="w-[200px]">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Wszystkie lokalizacje" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Wszystkie lokalizacje</SelectItem>
                  {locations.map(loc => (
                    <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            
            <Button onClick={handleAddEvent}>
              <Plus className="h-4 w-4 mr-2" />
              Nowe wydarzenie
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Calendar */}
          <div className="lg:col-span-2">
            <CalendarView
              events={allEvents}
              selectedDate={selectedDate}
              onSelectDate={setSelectedDate}
              month={currentMonth}
              onMonthChange={setCurrentMonth}
            />
          </div>

          {/* Upcoming Events */}
          <div>
            <UpcomingEvents
              events={allEvents}
              limit={7}
              showViewAll={false}
              onEventClick={handleEventClick}
            />
          </div>
        </div>

        {/* Events List */}
        <EventsList
          events={selectedDateEvents}
          selectedDate={selectedDate}
          onEventClick={handleEventClick}
        />

        {/* Event Dialog */}
        <EventDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          event={selectedEvent}
          selectedDate={selectedDate}
          onSave={refetchEvents}
        />
      </div>
    </MainLayout>
  );
}
