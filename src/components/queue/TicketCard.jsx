
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, Hash } from "lucide-react";
import { format } from "date-fns";
import { he } from "date-fns/locale";

const stateColors = {
  waiting: "bg-blue-100 text-blue-800 border-blue-300",
  called: "bg-amber-100 text-amber-800 border-amber-300",
  in_service: "bg-green-100 text-green-800 border-green-300",
  served: "bg-gray-100 text-gray-600 border-gray-300",
  skipped: "bg-orange-100 text-orange-800 border-orange-300",
  cancelled: "bg-red-100 text-red-800 border-red-300"
};

const stateLabels = {
  waiting: "ממתין",
  called: "נקרא",
  in_service: "בשירות",
  served: "טופל",
  skipped: "דולג",
  cancelled: "בוטל"
};

export default function TicketCard({ ticket, showDetails = false, className = "" }) {
  return (
    <Card className={`p-4 hover:shadow-md transition-shadow bg-white border-gray-200 ${className}`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-2xl font-bold bg-gradient-to-r from-red-600 to-orange-600 bg-clip-text text-transparent">{ticket.code}</span>
            <Badge className={`${stateColors[ticket.state]} border font-medium`}>
              {stateLabels[ticket.state]}
            </Badge>
          </div>
          
          {showDetails && (
            <div className="space-y-1 text-sm text-gray-600">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                <span>נוצר: {format(new Date(ticket.created_date), "HH:mm", { locale: he })}</span>
              </div>
              {ticket.counter_id && (
                <div className="flex items-center gap-2">
                  <Hash className="w-4 h-4" />
                  <span>עמדה: {ticket.counter_id}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
