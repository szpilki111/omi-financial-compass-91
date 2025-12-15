import { CalendarEvent, EVENT_TYPE_CONFIG } from "./types";
import { EventBadge } from "./EventBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import { pl } from "date-fns/locale";
import { MapPin, Clock } from "lucide-react";

interface EventsListProps {
  events: CalendarEvent[];
  selectedDate?: Date;
  onEventClick?: (event: CalendarEvent) => void;
}

export function EventsList({ events, selectedDate, onEventClick }: EventsListProps) {
  const sortedEvents = [...events].sort((a, b) => {
    // Sort by date, then by priority
    const dateCompare = new Date(a.event_date).getTime() - new Date(b.event_date).getTime();
    if (dateCompare !== 0) return dateCompare;
    
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">
          {selectedDate 
            ? `Wydarzenia: ${format(selectedDate, "d MMMM yyyy", { locale: pl })}`
            : "Lista wydarzeń"
          }
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px] pr-4">
          {sortedEvents.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              Brak wydarzeń {selectedDate ? "w tym dniu" : ""}
            </p>
          ) : (
            <div className="space-y-3">
              {sortedEvents.map((event) => {
                const config = EVENT_TYPE_CONFIG[event.event_type] || EVENT_TYPE_CONFIG.other;
                
                return (
                  <div
                    key={event.id}
                    className="p-3 rounded-lg border bg-card hover:bg-accent/50 cursor-pointer transition-colors"
                    onClick={() => onEventClick?.(event)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-lg">{config.icon}</span>
                          <h4 className="font-medium truncate">{event.title}</h4>
                        </div>
                        
                        {event.description && (
                          <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                            {event.description}
                          </p>
                        )}
                        
                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {format(new Date(event.event_date), "d MMM yyyy", { locale: pl })}
                          </div>
                          
                          {event.location_name && (
                            <div className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {event.location_name}
                            </div>
                          )}
                          
                          {event.is_recurring && (
                            <span className="text-blue-600">🔄 Cykliczne</span>
                          )}
                        </div>
                      </div>
                      
                      <EventBadge type={event.event_type} showIcon={false} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
