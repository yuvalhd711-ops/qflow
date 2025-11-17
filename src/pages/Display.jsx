
import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Card, CardContent } from "@/components/ui/card"; // Added CardContent
import { Users, Clock } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { createPageUrl } from "@/utils";
import { useBdsSubscription } from "@/components/utils/bdsSync";

export default function DisplayPage() {
  const navigate = useNavigate();
  const urlParams = new URLSearchParams(window.location.search);
  const branch_id = urlParams.get("branch_id");

  const [branches, setBranches] = useState([]); // NEW state for dynamic branches
  const [activeDepartments, setActiveDepartments] = useState([]);
  const [branchName, setBranchName] = useState("");
  const [queuesData, setQueuesData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [announcedTicketSeqs, setAnnouncedTicketSeqs] = useState({});
  const isInitialLoad = useRef(true);

  const loadBranches = useCallback(async () => {
    try {
      const list = await base44.entities.Branch.list();
      setBranches(list);
    } catch (error) {
      console.error("[Display] Error loading branches:", error);
      setBranches([]);
    }
  }, []);

  useEffect(() => {
    loadBranches();
  }, [loadBranches]);

  const speakHebrewTicket = useCallback(async (ticketSeq, queueName) => {
    if (!("speechSynthesis" in window)) return;

    const getVoicesWithRetry = () =>
      new Promise((resolve) => {
        const ss = window.speechSynthesis;
        let tries = 12;
        const tick = () => {
          const list = ss.getVoices();
          if (list && list.length) return resolve(list);
          if (--tries <= 0) return resolve([]);
          setTimeout(tick, 120);
        };
        tick();
      });

    const pickHebrewVoice = (voices) => {
      return (
        voices.find((v) => /carmit/i.test(v.name)) ||
        voices.find((v) => (v.lang || "").toLowerCase().startsWith("he")) ||
        null
      );
    };

    const ss = window.speechSynthesis;
    try {
      ss.cancel();
      ss.resume();
    } catch {}

    const voices = await getVoicesWithRetry();
    const heVoice = pickHebrewVoice(voices);

    const utteranceText = `לקוח מספר ${ticketSeq} נא לגשת ל${queueName}`;
    const utterance = new SpeechSynthesisUtterance(utteranceText);

    utterance.lang = "he-IL";
    utterance.volume = 1;
    utterance.rate = 0.95; // FIX: was 'utterate.rate'
    utterance.pitch = 1;
    if (heVoice) utterance.voice = heVoice;

    try {
      ss.resume();
    } catch {}
    ss.speak(utterance);
  }, []);

  const loadAllQueuesData = useCallback(
    async (depts) => {
      try {
        const allQueues = await base44.entities.Queue.list();
        const branchIdStr = String(branch_id);
        const branchQueues = allQueues.filter((q) => String(q.branch_id) === branchIdStr);

        const allTickets = await base44.entities.Ticket.list();

        const queueDataArray = [];

        for (const dept of depts) {
          const queue = branchQueues.find((q) => q.name === dept.department);
          if (!queue) continue;

          const queueTickets = allTickets.filter((t) => t.queue_id === queue.id);
          const current = queueTickets.filter((t) => t.state === "called" || t.state === "in_service");
          const waiting = queueTickets
            .filter((t) => t.state === "waiting")
            .sort((a, b) => a.seq - b.seq)
            .slice(0, 3);
          const waitingCount = queueTickets.filter((t) => t.state === "waiting").length;

          queueDataArray.push({
            queue,
            currentTickets: current,
            nextTickets: waiting,
            waitingCount,
            avgServiceTime: queue.avg_service_time_seconds || 180
          });
        }

        setQueuesData(queueDataArray);
      } catch (error) {
        console.error("[Display] Error loading queue data:", error);
        setQueuesData([]);
      }
    },
    [branch_id]
  );

  const loadDepartments = useCallback(async () => {
    setLoading(true);

    try {
      const allDepts = await base44.entities.BranchDepartmentSetting.list();
      const branchIdStr = String(branch_id);
      const filteredDepts = allDepts.filter(
        (d) => String(d.branch_id) === branchIdStr && d.is_active === true
      );
      setActiveDepartments(filteredDepts);

      if (branch_id) {
        const found = branches.find((b) => String(b.id) === branchIdStr); // Use dynamic branches
        setBranchName(found?.name || "");
        await loadAllQueuesData(filteredDepts);
      }
    } catch (error) {
      console.error("[Display] Error loading departments:", error);
      setActiveDepartments([]);
    }

    setLoading(false);
  }, [branch_id, branches, loadAllQueuesData]); // Added branches to dependency array

  useEffect(() => {
    // Only load departments if branches data is available (for branchName lookup)
    if (branch_id && branches.length > 0) {
      loadDepartments();
    } else if (!branch_id) {
      // If no branch_id, we are in the branch selection screen,
      // we only need branches to be loaded, not departments.
      setLoading(false);
    }
  }, [branch_id, branches, loadDepartments]);


  const displayBranchIdStr = branch_id ? String(branch_id) : null;
  useBdsSubscription(({ scope, branchId }) => {
    if (scope === "all" || (displayBranchIdStr && String(branchId) === displayBranchIdStr)) {
      loadBranches(); // Reload branches on relevant BDS events
      loadDepartments();
    }
  });

  useEffect(() => {
    if (branch_id && activeDepartments.length > 0) {
      const interval = setInterval(() => {
        loadDepartments();
      }, 15000);
      return () => clearInterval(interval);
    }
  }, [branch_id, activeDepartments.length, loadDepartments]);

  useEffect(() => {
    if (!queuesData || queuesData.length === 0) return;

    const newAnnouncedTicketSeqs = {};
    // clone sets to avoid mutating state directly
    for (const [qid, set] of Object.entries(announcedTicketSeqs)) {
      newAnnouncedTicketSeqs[qid] = new Set([...set]);
    }

    let ticketsToAnnounce = [];

    queuesData.forEach(({ queue, currentTickets }) => {
      if (!newAnnouncedTicketSeqs[queue.id]) {
        newAnnouncedTicketSeqs[queue.id] = new Set();
      }

      const currentTicketSeqsForQueue = new Set(currentTickets.map((t) => t.seq));
      const previouslyAnnouncedForQueue = newAnnouncedTicketSeqs[queue.id];

      currentTickets.forEach((ticket) => {
        if (!previouslyAnnouncedForQueue.has(ticket.seq)) {
          if (!isInitialLoad.current) {
            ticketsToAnnounce.push({ queueName: queue.name, ticketSeq: ticket.seq });
          }
          previouslyAnnouncedForQueue.add(ticket.seq);
        }
      });

      // Clean up announced tickets that are no longer current
      newAnnouncedTicketSeqs[queue.id] = new Set(
        [...previouslyAnnouncedForQueue].filter((seq) => currentTicketSeqsForQueue.has(seq))
      );
    });

    if (ticketsToAnnounce.length > 0) {
      ticketsToAnnounce
        .sort((a, b) => a.ticketSeq - b.ticketSeq)
        .forEach(({ queueName, ticketSeq }) => {
          speakHebrewTicket(ticketSeq, queueName);
        });
    }

    setAnnouncedTicketSeqs(newAnnouncedTicketSeqs);
    isInitialLoad.current = false;
  }, [queuesData, speakHebrewTicket, announcedTicketSeqs]);

  if (loading && branch_id) { // Only show loading spinner if a branch_id is specified
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#1F5F25" }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-white mx-auto mb-4"></div>
          <p className="text-xl text-white">טוען...</p>
        </div>
      </div>
    );
  }

  if (!branch_id) {
    return (
      <div className="min-h-screen text-white p-8" dir="rtl" style={{ backgroundColor: "#1F5F25" }}>
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <img
              src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68dbe1252279022b9e191013/8866f21c5_SHuk_LOGO_HAYIR.png"
              alt="שוק העיר"
              className="h-32 w-auto mx-auto mb-6"
            />
            <h1 className="text-5xl font-bold mb-4">בחר סניף להצגה</h1>
            <p className="text-2xl text-gray-300">בחר את הסניף שברצונך להציג על המסך</p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {branches.filter(b => b.is_active).map((branch) => (
              <motion.div key={branch.id} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Card
                  onClick={() => {
                    const url = createPageUrl("Display") + `?branch_id=${branch.id}`;
                    navigate(url);
                  }}
                  className="cursor-pointer hover:shadow-2xl transition-all p-12 text-center bg-white flex flex-col items-center justify-center"
                  style={{ borderColor: "#41B649", borderWidth: "2px" }}
                >
                  <img
                    src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68dbe1252279022b9e191013/8866f21c5_SHuk_LOGO_HAYIR.png"
                    alt="שוק העיר"
                    className="h-20 w-auto mb-4"
                  />
                  <h2 className="text-4xl font-bold mb-2" style={{ color: "#111111" }}>
                    {branch.name}
                  </h2>
                  <p className="text-gray-600 text-lg">לחץ להצגת הסניף</p>
                </Card>
              </motion.div>
            ))}
            {branches.length > 0 && branches.filter(b => b.is_active).length === 0 && ( // Display message only if branches loaded but none are active
              <Card className="bg-white shadow-2xl col-span-full" style={{ borderColor: "#41B649", borderWidth: "2px" }}>
                <div className="p-8 text-center">
                  <p className="text-gray-700">אין סניפים פעילים להצגה.</p>
                </div>
              </Card>
            )}
            {loading && branches.length === 0 && ( // Show loading for branches if none are loaded yet
              <div className="col-span-full text-center">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-white mx-auto mb-4"></div>
                <p className="text-xl text-white">טוען סניפים...</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-white p-6 flex flex-col" dir="rtl" style={{ backgroundColor: "#1F5F25" }}>
      <div className="flex-1 flex flex-col max-w-7xl mx-auto w-full">
        <div className="text-center mb-6">
          <img
            src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68dbe1252279022b9e191013/8866f21c5_SHuk_LOGO_HAYIR.png"
            alt="שוק העיר"
            className="h-32 w-auto mx-auto mb-4 drop-shadow-2xl"
          />
          {branchName && <h2 className="text-4xl font-bold mb-3">{branchName}</h2>}
        </div>

        <div className="flex-1">
          {queuesData.length === 0 && !loading && (
            <Card className="bg-white shadow-2xl" style={{ borderColor: "#41B649", borderWidth: "2px" }}>
              <div className="p-12 text-center">
                <p className="text-2xl font-bold mb-4" style={{ color: "#111111" }}>
                  אין תורים פעילים כרגע
                </p>
                <p className="text-gray-600 mb-2">אנא פנה למנהל המערכת</p>
                <p className="text-sm text-gray-500">branch_id: {branch_id}</p>
                <p className="text-sm text-gray-500">מחלקות פעילות: {activeDepartments.length}</p>
              </div>
            </Card>
          )}

          {/* תצוגה אופקית של כל המחלקות */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {queuesData.map(({ queue, currentTickets, nextTickets, waitingCount, avgServiceTime }) => (
              <div key={queue.id} className="flex flex-col">
                <Card className="bg-white shadow-xl flex-1 flex flex-col" style={{ borderColor: '#41B649', borderWidth: '2px' }}>
                  <CardContent className="p-4 flex-1 flex flex-col">
                    {/* כותרת המחלקה */}
                    <div className="text-center mb-3">
                      <h1 className="text-2xl font-bold" style={{ color: '#111111' }}>{queue.name}</h1>
                      <div className="flex items-center justify-center gap-4 text-sm mt-2" style={{ color: '#111111' }}>
                        <div className="flex items-center gap-1">
                          <Users className="w-4 h-4" />
                          <span>ממתינים: {waitingCount}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          <span>זמן: {Math.floor(avgServiceTime / 60)} דק'</span>
                        </div>
                      </div>
                    </div>

                    {/* נקראים כעת */}
                    <div className="mb-3">
                      <h3 className="text-lg font-bold text-center mb-2" style={{ color: '#111111' }}>נקראים כעת</h3>
                      <div className="space-y-2">
                        <AnimatePresence mode="popLayout">
                          {currentTickets.length === 0 ? (
                            <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                              <Card className="p-4 text-center" style={{ backgroundColor: '#E6F9EA', borderColor: "#41B649", borderWidth: "1px" }}>
                                <p className="text-lg text-gray-400">אין קריאות</p>
                              </Card>
                            </motion.div>
                          ) : (
                            currentTickets.map((ticket) => (
                              <motion.div
                                key={ticket.id}
                                initial={{ scale: 0.8, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 0.8, opacity: 0 }}
                              >
                                <Card className="p-3 text-center shadow-lg" style={{ backgroundColor: '#E6F9EA', borderColor: "#41B649", borderWidth: "2px" }}>
                                  <div className="text-4xl font-bold drop-shadow-lg" style={{ color: "#E52521" }}>
                                    {ticket.seq}
                                  </div>
                                  <div className="text-base font-semibold mt-1" style={{ color: "#111111" }}>
                                    גש/י לדלפק
                                  </div>
                                </Card>
                              </motion.div>
                            ))
                          )}
                        </AnimatePresence>
                      </div>
                    </div>

                    {/* הבאים בתור */}
                    <div>
                      <h3 className="text-lg font-bold text-center mb-2" style={{ color: '#111111' }}>הבאים בתור</h3>
                      <div className="space-y-2">
                        <AnimatePresence mode="popLayout">
                          {nextTickets.length === 0 ? (
                            <motion.div key="empty-next" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                              <Card className="p-3 text-center" style={{ backgroundColor: '#E6F9EA', borderColor: "#41B649", borderWidth: "1px" }}>
                                <p className="text-sm text-gray-400">אין ממתינים</p>
                              </Card>
                            </motion.div>
                          ) : (
                            nextTickets.map((ticket) => (
                              <motion.div key={ticket.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
                                <Card className="p-2 text-center" style={{ backgroundColor: '#E6F9EA', borderColor: "#41B649", borderWidth: "1px" }}>
                                  <div className="text-2xl font-bold" style={{ color: "#E52521" }}>
                                    {ticket.seq}
                                  </div>
                                </Card>
                              </motion.div>
                            ))
                          )}
                        </AnimatePresence>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ))}
          </div>
        </div>

        <div className="text-center mt-6 pt-4 border-t-2" style={{ borderColor: "rgba(255,255,255,0.2)" }}>
          <img
            src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68dbe1252279022b9e191013/8866f21c5_SHuk_LOGO_HAYIR.png"
            alt="שוק העיר"
            className="h-24 w-auto mx-auto drop-shadow-2xl"
          />
        </div>
      </div>
    </div>
  );
}
