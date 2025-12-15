import { Calendar } from "@/components/ui/calendar";
import { CalendarEvent, EVENT_TYPE_CONFIG } from "./types";
import { pl } from "date-fns/locale";
import { format, isSameDay } from "date-fns";
import { cn } from "@/lib/utils";

interface CalendarViewProps {
  events: CalendarEvent[];
  selectedDate?: Date;
  onSelectDate: (date: Date | undefined) => void;
  month?: Date;
  onMonthChange?: (month: Date) => void;
}

export function CalendarView({ 
  events, 
  selectedDate, 
  onSelectDate,
  month,
  onMonthChange
}: CalendarViewProps) {
  // Group events by date
  const eventsByDate = events.reduce((acc, event) => {
    const dateKey = event.event_date;
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(event);
    return acc;
  }, {} as Record<string, CalendarEvent[]>);

  // Get unique event types for a date (for displaying dots)
  const getEventTypesForDate = (date: Date): string[] => {
    const dateKey = format(date, "yyyy-MM-dd");
    const dateEvents = eventsByDate[dateKey] || [];
    const types = new Set(dateEvents.map(e => e.event_type));
    return Array.from(types).slice(0, 4); // Max 4 dots
  };

  return (
    <div className="p-4 bg-card rounded-lg border">
      <Calendar
        mode="single"
        selected={selectedDate}
        onSelect={onSelectDate}
        month={month}
        onMonthChange={onMonthChange}
        locale={pl}
        className="pointer-events-auto"
        classNames={{
          months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
          month: "space-y-4 w-full",
          caption: "flex justify-center pt-1 relative items-center",
          caption_label: "text-base font-semibold",
          nav: "space-x-1 flex items-center",
          nav_button: "h-8 w-8 bg-transparent p-0 opacity-70 hover:opacity-100 border rounded-md",
          nav_button_previous: "absolute left-1",
          nav_button_next: "absolute right-1",
          table: "w-full border-collapse",
          head_row: "flex w-full",
          head_cell: "text-muted-foreground rounded-md w-full font-medium text-[0.8rem] py-2",
          row: "flex w-full mt-1",
          cell: cn(
            "relative h-12 w-full p-0 text-center text-sm focus-within:relative focus-within:z-20",
            "[&:has([aria-selected])]:bg-accent [&:has([aria-selected])]:rounded-md"
          ),
          day: cn(
            "h-12 w-full p-0 font-normal aria-selected:opacity-100 hover:bg-accent hover:rounded-md transition-colors flex flex-col items-center justify-start pt-1"
          ),
          day_selected: "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground rounded-md",
          day_today: "bg-accent text-accent-foreground font-bold",
          day_outside: "text-muted-foreground opacity-50",
          day_disabled: "text-muted-foreground opacity-50",
          day_hidden: "invisible",
        }}
        components={{
          DayContent: ({ date }) => {
            const eventTypes = getEventTypesForDate(date);
            const hasEvents = eventTypes.length > 0;
            
            return (
              <div className="flex flex-col items-center">
                <span>{date.getDate()}</span>
                {hasEvents && (
                  <div className="flex gap-0.5 mt-0.5">
                    {eventTypes.map((type, i) => {
                      const config = EVENT_TYPE_CONFIG[type as keyof typeof EVENT_TYPE_CONFIG] || EVENT_TYPE_CONFIG.other;
                      return (
                        <div
                          key={i}
                          className={cn("w-1.5 h-1.5 rounded-full", config.bgColor)}
                        />
                      );
                    })}
                  </div>
                )}
              </div>
            );
          },
        }}
      />
      
      {/* Legend */}
      <div className="mt-4 pt-4 border-t">
        <p className="text-xs font-medium text-muted-foreground mb-2">Legenda:</p>
        <div className="flex flex-wrap gap-3 text-xs">
          {Object.entries(EVENT_TYPE_CONFIG).slice(0, 5).map(([type, config]) => (
            <div key={type} className="flex items-center gap-1">
              <div className={cn("w-2 h-2 rounded-full", config.bgColor)} />
              <span className="text-muted-foreground">{config.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
