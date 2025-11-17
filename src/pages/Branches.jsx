
import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Building2, 
  Users, 
  Clock, 
  CheckCircle, 
  Smartphone,
  Tv,
  Monitor,
  TrendingUp,
  AlertCircle,
  Copy,
  Check
} from "lucide-react";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { useBdsSubscription } from "@/components/utils/bdsSync";

// REMOVED: const BRANCHES array - branches are now fetched dynamically

export default function BranchesPage() {
  const [branches, setBranches] = useState([]); // NEW: dynamic branches list
  const [branchesData, setBranchesData] = useState([]); // Data for each branch including stats
  const [loading, setLoading] = useState(true);
  const [totalStats, setTotalStats] = useState({
    totalWaiting: 0,
    totalServedToday: 0,
    activeBranches: 0
  });
  const [copiedUrl, setCopiedUrl] = useState(null);

  /**
   * Fetches the latest list of branches and then processes all related data
   * (queues, tickets, settings) to calculate real-time statistics for each branch.
   * This combined approach ensures data consistency and avoids race conditions
   * that can occur with separate state updates.
   */
  const fetchAndProcessAllBranchData = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Fetch the dynamic list of branches
      const fetchedBranches = await base44.entities.Branch.list();
      setBranches(fetchedBranches); // Update the branches state for display count etc.

      // 2. Fetch all related entities needed for statistics
      const allQueues = await base44.entities.Queue.list();
      const allTickets = await base44.entities.Ticket.list();
      const allSettings = await base44.entities.BranchDepartmentSetting.list(); 
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      let totalWaiting = 0;
      let totalServedToday = 0;
      let activeBranchesCount = 0; // Renamed to avoid shadowing

      // 3. Process data for each fetched branch
      const branchStats = fetchedBranches.map(branch => { // Iterate over the freshly fetched branches
        const branchIdStr = String(branch.id);

        // Determine if a branch is active based on its own 'is_active' property
        // and if it has any active BranchDepartmentSettings
        const branchActiveSettings = allSettings.filter(s => String(s.branch_id) === branchIdStr && s.is_active === true);
        const isActive = branch.is_active && branchActiveSettings.length > 0;

        // Filter queues belonging to this branch
        const branchQueues = allQueues.filter(q => String(q.branch_id) === branchIdStr);
        const queueIds = branchQueues.map(q => q.id);
        
        // Filter tickets belonging to these queues
        const branchTickets = allTickets.filter(t => queueIds.includes(t.queue_id));
        
        const waiting = branchTickets.filter(t => 
          t.state === "waiting" || t.state === "called" || t.state === "in_service"
        ).length;
        
        const servedToday = branchTickets.filter(t => 
          t.state === "served" && t.finished_at && new Date(t.finished_at) >= today
        ).length;
        
        const avgServiceTime = branchQueues.length > 0
          ? Math.floor(branchQueues.reduce((sum, q) => sum + (q.avg_service_time_seconds || 180), 0) / branchQueues.length)
          : 180;

        if (isActive) {
          activeBranchesCount++;
        }
        
        totalWaiting += waiting;
        totalServedToday += servedToday;

        console.log(`[Branches] Branch ${branch.name}: ${branchActiveSettings.length} active departments, isActive=${isActive}`);

        return {
          ...branch, // Spread all properties from the fetched branch
          queues: branchActiveSettings.length, // show active departments count based on BDS
          waiting,
          servedToday,
          avgServiceTime,
          isActive
        };
      });

      setBranchesData(branchStats);
      setTotalStats({ totalWaiting, totalServedToday, activeBranches: activeBranchesCount });
    } catch (error) {
      console.error("Failed to load branches or branch data:", error);
      // Handle error gracefully, e.g., set empty states
      setBranches([]);
      setBranchesData([]);
      setTotalStats({ totalWaiting: 0, totalServedToday: 0, activeBranches: 0 });
    } finally {
      setLoading(false);
    }
  }, []); // Memoize the function using useCallback

  // Initial data load on component mount
  useEffect(() => {
    fetchAndProcessAllBranchData();
  }, [fetchAndProcessAllBranchData]); // Dependency on the memoized function

  // Subscribe to BDS settings changes (top-level hook)
  // This hook will handle its own subscription lifecycle internally.
  useBdsSubscription(() => {
    console.log("BDS update detected, reloading branch data.");
    fetchAndProcessAllBranchData(); // Trigger a full reload of all branch data
  });

  const copyToClipboard = async (url, key) => {
    try {
      const fullUrl = window.location.origin + url;
      await navigator.clipboard.writeText(fullUrl);
      setCopiedUrl(key);
      setTimeout(() => setCopiedUrl(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 via-red-50 to-green-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-green-600 mx-auto mb-4"></div>
          <p className="text-xl text-gray-600">טוען נתוני סניפים...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" dir="rtl" style={{ backgroundColor: '#E6F9EA' }}>
      <div className="container mx-auto px-4 py-12">
        <div className="text-center mb-12">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5 }}
          >
            <img 
              src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68dbe1252279022b9e191013/8866f21c3_SHuk_LOGO_HAYIR.png"
              alt="שוק העיר"
              className="h-24 w-auto mx-auto mb-6"
            />
            <h1 className="text-5xl md:text-6xl font-bold mb-4" style={{ color: '#111111' }}>
              מרכז שליטה - כל הסניפים
            </h1>
            <p className="text-xl text-gray-700">
              סקירה מלאה על כל {branches.length} הסניפים של שוק העיר {/* CHANGED: Use dynamic branches.length */}
            </p>
          </motion.div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }}>
            <Card className="bg-white shadow-lg hover:shadow-xl transition-shadow" style={{ borderColor: '#41B649', borderWidth: '1px' }}>
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-xl shadow-md" style={{ backgroundColor: '#41B649' }}>
                    <Building2 className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 font-medium">סניפים פעילים</p>
                    <p className="text-3xl font-bold" style={{ color: '#111111' }}>{totalStats.activeBranches}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }}>
            <Card className="bg-white shadow-lg hover:shadow-xl transition-shadow" style={{ borderColor: '#41B649', borderWidth: '1px' }}>
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-xl shadow-md" style={{ backgroundColor: '#41B649' }}>
                    <Clock className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 font-medium">סה״כ ממתינים</p>
                    <p className="text-3xl font-bold" style={{ color: '#111111' }}>{totalStats.totalWaiting}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.3 }}>
            <Card className="bg-white shadow-lg hover:shadow-xl transition-shadow" style={{ borderColor: '#41B649', borderWidth: '1px' }}>
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-xl shadow-md" style={{ backgroundColor: '#41B649' }}>
                    <CheckCircle className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 font-medium">טופלו היום</p>
                    <p className="text-3xl font-bold" style={{ color: '#111111' }}>{totalStats.totalServedToday}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {branchesData.map((branch, index) => (
            <motion.div key={branch.id} initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.05 * index }}>
              <Card className={`bg-white hover:shadow-2xl transition-all duration-300 h-full border-2`} 
              style={{ borderColor: branch.isActive ? '#41B649' : '#d1d5db' }}>
                <CardHeader className="pb-3" style={{ backgroundColor: branch.isActive ? '#E6F9EA' : '#f9fafb' }}>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-2xl" style={{ color: '#111111' }}>{branch.name}</CardTitle>
                    {branch.isActive ? (
                      <Badge style={{ backgroundColor: '#E6F9EA', color: '#41B649', borderColor: '#41B649', borderWidth: '1px' }}>פעיל</Badge>
                    ) : (
                      <Badge className="bg-gray-100 text-gray-600 border-gray-300">
                        <AlertCircle className="w-3 h-3 mr-1" />
                        לא פעיל
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="p-6">
                  {branch.isActive ? (
                    <>
                      <div className="grid grid-cols-2 gap-4 mb-6">
                        <div className="text-center p-3 rounded-lg" style={{ backgroundColor: '#E6F9EA' }}>
                          <Users className="w-5 h-5 mx-auto mb-1" style={{ color: '#41B649' }} />
                          <p className="text-2xl font-bold" style={{ color: '#111111' }}>{branch.waiting}</p>
                          <p className="text-xs text-gray-600">ממתינים</p>
                        </div>
                        <div className="text-center p-3 rounded-lg" style={{ backgroundColor: '#E6F9EA' }}>
                          <CheckCircle className="w-5 h-5 mx-auto mb-1" style={{ color: '#41B649' }} />
                          <p className="text-2xl font-bold" style={{ color: '#111111' }}>{branch.servedToday}</p>
                          <p className="text-xs text-gray-600">טופלו היום</p>
                        </div>
                      </div>

                      <div className="space-y-2 mb-4">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600">תורים פעילים:</span>
                          <span className="font-bold" style={{ color: '#111111' }}>{branch.queues}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600">זמן ממוצע:</span>
                          <span className="font-bold" style={{ color: '#111111' }}>{Math.floor(branch.avgServiceTime / 60)} דקות</span>
                        </div>
                      </div>

                      {/* NEW: קישורים מהירים */}
                      <div className="mb-4 p-3 rounded-lg space-y-2" style={{ backgroundColor: '#E6F9EA' }}>
                        <h4 className="text-sm font-bold mb-2" style={{ color: '#111111' }}>קישורים מהירים:</h4>
                        
                        <div className="flex items-center gap-2">
                          <Smartphone className="w-4 h-4" style={{ color: '#41B649' }} />
                          <span className="text-xs flex-1 font-medium" style={{ color: '#111111' }}>קיוסק</span>
                          <Button
                            onClick={() => copyToClipboard(`${createPageUrl("Kiosk")}?branch_id=${branch.id}`, `kiosk-${branch.id}`)}
                            variant="outline"
                            size="sm"
                            className="h-7 px-2 gap-1"
                            style={{ borderColor: '#41B649', color: '#41B649' }}
                          >
                            {copiedUrl === `kiosk-${branch.id}` ? (
                              <><Check className="w-3 h-3" /> הועתק</>
                            ) : (
                              <><Copy className="w-3 h-3" /> העתק</>
                            )}
                          </Button>
                        </div>

                        <div className="flex items-center gap-2">
                          <Tv className="w-4 h-4" style={{ color: '#41B649' }} />
                          <span className="text-xs flex-1 font-medium" style={{ color: '#111111' }}>מסך תצוגה</span>
                          <Button
                            onClick={() => copyToClipboard(`${createPageUrl("Display")}?branch_id=${branch.id}`, `display-${branch.id}`)}
                            variant="outline"
                            size="sm"
                            className="h-7 px-2 gap-1"
                            style={{ borderColor: '#41B649', color: '#41B649' }}
                          >
                            {copiedUrl === `display-${branch.id}` ? (
                              <><Check className="w-3 h-3" /> הועתק</>
                            ) : (
                              <><Copy className="w-3 h-3" /> העתק</>
                            )}
                          </Button>
                        </div>

                        <div className="flex items-center gap-2">
                          <Monitor className="w-4 h-4" style={{ color: '#41B649' }} />
                          <span className="text-xs flex-1 font-medium" style={{ color: '#111111' }}>קונסולת עובד</span>
                          <Button
                            onClick={() => copyToClipboard(`${createPageUrl("Console")}?branch_id=${branch.id}`, `console-${branch.id}`)}
                            variant="outline"
                            size="sm"
                            className="h-7 px-2 gap-1"
                            style={{ borderColor: '#41B649', color: '#41B649' }}
                          >
                            {copiedUrl === `console-${branch.id}` ? (
                              <><Check className="w-3 h-3" /> הועתק</>
                            ) : (
                              <><Copy className="w-3 h-3" /> העתק</>
                            )}
                          </Button>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        <Link to={`${createPageUrl("Kiosk")}?branch_id=${branch.id}`}>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="w-full gap-1 text-white hover:opacity-90" 
                            style={{ backgroundColor: '#E52521', borderColor: '#E52521' }} 
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#BD1F1C'} 
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#E52521'}
                          >
                            <Smartphone className="w-3 h-3" />
                            <span className="text-xs">קיוסק</span>
                          </Button>
                        </Link>
                        <Link to={`${createPageUrl("Display")}?branch_id=${branch.id}`}>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="w-full gap-1 text-white hover:opacity-90" 
                            style={{ backgroundColor: '#E52521', borderColor: '#E52521' }} 
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#BD1F1C'} 
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#E52521'}
                          >
                            <Tv className="w-3 h-3" />
                            <span className="text-xs">תצוגה</span>
                          </Button>
                        </Link>
                        <Link to={`${createPageUrl("Console")}?branch_id=${branch.id}`}> {/* Updated to pass branch_id */}
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="w-full gap-1 text-white hover:opacity-90" 
                            style={{ backgroundColor: '#E52521', borderColor: '#E52521' }} 
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#BD1F1C'} 
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#E52521'}
                          >
                            <Monitor className="w-3 h-3" />
                            <span className="text-xs">קונסולה</span>
                          </Button>
                        </Link>
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-8">
                      <AlertCircle className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                      <p className="text-gray-500">אין תורים פעילים בסניף זה</p>
                      <Link to={createPageUrl("Admin")}>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="mt-4 gap-2 text-white hover:opacity-90" 
                          style={{ backgroundColor: '#E52521' }} 
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#BD1F1C'} 
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#E52521'}
                        >
                          <TrendingUp className="w-4 h-4" />
                          הגדר תורים
                        </Button>
                      </Link>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
