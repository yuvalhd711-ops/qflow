import React, { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Star, CheckCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { createPageUrl } from "@/utils";
import { useBdsSubscription } from "@/components/utils/bdsSync";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

export default function KioskPage() {
  const navigate = useNavigate();
  const urlParams = new URLSearchParams(window.location.search);
  const branch_id = urlParams.get('branch_id');
  const queue_id = urlParams.get('queue_id');
  
  const [activeDepartments, setActiveDepartments] = useState([]);
  const [queue, setQueue] = useState(null);
  const [isCreating, setIsCreating] = useState(false);
  const [newTicket, setNewTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [branches, setBranches] = useState([]);
  const [showSmsModal, setShowSmsModal] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [joinClub, setJoinClub] = useState(false);
  const [showSmsConfirmation, setShowSmsConfirmation] = useState(false);
  const [error, setError] = useState(null);
  const printIframeRef = useRef(null);

  const loadDepartments = useCallback(async () => {
    if (!branch_id) {
      setLoading(false);
      return;
    }

    try {
      const allDepts = await base44.entities.BranchDepartmentSetting.list();
      
      const filteredDepts = allDepts.filter(d => 
        String(d.branch_id) === String(branch_id) && d.is_active === true
      );
      
      setActiveDepartments(filteredDepts);
      setError(null);
    } catch (error) {
      console.error('[Kiosk] Error loading departments:', error);
      setError('שגיאה בטעינת הנתונים');
      setActiveDepartments([]);
    }
    
    setLoading(false);
  }, [branch_id]);

  useEffect(() => {
    loadDepartments();
    
    if (branch_id) {
      const interval = setInterval(loadDepartments, 10000);
      return () => clearInterval(interval);
    }
  }, [branch_id, loadDepartments]);

  const loadBranches = useCallback(async () => {
    try {
      setLoading(true);
      const list = await base44.entities.Branch.list();
      setBranches(list);
    } catch (e) {
      console.error("[Kiosk] Error loading branches:", e);
      setBranches([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!branch_id) {
      loadBranches();
    }
  }, [branch_id, loadBranches]);

  const branchIdStr = branch_id ? String(branch_id) : null;
  const handleBdsSync = useCallback(({ scope, branchId }) => {
    if (scope === "all" || (branchIdStr && String(branchId) === branchIdStr)) {
      loadDepartments();
      loadBranches();
    }
  }, [branchIdStr, loadDepartments, loadBranches]);

  useBdsSubscription(handleBdsSync);

  const loadQueue = useCallback(async () => {
    if (!queue_id) return;
    try {
      const queueData = await base44.entities.Queue.get(queue_id);
      setQueue(queueData);
    } catch (error) {
      console.error("Queue not found:", error);
      setQueue(null);
      const url = createPageUrl("Kiosk") + (branch_id ? `?branch_id=${branch_id}` : '');
      navigate(url);
    }
  }, [queue_id, branch_id, navigate]);

  useEffect(() => {
    if (queue_id) {
      loadQueue();
    }
  }, [queue_id, loadQueue]);

  // Auto-print using hidden iframe - NO about:blank
  // CRITICAL: This effect runs when newTicket changes
  // The seq comes directly from newTicket.seq which was set from server response
  useEffect(() => {
    if (!newTicket || !queue) return;

    const seqToPrint = newTicket.seq;
    console.log("[Kiosk] PRINT EFFECT TRIGGERED - seq to print:", seqToPrint);
    
    const printTicket = () => {
      const ticketNumber = String(seqToPrint).padStart(3, "0");
      console.log("[Kiosk] Printing ticket number:", ticketNumber);
      
      const printContent = `
        <!DOCTYPE html>
        <html dir="rtl">
        <head>
          <meta charset="utf-8">
          <title>כרטיס תור</title>
          <style>
            @media print {
              @page { 
                margin: 2mm !important;
                size: 80mm auto !important;
              }
            }
            * {
              box-sizing: border-box;
              margin: 0;
              padding: 0;
            }
            html, body {
              width: 100%;
              margin: 0;
              padding: 0;
            }
            body {
              font-family: Arial, sans-serif;
              text-align: center;
              direction: rtl;
              color: #333;
            }
            .container {
              width: 60mm;
              max-width: 60mm;
              margin: 0 auto;
              padding: 3mm;
            }
            .header {
              font-size: 16px;
              font-weight: bold;
              margin-bottom: 5px;
              color: #000;
            }
            .ticket-code {
              font-size: 48px;
              font-weight: bold;
              margin: 8px auto;
              color: #000;
              border: 2px solid #000;
              padding: 8px 5px;
              border-radius: 5px;
              width: 50mm;
              max-width: 50mm;
            }
            .info {
              font-size: 11px;
              margin: 4px 0;
              color: #333;
            }
            .footer {
              margin-top: 8px;
              font-size: 10px;
              color: #555;
              border-top: 1px dashed #999;
              padding-top: 6px;
            }
            .barcode {
              margin: 6px 0;
              font-family: 'Courier New', monospace;
              font-size: 12px;
              letter-spacing: 2px;
            }
          </style>
        </head>
        <body onload="window.print();">
          <div class="container">
            <div class="header">${queue.name}</div>
            <div class="ticket-code">${ticketNumber}</div>
            <div class="info">מספר תור שלך</div>
            <div class="info">נוצר: ${new Date(newTicket.created_date).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}</div>
            <div class="barcode">|||  ${ticketNumber}  |||</div>
            <div class="footer">
              <div>אנא המתן עד שיקראו למספר שלך</div>
              <div>תודה על הסבלנות!</div>
            </div>
          </div>
        </body>
        </html>
      `;

      // Remove old iframe if exists
      if (printIframeRef.current) {
        try {
          document.body.removeChild(printIframeRef.current);
        } catch (e) {
          console.warn("Failed to remove old iframe:", e);
        }
      }

      // Create completely hidden iframe
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.top = '-10000px';
      iframe.style.left = '-10000px';
      iframe.style.width = '1px';
      iframe.style.height = '1px';
      iframe.style.opacity = '0';
      iframe.style.border = 'none';
      document.body.appendChild(iframe);
      printIframeRef.current = iframe;

      const iframeDoc = iframe.contentWindow.document;
      iframeDoc.open();
      iframeDoc.write(printContent);
      iframeDoc.close();

      // Cleanup after print
      setTimeout(() => {
        if (printIframeRef.current) {
          try {
            document.body.removeChild(printIframeRef.current);
            printIframeRef.current = null;
          } catch (e) {
            console.warn("Failed to remove iframe after print:", e);
          }
        }
      }, 2000);
    };

    const timer = setTimeout(printTicket, 300);
    return () => clearTimeout(timer);
  }, [newTicket, queue]);

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

  // Shared function to create a new ticket - used by both regular and SMS flows
  const createNewTicket = async (customerPhone = null, shouldJoinClub = false) => {
    const currentQueueId = queue_id;
    
    if (!currentQueueId) {
      throw new Error("No queue_id available");
    }
    
    const timestamp = Date.now();
    console.log("[Kiosk] ========== START TICKET CREATION ==========");
    console.log("[Kiosk] Queue ID:", currentQueueId);
    console.log("[Kiosk] Timestamp:", timestamp);
    
    // Step 1: Get ALL tickets for this queue using list() + manual filter
    // This bypasses any potential caching issues with filter()
    const allTickets = await base44.entities.Ticket.list();
    const queueTickets = allTickets.filter(t => t.queue_id === currentQueueId);
    
    console.log("[Kiosk] Total tickets in system:", allTickets.length);
    console.log("[Kiosk] Tickets for this queue:", queueTickets.length);
    
    // Find the maximum seq number from existing tickets for THIS queue
    let maxSeq = 0;
    if (queueTickets.length > 0) {
      const seqNumbers = queueTickets.map(t => t.seq || 0);
      maxSeq = Math.max(...seqNumbers);
      console.log("[Kiosk] All seq numbers:", seqNumbers.sort((a,b) => b-a).slice(0, 10));
    }
    console.log("[Kiosk] Max existing seq:", maxSeq);
    
    // The new sequence number is simply max + 1
    const newSeq = maxSeq + 1;
    console.log("[Kiosk] *** NEW SEQ TO USE:", newSeq, "***");

    // Step 2: Create the ticket FIRST with the new seq
    const ticketData = {
      queue_id: currentQueueId,
      seq: newSeq,
      state: "waiting",
      source: "kiosk",
      customer_phone: customerPhone,
      join_club: shouldJoinClub
    };
    console.log("[Kiosk] Creating ticket with data:", JSON.stringify(ticketData));
    
    const ticket = await base44.entities.Ticket.create(ticketData);
    
    console.log("[Kiosk] ========== TICKET CREATED ==========");
    console.log("[Kiosk] Ticket ID:", ticket.id);
    console.log("[Kiosk] Ticket SEQ returned from server:", ticket.seq);
    console.log("[Kiosk] Full ticket:", JSON.stringify(ticket));

    // Step 3: Update queue counter
    await base44.entities.Queue.update(currentQueueId, { seq_counter: newSeq });

    await base44.entities.TicketEvent.create({
      ticket_id: ticket.id,
      event_type: "created",
      actor_role: "customer"
    });

    // CRITICAL: Use the seq we calculated, not what the server returned
    // (in case server doesn't return seq correctly)
    const finalSeq = newSeq;
    console.log("[Kiosk] FINAL SEQ FOR DISPLAY:", finalSeq);
    console.log("[Kiosk] ========== END TICKET CREATION ==========");
    
    // Update local state
    setQueue(prev => prev ? { ...prev, seq_counter: finalSeq } : prev);

    return { 
      ticket: { ...ticket, seq: finalSeq }, 
      queue: queue ? { ...queue, seq_counter: finalSeq } : null 
    };
  };

  const createRegularTicket = async () => {
    if (isCreating) return; // Prevent double-clicks
    setIsCreating(true);
    
    try {
      const { ticket } = await createNewTicket(null, false);
      
      // CRITICAL: Create a completely new object with explicit seq
      // to ensure React sees this as a new state value
      const displayTicket = {
        id: ticket.id,
        seq: ticket.seq,
        created_date: ticket.created_date || new Date().toISOString(),
        join_club: false
      };
      
      console.log("[Kiosk] Setting newTicket for display with seq:", displayTicket.seq);
      setNewTicket(displayTicket);
      
      setTimeout(() => {
        setNewTicket(null);
      }, 3000);
    } catch (error) {
      console.error("Error creating ticket:", error);
      alert("שגיאה ביצירת כרטיס. אנא נסה שוב.");
    } finally {
      setIsCreating(false);
    }
  };

  const handleSmsChoice = () => {
    setPhoneNumber("");
    setJoinClub(false);
    setShowSmsModal(true);
  };

  const createTicketWithSms = async () => {
    if (!phoneNumber || phoneNumber.length < 9) {
      alert("אנא הזן מספר טלפון תקין");
      return;
    }

    if (isCreating) return; // Prevent double-clicks
    setIsCreating(true);
    setShowSmsModal(false);
    
    try {
      const { ticket } = await createNewTicket(phoneNumber, joinClub);
      
      // CRITICAL: Create a completely new object with explicit seq
      const displayTicket = {
        id: ticket.id,
        seq: ticket.seq,
        created_date: ticket.created_date || new Date().toISOString(),
        join_club: joinClub
      };
      
      console.log("[Kiosk] Setting newTicket (SMS) for display with seq:", displayTicket.seq);
      setNewTicket(displayTicket);
      setShowSmsConfirmation(true);
      
      setTimeout(() => {
        setShowSmsConfirmation(false);
      }, 3000);
      
      setTimeout(() => {
        setNewTicket(null);
      }, 3000);
    } catch (error) {
      console.error("Error creating ticket:", error);
      alert("שגיאה ביצירת כרטיס. אנא נסה שוב.");
    } finally {
      setIsCreating(false);
    }
  };

  const selectDepartment = async (deptName) => {
    try {
      const q = await ensureQueue(branch_id, deptName);
      const url = createPageUrl("Kiosk") + `?branch_id=${branch_id}&queue_id=${q.id}`;
      navigate(url);
    } catch (error) {
      console.error('[Kiosk] Error selecting department:', error);
      alert("שגיאה בטעינת המחלקה. אנא נסה שוב.");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#E6F9EA' }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 mx-auto mb-4" style={{ borderColor: '#41B649' }}></div>
          <p className="text-xl" style={{ color: '#111111' }}>טוען...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#E6F9EA' }}>
        <Card className="bg-white shadow-xl max-w-md" style={{ borderColor: '#E52521', borderWidth: '2px' }}>
          <CardContent className="p-12 text-center">
            <p className="text-2xl font-bold mb-4" style={{ color: '#E52521' }}>{error}</p>
            <Button onClick={() => window.location.reload()} className="text-white" style={{ backgroundColor: '#41B649' }}>
              נסה שוב
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!branch_id) {
    return (
      <div className="min-h-screen p-8" dir="rtl" style={{ backgroundColor: '#E6F9EA' }}>
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <img 
              src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68dbe1252279022b9e191013/8866f21c5_SHuk_LOGO_HAYIR.png"
              alt="שוק העיר"
              className="h-24 w-auto mx-auto mb-6"
            />
            <h1 className="text-5xl font-bold mb-4" style={{ color: '#111111' }}>בחר סניף</h1>
            <p className="text-xl text-gray-600">בחר את הסניף שבו אתה נמצא</p>
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
                    const url = createPageUrl("Kiosk") + `?branch_id=${branch.id}`;
                    navigate(url);
                  }}
                  className="cursor-pointer hover:shadow-2xl transition-shadow p-6 bg-white"
                  style={{ borderColor: '#41B649', borderWidth: '2px' }}
                >
                  <CardContent className="text-center p-0">
                    <h2 className="text-2xl font-bold" style={{ color: '#111111' }}>{branch.name}</h2>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
            {branches.filter(b => b.is_active).length === 0 && (
              <Card className="bg-white shadow-xl col-span-full" style={{ borderColor: '#41B649', borderWidth: '2px' }}>
                <CardContent className="p-8 text-center">
                  <p className="text-2xl font-bold mb-4" style={{ color: '#111111' }}>אין סניפים פעילים כרגע</p>
                  <p className="text-lg text-gray-600">אנא פנה למנהל המערכת</p>
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
              className="h-24 w-auto mx-auto mb-6"
            />
            <h1 className="text-5xl font-bold mb-4" style={{ color: '#111111' }}>בחר מחלקה</h1>
            <p className="text-xl text-gray-600">בחר את המחלקה שברצונך לקבל מספר</p>
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
                    className="w-full h-48 text-4xl font-bold text-white shadow-2xl hover:shadow-3xl transition-all duration-300"
                    style={{ 
                      backgroundColor: '#C41E1A',
                      borderRadius: '1rem'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#A01816'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#C41E1A'}
                  >
                    <div className="flex flex-col items-center gap-4">
                      <div className="text-5xl font-bold">{dept.department}</div>
                      <div className="text-lg font-normal">לחץ לקבלת מספר</div>
                    </div>
                  </Button>
                </motion.div>
              ))}
            </div>
          ) : (
            <Card className="bg-white shadow-xl" style={{ borderColor: '#41B649', borderWidth: '2px' }}>
              <CardContent className="p-12 text-center">
                <p className="text-2xl font-bold mb-4" style={{ color: '#111111' }}>אין מחלקות פעילות כרגע</p>
                <p className="text-gray-600">אנא פנה למנהל המערכת</p>
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
          <p className="text-xl" style={{ color: '#111111' }}>טוען תור...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" dir="rtl" style={{ backgroundColor: '#E6F9EA' }}>
      <div className="container mx-auto px-4 py-8">
        <div className="text-center mb-12">
          <img 
            src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68dbe1252279022b9e191013/8866f21c5_SHuk_LOGO_HAYIR.png"
            alt="שוק העיר"
            className="h-20 w-auto mx-auto mb-4"
          />
          <h1 className="text-5xl font-bold mb-4" style={{ color: '#111111' }}>{queue.name}</h1>
            <p className="text-xl text-gray-600">בחר אפשרות לקבלת מספר תור</p>
          </div>

          {/* Back button */}
          <Button
            onClick={() => {
              const url = createPageUrl("Kiosk") + `?branch_id=${branch_id}`;
              navigate(url);
            }}
            variant="outline"
            className="mb-6 gap-2 text-lg"
            style={{ borderColor: '#41B649', color: '#1F5F25' }}
          >
            ← חזרה לבחירת מחלקה
          </Button>

        <div className="max-w-6xl mx-auto">
          <AnimatePresence mode="wait">
            {!newTicket && (
              <motion.div
                key="choices"
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="grid grid-cols-2 gap-6"
              >
                <Button
                  onClick={createRegularTicket}
                  disabled={isCreating}
                  className="h-80 text-5xl font-bold text-white shadow-2xl hover:opacity-90 flex flex-col items-center justify-center gap-6"
                  style={{ backgroundColor: '#E52521' }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#BD1F1C'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#E52521'}
                >
                  <div className="bg-white rounded-full p-3 shadow-lg">
                    <img 
                      src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68dbe1252279022b9e191013/8866f21c5_SHuk_LOGO_HAYIR.png"
                      alt="שוק העיר"
                      className="h-20 w-auto"
                      style={{ mixBlendMode: 'normal', opacity: 1 }}
                    />
                  </div>
                  {isCreating ? "יוצר..." : "קבלת מספר"}
                </Button>

                <Button
                  onClick={handleSmsChoice}
                  disabled={isCreating}
                  className="h-80 text-5xl font-bold text-white shadow-2xl hover:opacity-90 flex flex-col items-center justify-center gap-6"
                  style={{ backgroundColor: '#41B649' }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1F5F25'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#41B649'}
                >
                  <div className="bg-white rounded-full p-3 shadow-lg">
                    <img 
                      src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68dbe1252279022b9e191013/8866f21c5_SHuk_LOGO_HAYIR.png"
                      alt="שוק העיר"
                      className="h-20 w-auto"
                      style={{ mixBlendMode: 'normal', opacity: 1 }}
                    />
                  </div>
                  קבלת מספר בSMS
                </Button>
              </motion.div>
            )}

            {newTicket && (
              <motion.div
                key="ticket"
                initial={{ scale: 0.8, opacity: 0, y: 50 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.8, opacity: 0, y: -50 }}
              >
                <Card className="bg-white border-2 shadow-2xl" style={{ borderColor: '#41B649' }}>
                  <CardContent className="p-12 text-center">
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: 0.2, type: "spring" }}
                    >
                      <div className="w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg" style={{ backgroundColor: '#41B649' }}>
                        <CheckCircle className="w-16 h-16 text-white" />
                      </div>
                    </motion.div>
                    <h2 className="text-3xl font-bold mb-4" style={{ color: '#111111' }}>המספר שלך</h2>
                    <div className="text-9xl font-bold mb-6" style={{ color: '#E52521' }}>
                      {newTicket?.seq || "---"}
                    </div>
                    <div className="info text-2xl" style={{ color: '#111111' }}>מספר תור שלך</div>
                    <div className="text-lg text-gray-600 mt-4 rounded-lg p-3" style={{ backgroundColor: '#E6F9EA' }}>
                      נוצר: {new Date(newTicket.created_date).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                    {showSmsConfirmation && (
                      <div className="space-y-3 mt-4">
                        <div className="flex items-center justify-center gap-2 rounded-lg p-4" style={{ backgroundColor: '#E6F9EA', color: '#41B649' }}>
                          <Star className="w-6 h-6" style={{ fill: '#41B649' }} />
                          <span className="text-xl font-bold">ברגעים אלו נשלחת אליך הודעת SMS!</span>
                        </div>
                        {newTicket?.join_club && (
                          <div className="text-center text-lg text-gray-600 bg-green-50 p-3 rounded-lg">
                            תקבל גם קישור להרשמה למועדון שוק העיר 🎁
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <Dialog open={showSmsModal} onOpenChange={setShowSmsModal}>
        <DialogContent dir="rtl" className="bg-white max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-3xl text-center" style={{ color: '#111111' }}>
              קבלת מספר בSMS
            </DialogTitle>
          </DialogHeader>
          <div className="py-8 space-y-6">
            <div>
              <label className="text-xl font-bold block mb-3" style={{ color: '#111111' }}>
                מספר טלפון נייד:
              </label>
              <input
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, ''))}
                placeholder="05X-XXXXXXX"
                className="w-full text-2xl p-4 border-2 rounded-lg text-center"
                style={{ borderColor: '#41B649' }}
                maxLength="10"
                dir="ltr"
              />
            </div>

            <div className="bg-green-50 p-6 rounded-lg border-2" style={{ borderColor: '#41B649' }}>
              <div className="flex items-start gap-4">
                <input
                  type="checkbox"
                  id="joinClub"
                  checked={joinClub}
                  onChange={(e) => setJoinClub(e.target.checked)}
                  className="w-6 h-6 mt-1"
                  style={{ accentColor: '#41B649' }}
                />
                <label htmlFor="joinClub" className="text-xl cursor-pointer flex-1">
                  <div className="font-bold mb-2" style={{ color: '#111111' }}>
                    להרשמה חינם למועדון שוק העיר 🌟
                  </div>
                  <div className="text-lg text-gray-700">
                    קבל הנחות והטבות בכל ביקור! נשלח לך SMS עם קישור להשלמת ההרשמה
                  </div>
                </label>
              </div>
            </div>
          </div>
          <DialogFooter className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => setShowSmsModal(false)}
              className="flex-1 text-xl h-16"
              style={{ borderColor: '#E52521', color: '#E52521' }}
            >
              ביטול
            </Button>
            <Button
              onClick={createTicketWithSms}
              disabled={isCreating || !phoneNumber || phoneNumber.length < 9}
              className="flex-1 text-xl h-16 text-white hover:opacity-90"
              style={{ backgroundColor: '#41B649' }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1F5F25'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#41B649'}
            >
              {isCreating ? "יוצר..." : "אישור"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}