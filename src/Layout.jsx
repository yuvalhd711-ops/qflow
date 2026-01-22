import React from "react";
import { Link, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { 
  LayoutDashboard, 
  Tv, 
  Settings,
  LogOut,
  Smartphone,
  Users,
  Building2
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";

export default function Layout({ children, currentPageName }) {
  const location = useLocation();
  const [user, setUser] = React.useState(null);
  const [ipBlocked, setIpBlocked] = React.useState(false);
  const [clientIP, setClientIP] = React.useState(null);

  React.useEffect(() => {
    checkAccess();
  }, []);

  const checkAccess = async () => {
    try {
      const { data } = await base44.functions.invoke('checkIPAccess', {});
      
      if (!data.allowed) {
        setIpBlocked(true);
        setClientIP(data.clientIP);
        return;
      }
      
      loadUser();
    } catch (error) {
      console.error("Error checking IP access:", error);
      loadUser(); // Fail open - allow access on error
    }
  };

  const loadUser = async () => {
    try {
      const userData = await base44.auth.me();
      setUser(userData);
    } catch (error) {
      console.log("User not logged in");
    }
  };

  const handleLogout = async () => {
    await base44.auth.logout();
    window.location.reload();
  };

  const navigationItems = [
    {
      title: "דף הבית",
      url: createPageUrl("Home"),
      icon: LayoutDashboard,
    },
    {
      title: "קיוסק - קבלת מספר",
      url: createPageUrl("Kiosk"),
      icon: Smartphone,
    },
    {
      title: "קונסולת עובד",
      url: createPageUrl("Console"),
      icon: Users,
    },
    {
      title: "מסך תצוגה",
      url: createPageUrl("Display"),
      icon: Tv,
    },
    {
      title: "ניהול מערכת",
      url: createPageUrl("Admin"),
      icon: Settings,
    },
    {
      title: "ניהול סניפים",
      url: createPageUrl("Branches"),
      icon: Building2,
    }
  ];

  if (ipBlocked) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" dir="rtl" style={{ backgroundColor: '#E6F9EA' }}>
        <div className="max-w-md w-full bg-white rounded-xl shadow-2xl p-8 text-center" style={{ borderColor: '#E52521', borderWidth: '3px', borderStyle: 'solid' }}>
          <div className="text-6xl mb-4">🚫</div>
          <h1 className="text-3xl font-bold mb-4" style={{ color: '#E52521' }}>גישה נחסמה</h1>
          <p className="text-gray-700 text-lg mb-6">
            כתובת ה-IP שלך אינה מורשית לגשת למערכת זו.
          </p>
          {clientIP && (
            <div className="bg-gray-100 rounded-lg p-4 mb-6">
              <p className="text-sm text-gray-600 mb-1">כתובת ה-IP שלך:</p>
              <p className="font-mono font-bold text-lg" style={{ color: '#E52521' }}>{clientIP}</p>
            </div>
          )}
          <p className="text-gray-600 text-sm">
            אם אתה צריך גישה למערכת, אנא פנה למנהל המערכת כדי להוסיף את כתובת ה-IP שלך לרשימת הכתובות המורשות.
          </p>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <style>{`
        :root {
          --shuk-red: #E52521;
          --shuk-red-dark: #BD1F1C;
          --shuk-green: #41B649;
          --shuk-green-dark: #1F5F25;
          --shuk-green-light: #E6F9EA;
        }
      `}</style>
      <div className="min-h-screen flex w-full" dir="rtl" style={{ backgroundColor: '#E6F9EA' }}>
        {user && (
          <Sidebar side="right" className="border-l bg-white" style={{ borderColor: '#41B649' }}>
            <SidebarHeader className="border-b p-4" style={{ backgroundColor: '#E6F9EA', borderColor: '#41B649' }}>
              <div className="flex items-center gap-3">
                <img 
                  src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68dbe1252279022b9e191013/8866f21c5_SHuk_LOGO_HAYIR.png"
                  alt="שוק העיר"
                  className="h-12 w-auto"
                />
                <div>
                  <h2 className="font-bold" style={{ color: '#1F5F25' }}>מערכת תורים</h2>
                  <p className="text-xs text-gray-600">שוק העיר</p>
                </div>
              </div>
            </SidebarHeader>
            
            <SidebarContent className="p-2 bg-white">
              <SidebarGroup>
                <SidebarGroupLabel className="text-xs font-medium text-gray-600 uppercase tracking-wider px-2 py-2">
                  ניווט
                </SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {navigationItems.map((item) => (
                      <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton 
                          asChild 
                          className={`hover:text-gray-900 transition-colors duration-200 rounded-lg mb-1 ${
                            location.pathname === item.url ? 'shadow-sm' : ''
                          }`}
                          style={location.pathname === item.url ? { 
                            backgroundColor: '#E6F9EA',
                            color: '#1F5F25'
                          } : {}}
                        >
                          <Link to={item.url} className="flex items-center gap-3 px-3 py-2">
                            <item.icon className="w-4 h-4" />
                            <span className="font-medium">{item.title}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            </SidebarContent>

            <SidebarFooter className="border-t p-4" style={{ backgroundColor: '#E6F9EA', borderColor: '#41B649' }}>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center shadow-md" style={{ backgroundColor: '#41B649' }}>
                    <span className="text-white font-medium text-sm">
                      {user.full_name?.[0] || user.email[0].toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate" style={{ color: '#1F5F25' }}>
                      {user.full_name || user.email}
                    </p>
                    <p className="text-xs text-gray-600 truncate">{user.role}</p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleLogout}
                  className="w-full gap-2 text-white hover:opacity-90"
                  style={{ backgroundColor: '#E52521', borderColor: '#E52521' }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#BD1F1C'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#E52521'}
                >
                  <LogOut className="w-4 h-4" />
                  התנתק
                </Button>
              </div>
            </SidebarFooter>
          </Sidebar>
        )}

        <main className="flex-1 flex flex-col">
          {user && (
            <header className="bg-white px-6 py-4 md:hidden" style={{ borderBottom: '1px solid #41B649' }}>
              <div className="flex items-center gap-4">
                <SidebarTrigger className="p-2 rounded-lg transition-colors duration-200" style={{ hover: { backgroundColor: '#E6F9EA' } }} />
                <img 
                  src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68dbe1252279022b9e191013/8866f21c5_SHuk_LOGO_HAYIR.png"
                  alt="שוק העיר"
                  className="h-8 w-auto"
                />
              </div>
            </header>
          )}

          <div className="flex-1 overflow-auto">
            {children}
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}