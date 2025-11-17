import { Card, CardContent } from "@/components/ui/card";
import { Users, Clock, TrendingUp } from "lucide-react";

export default function StatsDisplay({ waitingCount, avgServiceTime, eta }) {
  const formatTime = (seconds) => {
    if (!seconds) return "לא זמין";
    const mins = Math.floor(seconds / 60);
    return `${mins} דקות`;
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <Card className="bg-white shadow-md hover:shadow-lg transition-shadow" style={{ borderColor: '#41B649', borderWidth: '1px' }}>
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl shadow-md" style={{ backgroundColor: '#41B649' }}>
              <Users className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-sm text-gray-600 font-medium">ממתינים בתור</p>
              <p className="text-3xl font-bold" style={{ color: '#111111' }}>{waitingCount}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-white shadow-md hover:shadow-lg transition-shadow" style={{ borderColor: '#41B649', borderWidth: '1px' }}>
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl shadow-md" style={{ backgroundColor: '#41B649' }}>
              <Clock className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-sm text-gray-600 font-medium">זמן שירות ממוצע</p>
              <p className="text-3xl font-bold" style={{ color: '#111111' }}>{formatTime(avgServiceTime)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-white shadow-md hover:shadow-lg transition-shadow" style={{ borderColor: '#41B649', borderWidth: '1px' }}>
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl shadow-md" style={{ backgroundColor: '#41B649' }}>
              <TrendingUp className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-sm text-gray-600 font-medium">זמן המתנה משוער</p>
              <p className="text-3xl font-bold" style={{ color: '#111111' }}>{formatTime(eta)}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}