
import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  PhoneCall, Volume2, SkipForward,
  ArrowRightLeft, XCircle, Coffee, RotateCcw,
  History // NEW: Import History icon
} from "lucide-react";
import { motion } from "framer-motion";
import AudioNotification from "../components/queue/AudioNotification";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createPageUrl } from "@/utils";
import { useBdsSubscription } from "@/components/utils/bdsSync";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"; // NEW: Import Tabs components
import { Badge } from "@/components/ui/badge"; // NEW: Import Badge

export default function ConsolePage() {
  const navigate = useNavigate();
  const urlParams = new URLSearchParams(window.location.search);
  const branch_id = urlParams.get('branch_id'); // כ-string
  const queue_id = urlParams.get('queue_id');

  const [activeDepartments, setActiveDepartments] = useState([]);
  const [user, setUser] = useState(null);
  const [queue, setQueue] = useState(null);
  const [currentTicket, setCurrentTicket] = useState(null);
  const [waitingTickets, setWaitingTickets] = useState([]);
  const [transferDialog, setTransferDialog] = useState(false);
  const [targetDepartmentName, setTargetDepartmentName] = useState("");
  const [loading, setLoading] = useState(true);
  const [playAudio, setPlayAudio] = useState(null);
  const [onBreak, setOnBreak] = useState(false);
  // NEW: dynamic branches list
  const [branches, setBranches] = useState([]);

  // NEW: חיפוש תור
  const [searchSeq, setSearchSeq] = useState("");
  const [foundTicket, setFoundTicket] = useState(null);
  const [searchMessage, setSearchMessage] = useState("");

  // NEW: history state
  const [historyTickets, setHistoryTickets] = useState([]);
  const [historySearchSeq, setHistorySearchSeq] = useState("");

  const loadBranches = useCallback(async () => {
    try {
      const list = await base44.entities.Branch.list();
      setBranches(list);
    } catch (error) {
      console.error("Error loading branches:", error);
      setBranches([]);
    }
  }, []);

  const loadQueue = useCallback(async () => {
    if (!queue_id) return;
    try {
      const queueData = await base44.entities.Queue.get(queue_id);
      setQueue(queueData);
    } catch (error) {
      console.error("Queue not found:", error);
      setQueue(null);
      const url = createPageUrl("Console") + (branch_id ? `?branch_id=${branch_id}` : '');
      navigate(url);
    }
  }, [queue_id, branch_id, navigate]);

  const loadData = useCallback(async () => {
    if (!queue_id) return;

    try {
      const tickets = await base44.entities.Ticket.filter({ queue_id, state: "waiting" }, "seq");
      setWaitingTickets(tickets);

      const currentTickets = await base44.entities.Ticket.filter({ queue_id });
      const activeTicket = currentTickets.find(t => t.state === "called" || t.state === "in_service");
      setCurrentTicket(activeTicket || null);

      // NEW: load history tickets (today)
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const allTickets = await base44.entities.Ticket.filter({ queue_id });
      const todayHistory = allTickets.filter(t =>
        (t.state === "served" || t.state === "cancelled" || t.state === "skipped") &&
        new Date(t.created_date) >= today
      ).sort((a, b) => new Date(b.finished_at || b.updated_date) - new Date(a.finished_at || a.updated_date));
      setHistoryTickets(todayHistory);
    } catch (error) {
      console.error("Error loading data:", error);
      setWaitingTickets([]);
      setCurrentTicket(null);
      setHistoryTickets([]);
    }
  }, [queue_id]);

  useEffect(() => {
    loadBranches();
  }, [loadBranches]);

  useEffect(() => {
    const loadDepartments = async () => {
      const userData = await base44.auth.me();
      setUser(userData);

      const filterBranchId = branch_id || userData.branch_id;

      console.log(`[Console] Loading departments for branch_id: ${filterBranchId} (type: ${typeof filterBranchId})`);

      try {
        const allDepts = await base44.entities.BranchDepartmentSetting.list();
        console.log(`[Console] All BranchDepartmentSettings:`, allDepts);

        const filteredDepts = allDepts.filter(d => {
          const branchIdMatch = String(d.branch_id) === String(filterBranchId);
          const isActiveMatch = d.is_active === true;
          const matches = branchIdMatch && isActiveMatch;
          console.log(`[Console] Dept "${d.department}": branch_id="${d.branch_id}" (type: ${typeof d.branch_id}) vs "${filterBranchId}", match=${branchIdMatch}, is_active=${d.is_active}, final=${matches}`);
          return matches;
        });

        console.log(`[Console] Filtered to ${filteredDepts.length} active departments:`, filteredDepts);
        setActiveDepartments(filteredDepts);
      } catch (error) {
        console.error('[Console] Error loading departments:', error);
        setActiveDepartments([]);
      }

      setLoading(false);
    };

    loadDepartments();

    if (branch_id) {
      const interval = setInterval(loadDepartments, 10000);
      return () => clearInterval(interval);
    }
  }, [branch_id]);

  useEffect(() => {
    if (queue_id) {
      loadQueue();
      loadData();
      const interval = setInterval(loadData, 10000);
      return () => clearInterval(interval);
    }
  }, [queue_id, loadQueue, loadData]);

  // Live sync with Admin toggles (top-level hook, not inside useEffect)
  const filterBranchId = branch_id || user?.branch_id;
  const consoleBranchIdStr = filterBranchId ? String(filterBranchId) : null;
  useBdsSubscription(({ scope, branchId }) => {
    if (scope === "all" || (consoleBranchIdStr && String(branchId) === consoleBranchIdStr)) {
      (async () => {
        const allDepts = await base44.entities.BranchDepartmentSetting.list();
        const filteredDepts = allDepts.filter(d => String(d.branch_id) === String(consoleBranchIdStr) && d.is_active === true);
        setActiveDepartments(filteredDepts);
        await loadData();
        await loadBranches(); // refresh branches on broadcast
      })();
    }
  });

  const ensureQueue = async (branchId, deptName) => {
    const allQueues = await base44.entities.Queue.list();
    let q = allQueues.find(qq => String(qq.branch_id) === String(branchId) && qq.name === deptName);
    if (q) return q;
    return await base44.entities.Queue.create({
      branch_id: String(branchId),
      name: deptName,
      seq_counter: 0,
      avg_service_time_seconds: 180,
      is_active: true
    });
  };

  const selectDepartment = async (deptName) => {
    const filterBranchId = branch_id || user?.branch_id;
    const branchIdStr = String(filterBranchId);
    console.log(`[Console] Selecting department: ${deptName} for branch ${branchIdStr}`);

    try {
      const q = await ensureQueue(branchIdStr, deptName);
      let url = createPageUrl("Console");
      const params = new URLSearchParams();
      if (branch_id) params.append('branch_id', branch_id);
      params.append('queue_id', q.id);
      url += "?" + params.toString();
      navigate(url);
    } catch (error) {
      console.error('[Console] Error selecting department:', error);
      alert("שגיאה בטעינת המחלקה. אנא נסה שוב.");
    }
  };

  const speakHebrewNumber = async (seq) => {
    if (!('speechSynthesis' in window)) return;

    const numberToHebrewWords = (num) => {
      const ones = ["", "אחת", "שתיים", "שלוש", "ארבע", "חמש", "שש", "שבע", "שמונה", "תשע"];
      const teens = ["עשר", "אחת עשרה", "שתים עשרה", "שלוש עשרה", "ארבעה עשרה", "חמש עשרה", "שש עשרה", "שבע עשרה", "שמונה עשרה", "תשע עשרה"];
      const tens = ["", "", "עשרים", "שלושים", "ארבעים", "חמישים", "שישים", "שבעים", "שמונים", "תשעים"];

      if (num === 0) return "אפס";
      if (num < 10) return ones[num];
      if (num >= 10 && num < 20) return teens[num - 10];
      if (num >= 20 && num < 100) {
        const ten = Math.floor(num / 10);
        const one = num % 10;
        if (one === 0) return tens[ten];
        return ones[one] + " ו" + tens[ten];
      }
      return num.toString();
    };

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
    try { ss.cancel(); ss.resume(); } catch (e) {}

    const voices = await getVoicesWithRetry();
    const heVoice = pickHebrewVoice(voices);

    const hebrewNumber = numberToHebrewWords(seq);
    const utteranceText = `מספר ${hebrewNumber}, לגשת לעמדה`;
    const utterance = new SpeechSynthesisUtterance(utteranceText);

    utterance.lang = 'he-IL';
    utterance.volume = 1;
    utterance.rate = 0.9;
    utterance.pitch = 1;
    if (heVoice) utterance.voice = heVoice;

    try { ss.resume(); } catch (e) {}
    ss.speak(utterance);
  };

  const callNext = async () => {
    // onBreak only prevents automatic calls, manual calls are allowed.
    // The "אתה בהפסקה" text on the button is removed and replaced by "קרא הבא" always.
    // If onBreak is true, the user is manually choosing to call next.

    const nextTicket = waitingTickets[0];
    if (!nextTicket) {
      alert("אין כרטיסים ממתינים");
      return;
    }

    await base44.entities.Ticket.update(nextTicket.id, {
      state: "in_service",
      called_at: new Date().toISOString(),
      started_at: new Date().toISOString()
    });

    await base44.entities.TicketEvent.create({
      ticket_id: nextTicket.id,
      event_type: "called",
      actor_role: "staff",
      actor_email: user.email
    });

    await base44.entities.TicketEvent.create({
      ticket_id: nextTicket.id,
      event_type: "started",
      actor_role: "staff",
      actor_email: user.email
    });

    // Removed extra TTS to avoid duplicate announcements; rely on AudioNotification
    // await speakHebrewNumber(nextTicket.seq);
    setPlayAudio({ ticket: nextTicket });
    setTimeout(() => setPlayAudio(null), 100);

    loadData();
  };

  const recall = async () => {
    if (!currentTicket) return;

    await base44.entities.TicketEvent.create({
      ticket_id: currentTicket.id,
      event_type: "recalled",
      actor_role: "staff",
      actor_email: user.email
    });

    // Removed extra TTS to avoid duplicate announcements; rely on AudioNotification
    // await speakHebrewNumber(currentTicket.seq);
    setPlayAudio({ ticket: currentTicket });
    setTimeout(() => setPlayAudio(null), 100);

    alert(`כרטיס ${currentTicket.seq} נקרא שוב`);
  };

  const finishService = async () => {
    if (!currentTicket) return;

    const finishedAt = new Date();
    const startedAt = new Date(currentTicket.started_at);
    const serviceTime = Math.floor((finishedAt - startedAt) / 1000);

    await base44.entities.Ticket.update(currentTicket.id, {
      state: "served",
      finished_at: finishedAt.toISOString()
    });

    const currentAvg = queue.avg_service_time_seconds || 180;
    const newAvg = Math.floor((currentAvg * 0.8) + (serviceTime * 0.2));
    await base44.entities.Queue.update(queue_id, { avg_service_time_seconds: newAvg });

    await base44.entities.TicketEvent.create({
      ticket_id: currentTicket.id,
      event_type: "finished",
      actor_role: "staff",
      actor_email: user.email
    });

    await loadData();

    // קריאה אוטומטית לתור הבא אם לא במצב הפסקה
    if (!onBreak) {
      setTimeout(() => {
        callNext();
      }, 500);
    }
  };

  const skipTicket = async () => {
    if (!currentTicket) return;

    await base44.entities.Ticket.update(currentTicket.id, {
      state: "skipped"
    });

    await base44.entities.TicketEvent.create({
      ticket_id: currentTicket.id,
      event_type: "skipped",
      actor_role: "staff",
      actor_email: user.email
    });

    loadData();
  };

  const customerLeft = async () => {
    if (!currentTicket) return;

    await base44.entities.Ticket.update(currentTicket.id, {
      state: "cancelled"
    });

    await base44.entities.TicketEvent.create({
      ticket_id: currentTicket.id,
      event_type: "cancelled",
      actor_role: "staff",
      actor_email: user.email,
      notes: "לקוח עזב"
    });

    loadData();
  };

  const requeueTicket = async () => {
    if (!currentTicket) return;

    await base44.entities.Ticket.update(currentTicket.id, {
      state: "waiting",
      called_at: null,
      started_at: null
    });

    await base44.entities.TicketEvent.create({
      ticket_id: currentTicket.id,
      event_type: "transferred",
      actor_role: "staff",
      actor_email: user.email,
      notes: "הוחזר לתור"
    });

    loadData();
  };

  const transferTicket = async () => {
    if (!currentTicket || !targetDepartmentName) return;

    const filterBranchId = branch_id || user?.branch_id;

    // Get all queues and filter them locally, ensuring the target queue is active
    const allQueues = await base44.entities.Queue.list();
    const targetQueues = allQueues.filter(q =>
      String(q.branch_id) === String(filterBranchId) &&
      q.name === targetDepartmentName &&
      q.is_active === true
    );

    let targetQueueEntity;
    if (targetQueues && targetQueues.length > 0) {
      targetQueueEntity = targetQueues[0];
    } else {
      alert(`המחלקה "${targetDepartmentName}" אינה זמינה להעברה. אנא פנה למנהל המערכת.`);
      setTransferDialog(false);
      setTargetDepartmentName("");
      return;
    }

    const newSeq = (targetQueueEntity.seq_counter || 0) + 1;

    await base44.entities.Queue.update(targetQueueEntity.id, { seq_counter: newSeq });

    await base44.entities.Ticket.update(currentTicket.id, {
      queue_id: targetQueueEntity.id,
      seq: newSeq,
      state: "waiting"
    });

    await base44.entities.TicketEvent.create({
      ticket_id: currentTicket.id,
      event_type: "transferred",
      actor_role: "staff",
      actor_email: user.email,
      notes: `הועבר לתור: ${targetQueueEntity.name}`
    });

    setTransferDialog(false);
    setTargetDepartmentName("");
    loadData();
  };

  // NEW: חיפוש תור לפי מספר
  const searchTicket = async () => {
    if (!searchSeq || !queue_id) {
      setSearchMessage("אנא הזן מספר תור");
      setFoundTicket(null);
      return;
    }

    try {
      const allTickets = await base44.entities.Ticket.filter({ queue_id });
      const ticket = allTickets.find(t => String(t.seq) === String(searchSeq));

      if (ticket) {
        setFoundTicket(ticket);
        const statusText = {
          waiting: "ממתין",
          called: "נקרא",
          in_service: "בשירות",
          served: "טופל",
          skipped: "דולג",
          cancelled: "בוטל"
        }[ticket.state] || ticket.state;

        setSearchMessage(`✓ תור ${ticket.seq} נמצא במחלקת ${queue.name} (${statusText})`);
      } else {
        setFoundTicket(null);
        setSearchMessage(`✗ תור ${searchSeq} לא נמצא במחלקה זו`);
      }
    } catch (error) {
      console.error("Error searching ticket:", error);
      setSearchMessage("שגיאה בחיפוש התור");
      setFoundTicket(null);
    }
  };

  // NEW: קידום תור לתחילת התור
  const promoteTicket = async () => {
    if (!foundTicket || foundTicket.state !== "waiting") {
      alert("ניתן לקדם רק כרטיסים ממתינים");
      return;
    }

    try {
      // מצא את כל הכרטיסים הממתינים
      const allWaitingTickets = await base44.entities.Ticket.filter({ queue_id, state: "waiting" });

      if (allWaitingTickets.length === 0) {
        alert("אין כרטיסים ממתינים אחרים");
        return;
      }

      // מצא את המספר הקטן ביותר בתור
      // Filter out the ticket being promoted itself from minSeq calculation if it's already there
      const currentMinSeq = Math.min(...allWaitingTickets.map(t => t.seq));

      // עדכן את הכרטיס המקודם להיות ראשון
      await base44.entities.Ticket.update(foundTicket.id, {
        seq: currentMinSeq - 1
      });

      // רשום אירוע
      await base44.entities.TicketEvent.create({
        ticket_id: foundTicket.id,
        event_type: "transferred", // Using transferred as the closest event type for now
        actor_role: "staff",
        actor_email: user.email,
        notes: "קודם לתחילת התור"
      });

      setSearchMessage(`✓ תור ${foundTicket.seq} קודם לתחילת התור!`);
      setFoundTicket(null);
      setSearchSeq("");

      // רענן את הנתונים
      await loadData();
    } catch (error) {
      console.error("Error promoting ticket:", error);
      alert("שגיאה בקידום התור");
    }
  };

  const searchHistoryTicket = () => {
    if (!historySearchSeq) {
      return historyTickets;
    }
    return historyTickets.filter(t => String(t.seq).includes(historySearchSeq));
  };


  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#E6F9EA' }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 mx-auto mb-4" style={{ borderColor: '#41B649' }}></div>
          <p className="text-xl text-gray-700">טוען...</p>
        </div>
      </div>
    );
  }

  if (!branch_id && !user?.branch_id) {
    return (
      <div className="min-h-screen p-8" dir="rtl" style={{ backgroundColor: '#E6F9EA' }}>
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <img
              src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68dbe1252279022b9e191013/8866f21c5_SHuk_LOGO_HAYIR.png"
              alt="שוק העיר"
              className="h-24 w-auto mx-auto mb-6"
            />
            <h1 className="text-5xl font-bold mb-4" style={{ color: '#1F5F25' }}>בחר סניף</h1>
            <p className="text-xl text-gray-600">בחר את הסניף שבו אתה עובד</p>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            {branches.filter(b => b.is_active).map((branch) => (
              <motion.div
                key={branch.id}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Card
                  onClick={() => {
                    const url = createPageUrl("Console") + `?branch_id=${branch.id}`;
                    navigate(url);
                  }}
                  className="cursor-pointer hover:shadow-2xl transition-shadow p-6 bg-white"
                  style={{ borderColor: '#41B649', borderWidth: '2px' }}
                >
                  <CardContent className="text-center p-0">
                    <h2 className="text-2xl font-bold" style={{ color: '#1F5F25' }}>{branch.name}</h2>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
            {branches.filter(b => b.is_active).length === 0 && (
              <Card className="bg-white shadow-xl" style={{ borderColor: '#41B649', borderWidth: '2px' }}>
                <CardContent className="p-8 text-center">
                  <p className="text-lg text-gray-600">לא נמצאו סניפים פעילים</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (!queue_id) {
    return (
      <div className="min-h-screen p-8" dir="rtl" style={{ backgroundColor: '#E6F9EA' }}>
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <img
              src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68dbe1252279022b9e191013/8866f21c5_SHuk_LOGO_HAYIR.png"
              alt="שוק העיר"
              className="h-16 w-auto mx-auto mb-4"
            />
            <h1 className="text-4xl font-bold mb-4" style={{ color: '#1F5F25' }}>בחר מחלקה</h1>
            <p className="text-xl text-gray-600">בחר את המחלקה שברצונך לנהל</p>
          </div>

          {activeDepartments.length > 0 ? (
            <div className="grid md:grid-cols-3 gap-6">
              {activeDepartments.map((dept) => (
                <motion.div
                  key={dept.id}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Button
                    onClick={() => selectDepartment(dept.department)}
                    className="w-full h-40 text-3xl font-bold text-white shadow-xl hover:shadow-2xl transition-all duration-300"
                    style={{
                      backgroundColor: '#E52521',
                      borderRadius: '1rem'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#BD1F1C'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#E52521'}
                  >
                    <div className="flex flex-col items-center gap-3">
                      <div className="text-4xl font-bold">{dept.department}</div>
                      <div className="text-base font-normal">לחץ לניהול התור</div>
                    </div>
                  </Button>
                </motion.div>
              ))}
            </div>
          ) : (
            <Card className="bg-white shadow-xl" style={{ borderColor: '#41B649', borderWidth: '2px' }}>
              <CardContent className="p-12 text-center">
                <p className="text-2xl font-bold mb-4" style={{ color: '#1F5F25' }}>אין מחלקות פעילות כרגע</p>
                <p className="text-gray-600 mb-4">אנא פנה למנהל המערכת</p>
                <p className="text-sm text-gray-500">branch_id: {branch_id || user?.branch_id}</p>
                <p className="text-sm text-gray-500">מחלקות שנמצאו: {activeDepartments.length}</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    );
  }

  if (!queue) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#E6F9EA' }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 mx-auto mb-4" style={{ borderColor: '#41B649' }}></div>
          <p className="text-xl text-gray-700">טוען תור...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-8" dir="rtl" style={{ backgroundColor: '#E6F9EA' }}>
      {playAudio && (
        <AudioNotification
          ticket={playAudio.ticket}
        />
      )}

      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex-1 text-center md:text-right">
            <img
              src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68dbe1252279022b9e191013/8866f21c5_SHuk_LOGO_HAYIR.png"
              alt="שוק העיר"
              className="h-12 w-auto mx-auto md:mx-0 mb-2"
            />
            <h1 className="text-3xl font-bold" style={{ color: '#111111' }}>{queue.name}</h1>
            <p className="text-gray-600">קונסולת עובד</p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => setOnBreak(!onBreak)}
              variant={onBreak ? "default" : "outline"}
              className="gap-2"
              style={onBreak ? { backgroundColor: '#41B649', color: 'white' } : { borderColor: '#E52521', color: '#E52521' }}
            >
              <Coffee className="w-4 h-4" />
              {onBreak ? "חזור לעבודה" : "יציאה להפסקה"}
            </Button>
          </div>
        </div>

        <Tabs defaultValue="current" className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2 bg-white mx-auto" style={{ borderColor: '#41B649' }}>
            <TabsTrigger
              value="current"
              className="data-[state=active]:bg-green-50 data-[state=active]:text-green-900"
            >
              תור נוכחי
            </TabsTrigger>
            <TabsTrigger
              value="history"
              className="data-[state=active]:bg-green-50 data-[state=active]:text-green-900"
            >
              <History className="w-4 h-4 ml-2" />
              היסטוריה
            </TabsTrigger>
          </TabsList>

          <TabsContent value="current" className="space-y-6 mt-6">
            {queue_id && (
              <Card className="bg-white shadow-md" style={{ borderColor: '#41B649', borderWidth: '2px' }}>
                <CardHeader style={{ backgroundColor: '#E6F9EA' }}>
                  <CardTitle style={{ color: '#111111' }}>חיפוש וקידום תור</CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                  <div className="flex flex-col gap-3">
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        placeholder="הזן מספר תור..."
                        value={searchSeq}
                        onChange={(e) => setSearchSeq(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && searchTicket()}
                        className="flex-1 text-lg bg-white"
                        dir="ltr"
                      />
                      <Button
                        onClick={searchTicket}
                        className="gap-2 text-white hover:opacity-90"
                        style={{ backgroundColor: '#41B649' }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1F5F25'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#41B649'}
                      >
                        חפש
                      </Button>
                    </div>

                    {searchMessage && (
                      <div className={`p-3 rounded-lg text-sm ${
                        searchMessage.includes('✓') ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
                      }`}>
                        {searchMessage}
                      </div>
                    )}

                    {foundTicket && foundTicket.state === "waiting" && (
                      <Button
                        onClick={promoteTicket}
                        className="gap-2 text-white hover:opacity-90"
                        style={{ backgroundColor: '#E52521' }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#BD1F1C'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#E52521'}
                      >
                        ⬆️ קדם לתחילת התור
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="grid lg:grid-cols-2 gap-6">
              <Card className="bg-white shadow-md" style={{ borderColor: '#41B649', borderWidth: '2px' }}>
                <CardHeader style={{ backgroundColor: '#E6F9EA' }}>
                  <CardTitle style={{ color: '#111111' }}>כרטיס נוכחי</CardTitle>
                </CardHeader>
                <CardContent>
                  {currentTicket ? (
                    <div className="space-y-6">
                      <motion.div
                        initial={{ scale: 0.9 }}
                        animate={{ scale: 1 }}
                        className="text-center p-8 rounded-xl"
                        style={{ backgroundColor: '#E6F9EA', borderColor: '#41B649', borderWidth: '2px' }}
                      >
                        <div className="text-6xl font-bold mb-2" style={{ color: '#E52521' }}>
                          {currentTicket.seq}
                        </div>
                        <div className="text-lg font-medium" style={{ color: '#111111' }}>
                          בשירות
                        </div>
                      </motion.div>

                      <div className="grid grid-cols-2 gap-3">
                        <Button
                          onClick={recall}
                          className="gap-2 text-white"
                          style={{ backgroundColor: '#E52521' }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#BD1F1C'}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#E52521'}
                        >
                          <Volume2 className="w-4 h-4" />
                          קריאה חוזרת
                        </Button>

                        <Button
                          onClick={finishService}
                          className="gap-2 text-white"
                          style={{ backgroundColor: '#41B649' }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1F5F25'}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#41B649'}
                        >
                          סיים שירות
                        </Button>

                        <Button
                          onClick={skipTicket}
                          className="gap-2 text-white"
                          style={{ backgroundColor: '#E52521' }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#BD1F1C'}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#E52521'}
                        >
                          <SkipForward className="w-4 h-4" />
                          דלג
                        </Button>

                        <Button
                          onClick={customerLeft}
                          className="gap-2 text-white"
                          style={{ backgroundColor: '#E52521' }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#BD1F1C'}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#E52521'}
                        >
                          <XCircle className="w-4 h-4" />
                          לקוח עזב
                        </Button>

                        <Button
                          onClick={requeueTicket}
                          className="gap-2 text-white"
                          style={{ backgroundColor: '#41B649' }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1F5F25'}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#41B649'}
                        >
                          <RotateCcw className="w-4 h-4" />
                          החזר לתור
                        </Button>

                        <Button
                          onClick={() => setTransferDialog(true)}
                          className="gap-2 text-white"
                          style={{ backgroundColor: '#E52521' }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#BD1F1C'}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#E52521'}
                        >
                          <ArrowRightLeft className="w-4 h-4" />
                          העבר מחלקה
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <p className="text-gray-600 mb-6">אין כרטיס נוכחי</p>
                        <Button
                          onClick={callNext}
                          size="lg"
                          className="gap-2 text-white shadow-lg"
                          style={{ backgroundColor: '#E52521' }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#BD1F1C'}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#E52521'}
                        >
                          <PhoneCall className="w-5 h-5" />
                          קרא הבא
                        </Button>
                      {onBreak && (
                        <p className="text-sm text-gray-500 mt-3">
                          אתה במצב הפסקה. לחץ "חזור לעבודה" למעלה או "קרא הבא" כדי להמשיך
                        </p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="bg-white shadow-md" style={{ borderColor: '#41B649', borderWidth: '2px' }}>
                <CardHeader style={{ backgroundColor: '#E6F9EA' }}>
                  <CardTitle style={{ color: '#111111' }}>כרטיסים ממתינים ({waitingTickets.length})</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {waitingTickets.slice(0, 10).map((ticket, idx) => (
                      <div key={ticket.id} className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white" style={{ backgroundColor: '#41B649' }}>
                          {idx + 1}
                        </div>
                        <Card className="flex-1 p-4 hover:shadow-md transition-shadow bg-white border-gray-200">
                            <div className="flex items-start justify-between">
                                <div className="flex-1">
                                    <div className="flex items-center gap-3 mb-2">
                                        <span className="text-2xl font-bold" style={{ color: '#E52521' }}>
                                            {ticket.seq}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </Card>
                      </div>
                    ))}
                    {waitingTickets.length === 0 && (
                      <p className="text-center text-gray-500 py-8">אין כרטיסים ממתינים</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="history" className="space-y-6 mt-6">
            <Card className="bg-white shadow-md" style={{ borderColor: '#41B649', borderWidth: '2px' }}>
              <CardHeader style={{ backgroundColor: '#E6F9EA' }}>
                <CardTitle style={{ color: '#111111' }}>היסטוריית תורים להיום</CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <div className="mb-4">
                  <Input
                    type="number"
                    placeholder="חפש מספר תור..."
                    value={historySearchSeq}
                    onChange={(e) => setHistorySearchSeq(e.target.value)}
                    className="w-full text-lg bg-white"
                    dir="ltr"
                  />
                </div>

                <div className="space-y-3 max-h-[600px] overflow-y-auto">
                  {searchHistoryTicket().map((ticket) => {
                    const statusColors = {
                      served: { bg: '#E6F9EA', text: '#41B649', label: 'טופל' },
                      cancelled: { bg: '#fee2e2', text: '#dc2626', label: 'בוטל' },
                      skipped: { bg: '#fef3c7', text: '#d97706', label: 'דולג' }
                    };
                    const status = statusColors[ticket.state] || { bg: '#e0e7ff', text: '#4338ca', label: ticket.state }; // Fallback for unknown states

                    return (
                      <Card key={ticket.id} className="p-4" style={{ backgroundColor: status.bg }}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="text-3xl font-bold" style={{ color: '#E52521' }}>
                              {ticket.seq}
                            </div>
                            <div>
                              <Badge style={{ backgroundColor: status.bg, color: status.text, borderColor: status.text, borderWidth: '1px' }}>
                                {status.label}
                              </Badge>
                              {(ticket.finished_at || ticket.updated_date) && (
                                <p className="text-sm text-gray-600 mt-1">
                                  {new Date(ticket.finished_at || ticket.updated_date).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                  {searchHistoryTicket().length === 0 && (
                    <p className="text-center text-gray-500 py-8">אין היסטוריה להיום</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={transferDialog} onOpenChange={setTransferDialog}>
        <DialogContent dir="rtl" className="bg-white">
          <DialogHeader>
            <DialogTitle>העברת כרטיס למחלקה אחרת</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Select value={targetDepartmentName} onValueChange={setTargetDepartmentName}>
              <SelectTrigger className="bg-white">
                <SelectValue placeholder="בחר מחלקת יעד" />
              </SelectTrigger>
              <SelectContent>
                {activeDepartments
                  .filter((dept) => dept.department !== queue.name)
                  .map((dept) => (
                    <SelectItem key={dept.id} value={dept.department}>
                      {dept.department}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setTransferDialog(false)}
              style={{ borderColor: '#E52521', color: '#E52521' }}
            >
              ביטול
            </Button>
            <Button
              onClick={transferTicket}
              disabled={!targetDepartmentName}
              className="text-white hover:opacity-90"
              style={{ backgroundColor: '#E52521' }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#BD1F1C'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#E52521'}
            >
              העבר
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
