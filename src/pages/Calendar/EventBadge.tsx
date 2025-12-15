import { Badge } from "@/components/ui/badge";
import { EVENT_TYPE_CONFIG, EventType } from "./types";
import { cn } from "@/lib/utils";

interface EventBadgeProps {
  type: EventType;
  className?: string;
  showIcon?: boolean;
}

export function EventBadge({ type, className, showIcon = true }: EventBadgeProps) {
  const config = EVENT_TYPE_CONFIG[type] || EVENT_TYPE_CONFIG.other;
  
  return (
    <Badge 
      variant="outline" 
      className={cn(
        "text-xs font-medium",
        config.color,
        className
      )}
    >
      {showIcon && <span className="mr-1">{config.icon}</span>}
      {config.label}
    </Badge>
  );
}
