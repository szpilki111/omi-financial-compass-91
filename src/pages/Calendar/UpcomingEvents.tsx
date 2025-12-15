import { CalendarEvent, EVENT_TYPE_CONFIG } from "./types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { format, differenceInDays, isToday, isTomorrow } from "date-fns";
import { pl } from "date-fns/locale";
import { CalendarDays, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface UpcomingEventsProps {
  events: CalendarEvent[];
  limit?: number;
  showViewAll?: boolean;
  onEventClick?: (event: CalendarEvent) => void;
}

export function UpcomingEvents({ events, limit = 5, showViewAll = true, onEventClick }: UpcomingEventsProps) {
  const navigate = useNavigate();
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  // Filter upcoming events (today and future) and sort by date
  const upcomingEvents = events
    .filter(e => new Date(e.event_date) >= today)
    .sort((a, b) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime())
    .slice(0, limit);

  const getRelativeDate = (dateStr: string) => {
    const date = new Date(dateStr);
    if (isToday(date)) return "Dziś";
    if (isTomorrow(date)) return "Jutro";
    
    const days = differenceInDays(date, today);
    if (days < 7) return `Za ${days} dni`;
    
    return format(date, "d MMM", { locale: pl });
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <CalendarDays className="h-5 w-5" />
            Nadchodzące wydarzenia
          </CardTitle>
          {showViewAll && (
            <Button variant="ghost" size="sm" onClick={() => navigate("/kalendarz")}>
              Zobacz wszystkie
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {upcomingEvents.length === 0 ? (
          <p className="text-muted-foreground text-center py-4">
            Brak nadchodzących wydarzeń
          </p>
        ) : (
          <div className="space-y-2">
            {upcomingEvents.map((event) => {
              const config = EVENT_TYPE_CONFIG[event.event_type] || EVENT_TYPE_CONFIG.other;
              const relativeDate = getRelativeDate(event.event_date);
              const isUrgent = differenceInDays(new Date(event.event_date), today) <= 2;
              
              return (
                <div
                  key={event.id}
                  className={`flex items-center gap-3 p-2 rounded-md cursor-pointer transition-colors hover:bg-accent/50 ${
                    isUrgent ? 'bg-destructive/10' : ''
                  }`}
                  onClick={() => onEventClick?.(event)}
                >
                  <span className="text-lg flex-shrink-0">{config.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate text-sm">{event.title}</p>
                    {event.location_name && (
                      <p className="text-xs text-muted-foreground truncate">
                        {event.location_name}
                      </p>
                    )}
                  </div>
                  <span className={`text-xs font-medium flex-shrink-0 ${
                    isUrgent ? 'text-destructive' : 'text-muted-foreground'
                  }`}>
                    {relativeDate}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
