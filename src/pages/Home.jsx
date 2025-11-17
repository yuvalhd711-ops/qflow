
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Smartphone, 
  Users, 
  Tv, 
  Settings,
  TrendingUp,
  Clock,
  CheckCircle,
  Building2
} from "lucide-react";
import { motion } from "framer-motion";
import { useBdsSubscription } from "@/components/utils/bdsSync";

export default function HomePage() {
  const [user, setUser] = useState(null);
  const [stats, setStats] = useState({
    totalQueues: 0,
    activeTickets: 0,
    servedToday: 0
  });

  useEffect(() => {
    loadData();
  }, []);

  // Subscribe to BranchDepartmentSetting changes (top-level hook)
  // This hook now manages its own subscription lifecycle internally.
  useBdsSubscription(() => {
    loadData();
  });

  const loadData = async () => {
    try {
      const userData = await base44.auth.me();
      setUser(userData);
      
      const filterBranchId = userData.branch_id ? String(userData.branch_id) : null;

      // Source of truth: BranchDepartmentSetting
      // We list all BranchDepartmentSetting and then filter them client-side
      // based on the user's branch_id and active status.
      const allSettings = await base44.entities.BranchDepartmentSetting.list();
      const activeSettings = allSettings.filter(s => 
        (filterBranchId ? String(s.branch_id) === filterBranchId : true) && s.is_active === true
      );
      const totalActiveDepartments = activeSettings.length;

      const tickets = await base44.entities.Ticket.list();
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const activeTickets = tickets.filter(t => 
        t.state === "waiting" || t.state === "called" || t.state === "in_service"
      ).length;
      
      const servedToday = tickets.filter(t => 
        t.state === "served" && t.finished_at && new Date(t.finished_at) >= today
      ).length;

      setStats({
        totalQueues: totalActiveDepartments, // show active departments count
        activeTickets,
        servedToday
      });
    } catch (error) {
      console.log("User not logged in", error); // Log the error for more context
    }
  };

  const features = [
    {
      title: "קיוסק - קבלת מספר",
      description: "מסך לקוחות לקבלת מספר תור",
      icon: Smartphone,
      link: createPageUrl("Kiosk"),
      public: true
    },
    {
      title: "קונסולת עובד",
      description: "ניהול התור וקריאת לקוחות",
      icon: Users,
      link: createPageUrl("Console"),
      public: false
    },
    {
      title: "מסך תצוגה",
      description: "מסך טלוויזיה להצגת התור",
      icon: Tv,
      link: createPageUrl("Display"),
      public: true
    },
    {
      title: "ניהול מערכת",
      description: "הגדרת תורים ועמדות",
      icon: Settings,
      link: createPageUrl("Admin")
    },
    {
      title: "ניהול סניפים",
      description: "סקירה ושליטה על כל הסניפים",
      icon: Building2,
      link: createPageUrl("Branches")
    }
  ];

  return (
    <div className="min-h-screen" dir="rtl" style={{ backgroundColor: '#E6F9EA' }}>
      <div className="container mx-auto px-4 py-12">
        <div className="text-center mb-16">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5 }}
          >
            <img 
              src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68dbe1252279022b9e191013/8866f21c5_SHuk_LOGO_HAYIR.png"
              alt="שוק העיר"
              className="h-28 w-auto mx-auto mb-6"
            />
            <h1 className="text-5xl md:text-6xl font-bold mb-4" style={{ color: '#111111' }}>
              מערכת ניהול תורים דיגיטלית
            </h1>
            <p className="text-xl text-gray-700">
              שוק העיר - פתרון מקצועי לניהול תורים
            </p>
          </motion.div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1 }}
          >
            <Card className="bg-white shadow-lg hover:shadow-xl transition-shadow" style={{ borderColor: '#41B649', borderWidth: '1px' }}>
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-xl shadow-md" style={{ backgroundColor: '#41B649' }}>
                    <TrendingUp className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 font-medium">מחלקות פעילות</p>
                    <p className="text-3xl font-bold" style={{ color: '#111111' }}>{stats.totalQueues}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="bg-white shadow-lg hover:shadow-xl transition-shadow" style={{ borderColor: '#41B649', borderWidth: '1px' }}>
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-xl shadow-md" style={{ backgroundColor: '#41B649' }}>
                    <Clock className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 font-medium">ממתינים כעת</p>
                    <p className="text-3xl font-bold" style={{ color: '#111111' }}>{stats.activeTickets}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            <Card className="bg-white shadow-lg hover:shadow-xl transition-shadow" style={{ borderColor: '#41B649', borderWidth: '1px' }}>
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-xl shadow-md" style={{ backgroundColor: '#41B649' }}>
                    <CheckCircle className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 font-medium">טופלו היום</p>
                    <p className="text-3xl font-bold" style={{ color: '#111111' }}>{stats.servedToday}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-8" style={{ color: '#111111' }}>
            בחר מסך
          </h2>
          <div className="grid md:grid-cols-2 gap-6">
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ y: 30, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.1 * index }}
              >
                <Link to={feature.link}>
                  <Card className="bg-white hover:shadow-2xl transition-all duration-300 cursor-pointer group overflow-hidden h-full" style={{ borderColor: '#41B649', borderWidth: '1px' }}>
                    <CardHeader className="pb-4">
                      <div className="flex items-center gap-4">
                        <div className="p-4 rounded-2xl group-hover:scale-110 transition-transform duration-300 shadow-lg" style={{ backgroundColor: '#41B649' }}>
                          <feature.icon className="w-8 h-8 text-white" />
                        </div>
                        <div className="flex-1">
                          <CardTitle className="text-2xl mb-2" style={{ color: '#111111' }}>{feature.title}</CardTitle>
                          <p className="text-gray-600">{feature.description}</p>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <Button 
                        className="w-full text-white hover:opacity-90 shadow-md"
                        style={{ backgroundColor: '#E52521' }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#BD1F1C'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#E52521'}
                      >
                        פתח מסך
                      </Button>
                    </CardContent>
                  </Card>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>

        <div className="mt-16 max-w-3xl mx-auto">
          <Card className="bg-white shadow-xl" style={{ borderColor: '#41B649', borderWidth: '1px' }}>
            <CardContent className="p-8 text-center">
              <h3 className="text-2xl font-bold mb-4" style={{ color: '#111111' }}>
                איך זה עובד?
              </h3>
              <div className="space-y-3 text-right text-gray-700">
                <p className="flex items-start gap-3">
                  <span className="flex items-center justify-center w-8 h-8 rounded-full text-white font-bold text-sm flex-shrink-0" style={{ backgroundColor: '#41B649' }}>1</span>
                  <span><strong>קיוסק:</strong> לקוחות לוחצים "קח מספר" ומקבלים כרטיס עם מספר תור</span>
                </p>
                <p className="flex items-start gap-3">
                  <span className="flex items-center justify-center w-8 h-8 rounded-full text-white font-bold text-sm flex-shrink-0" style={{ backgroundColor: '#41B649' }}>2</span>
                  <span><strong>קונסולת עובד:</strong> העובד לוחץ "קרא הבא" ומטפל בלקוח</span>
                </p>
                <p className="flex items-start gap-3">
                  <span className="flex items-center justify-center w-8 h-8 rounded-full text-sm flex-shrink-0 text-white font-bold" style={{ backgroundColor: '#41B649' }}>3</span>
                  <span><strong>מסך תצוגה:</strong> כל הלקוחות רואים על מסך טלוויזיה מי נקרא ומי הבאים בתור</span>
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
