import { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, Building2, Phone, Save, Shield } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { broadcastBdsUpdate } from "@/components/utils/bdsSync";

const DEPARTMENT_TYPES = [
  { name: "קצבייה", key: "butcher" },
  { name: "מעדנייה", key: "deli" },
  { name: "דגים", key: "fish" }
];

// Removed hardcoded BRANCHES array as per instructions.
// Branches will now be dynamically loaded from the database.

export default function AdminPage() {
  const queryClient = useQueryClient();
  const [user, setUser] = useState(null);
  const [branches, setBranches] = useState([]);
  const [departmentSettings, setDepartmentSettings] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [showBranchDialog, setShowBranchDialog] = useState(false);
  const [showContactDialog, setShowContactDialog] = useState(false);
  const [showIpDialog, setShowIpDialog] = useState(false);
  const [branchSettings, setBranchSettings] = useState({});
  const [savingBranch, setSavingBranch] = useState(null);
  const [isRunningBackfill, setIsRunningBackfill] = useState(false);
  const [cleaningDupes, setCleaningDupes] = useState(false);
  const [allowedIPs, setAllowedIPs] = useState([]);

  const [branchForm, setBranchForm] = useState({
    name: "",
    address: "",
    is_active: true
  });

  const [contactForm, setContactForm] = useState({
    branch_id: null,
    contact_name: "",
    phone_number: "",
    is_active: true
  });

  const [ipForm, setIpForm] = useState({
    ip_address: "",
    description: "",
    is_active: true
  });

  // Helper: normalize name for duplicate detection
  const normalizeName = (s) => (s || "").toString().trim().toLowerCase();

  const loadData = useCallback(async () => {
    console.log("=== Loading data from server ===");
    
    try {
      const branchesData = await base44.entities.Branch.list();
      setBranches(branchesData);

      const deptSettings = await base44.entities.BranchDepartmentSetting.list();
      console.log("Loaded department settings:", deptSettings);
      setDepartmentSettings(deptSettings);

      const contactsData = await base44.entities.BranchContact.list();
      setContacts(contactsData);

      const ipsData = await base44.entities.AllowedIP.list();
      setAllowedIPs(ipsData);

      const settings = {};
      branchesData.forEach(branch => {
        const branchDepts = deptSettings.filter(d => String(d.branch_id) === String(branch.id));
        console.log(`Branch ${branch.id} (${branch.name}) departments:`, branchDepts);
        
        settings[branch.id] = {};
        DEPARTMENT_TYPES.forEach(dept => {
          const record = branchDepts.find(d => d.department === dept.name);
          settings[branch.id][dept.key] = record?.is_active === true;
        });
      });
      
      setBranchSettings(settings);
    } catch (error) {
      console.error("Error loading data:", error);
      setBranches([]);
      setDepartmentSettings([]);
      setContacts([]);
      setBranchSettings({});
    }
  }, []);

  const init = useCallback(async () => {
    const userData = await base44.auth.me();
    setUser(userData);
    await loadData();
  }, [loadData]);

  useEffect(() => {
    init();
  }, [init]);

  const runBackfill = async () => {
    if (!confirm("פעולה זו תתקן את כל המערכת ותיצור את כל המחלקות והתורים החסרים.\n\nזה יכול לקחת כמה דקות - אנא המתן.\n\nהאם להמשיך?")) {
      return;
    }

    setIsRunningBackfill(true);
    console.log("\n========== RUNNING BACKFILL ==========");

    // פונקציה להוספת delay
    const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    try {
      // Step 1: Fetch all branches currently in the database.
      // The original step ensured hardcoded branches exist, which is no longer applicable.
      console.log("\n[1/4] Fetching all branches from database...");
      const allBranchesFromDb = await base44.entities.Branch.list();
      console.log(`Found ${allBranchesFromDb.length} branches in DB.`);
      
      // Step 2: תקן branch_id בכל ה-Queues
      console.log("\n[2/4] Normalizing Queue branch_ids...");
      const allQueues = await base44.entities.Queue.list();
      console.log(`Found ${allQueues.length} queues`);
      
      let normalizedCount = 0;
      for (const queue of allQueues) {
        const normalizedBranchId = String(queue.branch_id);
        if (queue.branch_id !== normalizedBranchId) {
          await base44.entities.Queue.update(queue.id, {
            branch_id: normalizedBranchId
          });
          normalizedCount++;
          await delay(100);
        }
      }
      console.log(`✓ Normalized ${normalizedCount} queues`);

      // Step 3: צור BranchDepartmentSettings חסרים לכל הסניפים הקיימים בבסיס הנתונים
      console.log("\n[3/4] Creating missing BranchDepartmentSettings for all existing branches...");
      const allDeptSettings = await base44.entities.BranchDepartmentSetting.list();
      
      const settingsToCreate = [];
      for (const branch of allBranchesFromDb) { // Iterate over branches found in the DB
        for (const dept of DEPARTMENT_TYPES) {
          const exists = allDeptSettings.find(
            d => String(d.branch_id) === String(branch.id) && d.department === dept.name
          );
          if (!exists) {
            settingsToCreate.push({
              branch_id: String(branch.id), // Ensure branch_id is a string
              department: dept.name,
              is_active: true
            });
          }
        }
      }
      
      console.log(`Creating ${settingsToCreate.length} missing settings...`);
      
      if (settingsToCreate.length > 0) {
        for (let i = 0; i < settingsToCreate.length; i += 10) {
          const batch = settingsToCreate.slice(i, i + 10);
          await base44.entities.BranchDepartmentSetting.bulkCreate(batch);
          console.log(`✓ Created settings ${i + 1}-${Math.min(i + 10, settingsToCreate.length)} of ${settingsToCreate.length}`);
          await delay(500);
        }
      } else {
        console.log("No missing BranchDepartmentSettings found.");
      }

      // Step 4: צור Queues חסרים
      console.log("\n[4/4] Creating missing Queues...");
      const updatedQueues = await base44.entities.Queue.list(); // Re-fetch after potential updates in step 2
      const updatedSettings = await base44.entities.BranchDepartmentSetting.list(); // Re-fetch after step 3
      
      const queuesToCreate = [];
      for (const setting of updatedSettings) {
        const exists = updatedQueues.find(
          q => String(q.branch_id) === String(setting.branch_id) && q.name === setting.department
        );
        if (!exists) {
          queuesToCreate.push({
            branch_id: String(setting.branch_id),
            name: setting.department,
            seq_counter: 0,
            avg_service_time_seconds: 180,
            is_active: setting.is_active
          });
        }
      }
      
      console.log(`Creating ${queuesToCreate.length} missing queues...`);
      
      if (queuesToCreate.length > 0) {
        for (let i = 0; i < queuesToCreate.length; i += 10) {
          const batch = queuesToCreate.slice(i, i + 10);
          await base44.entities.Queue.bulkCreate(batch);
          console.log(`✓ Created queues ${i + 1}-${Math.min(i + 10, queuesToCreate.length)} of ${queuesToCreate.length}`);
          await delay(500);
        }
      } else {
        console.log("No missing Queues found.");
      }

      // וידוא סופי
      const finalQueues = await base44.entities.Queue.list();
      const finalDeptSettings = await base44.entities.BranchDepartmentSetting.list();
      
      console.log("\n========== COMPLETED ==========");
      console.log(`Total Queues: ${finalQueues.length}`);
      console.log(`Total Settings: ${finalDeptSettings.length}`);
      console.log(`Expected: ${allBranchesFromDb.length * DEPARTMENT_TYPES.length} of each`); // Adjusted expected count based on DB branches

      // Broadcast to all tabs
      broadcastBdsUpdate({ scope: "all" });
      
      alert(`תיקון הושלם בהצלחה! ✅\n\n📊 סיכום:\n- ${finalDeptSettings.length} הגדרות מחלקות\n- ${finalQueues.length} תורים\n\nכל הסניפים מוכנים לשימוש!`);
      
      await delay(500);
      await loadData();
    } catch (error) {
      console.error("Error during backfill:", error);
      alert(`שגיאה בתיקון: ${error.message}\n\nאם זה rate limit - המתן דקה ונסה שוב.`);
    } finally {
      setIsRunningBackfill(false);
    }
  };

  // UPDATED: prevent creating duplicate branches by name (case-insensitive)
  const createBranch = async () => {
    // Load current branches to check duplicates
    const allBranches = await base44.entities.Branch.list();
    const existing = allBranches.find(b => normalizeName(b.name) === normalizeName(branchForm.name));

    let targetBranch;
    if (existing) {
      // Update existing branch instead of creating a duplicate
      targetBranch = await base44.entities.Branch.update(existing.id, {
        address: branchForm.address || existing.address || "",
        is_active: true
      });
      alert(`סניף בשם "${branchForm.name}" כבר קיים. פרטי הסניף עודכנו.`);
    } else {
      targetBranch = await base44.entities.Branch.create(branchForm);
      alert(`סניף "${branchForm.name}" נוצר בהצלחה.`);
    }

    const branchIdStr = String(targetBranch.id);

    // Ensure 3 department settings ON and queues exist
    const existingSettings = await base44.entities.BranchDepartmentSetting.list();
    const branchSettings = existingSettings.filter(s => String(s.branch_id) === branchIdStr);
    for (const dept of DEPARTMENT_TYPES) {
      const exists = branchSettings.find(s => s.department === dept.name);
      if (exists) {
        if (exists.is_active !== true) {
          await base44.entities.BranchDepartmentSetting.update(exists.id, { is_active: true });
        }
      } else {
        await base44.entities.BranchDepartmentSetting.create({
          branch_id: branchIdStr,
          department: dept.name,
          is_active: true
        });
      }
    }

    const allQueues = await base44.entities.Queue.list();
    for (const dept of DEPARTMENT_TYPES) {
      const q = allQueues.find(q => String(q.branch_id) === branchIdStr && q.name === dept.name);
      if (q) {
        if (q.is_active !== true) {
          await base44.entities.Queue.update(q.id, { is_active: true });
        }
      } else {
        await base44.entities.Queue.create({
          branch_id: branchIdStr,
          name: dept.name,
          seq_counter: 0,
          avg_service_time_seconds: 180,
          is_active: true
        });
      }
    }

    // Broadcast and reload
    broadcastBdsUpdate({ scope: "all" });

    setShowBranchDialog(false);
    setBranchForm({ name: "", address: "", is_active: true });
    await loadData();
  };

  const deleteBranch = async (id) => {
    if (!confirm("האם אתה בטוח שברצונך למחוק סניף זה?")) return;
    
    try {
      const branchIdStr = String(id);

      const allQueues = await base44.entities.Queue.list();
      const branchQueues = allQueues.filter(q => String(q.branch_id) === branchIdStr);
      for (const queue of branchQueues) {
        await base44.entities.Queue.delete(queue.id);
      }

      const allDepts = await base44.entities.BranchDepartmentSetting.list();
      const branchDepts = allDepts.filter(d => String(d.branch_id) === branchIdStr);
      for (const dept of branchDepts) {
        try {
          await base44.entities.BranchDepartmentSetting.delete(dept.id);
        } catch (error) {
          console.warn(`Could not delete BranchDepartmentSetting ${dept.id}`);
        }
      }

      const allContacts = await base44.entities.BranchContact.list();
      const branchContacts = allContacts.filter(c => String(c.branch_id) === branchIdStr);
      for (const contact of branchContacts) {
        try {
          await base44.entities.BranchContact.delete(contact.id);
        } catch (error) {
          console.warn(`Could not delete BranchContact ${contact.id}`);
        }
      }
      
      await base44.entities.Branch.delete(id);
      // NEW: broadcast to update other tabs
      broadcastBdsUpdate({ scope: "all" });
      await loadData();
    } catch (error) {
      console.error("Error deleting branch:", error);
      alert(`שגיאה במחיקת הסניף: ${error.message}`);
    }
  };

  const toggleDepartment = (branchId, deptKey) => {
    setBranchSettings(prev => {
      const currentValue = prev[branchId]?.[deptKey] === true;
      const newValue = !currentValue;
      
      return {
        ...prev,
        [branchId]: {
          ...prev[branchId],
          [deptKey]: newValue
        }
      };
    });
  };

  const saveBranchSettings = async (branchId) => {
    const settings = branchSettings[branchId];
    if (!settings) {
      alert("לא נמצאו הגדרות לסניף זה");
      return;
    }

    setSavingBranch(branchId);
    const branchIdStr = String(branchId);

    // פונקציה להוספת delay
    const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    try {
      const allQueues = await base44.entities.Queue.list();
      const allDeptSettings = await base44.entities.BranchDepartmentSetting.list();
      
      for (const dept of DEPARTMENT_TYPES) {
        const shouldBeActive = settings[dept.key] === true;
        
        const existingSetting = allDeptSettings.find(
          d => String(d.branch_id) === branchIdStr && d.department === dept.name
        );

        if (existingSetting) {
          await base44.entities.BranchDepartmentSetting.update(existingSetting.id, {
            is_active: shouldBeActive
          });
        } else {
          await base44.entities.BranchDepartmentSetting.create({
            branch_id: branchIdStr,
            department: dept.name,
            is_active: shouldBeActive
          });
        }
        
        await delay(100);

        const existingQueue = allQueues.find(q => 
          String(q.branch_id) === branchIdStr && q.name === dept.name
        );

        if (shouldBeActive) {
          if (existingQueue) {
            await base44.entities.Queue.update(existingQueue.id, { is_active: true });
          } else {
            await base44.entities.Queue.create({
              branch_id: branchIdStr,
              name: dept.name,
              seq_counter: 0,
              avg_service_time_seconds: 180,
              is_active: true
            });
          }
        } else {
          if (existingQueue) {
            await base44.entities.Queue.update(existingQueue.id, { is_active: false });
          }
        }
        
        await delay(100);
      }

      queryClient.invalidateQueries(['branchDepartments', branchId]);
      queryClient.invalidateQueries(['queues']);

      alert("השינויים נשמרו בהצלחה!");
      broadcastBdsUpdate({ scope: "branch", branchId: branchIdStr }); // Broadcast specific branch update for settings changes

      await loadData();
    } catch (error) {
      console.error("Error saving branch settings:", error);
      alert(`שגיאה בשמירת ההגדרות: ${error.message}`);
    } finally {
      setSavingBranch(null);
    }
  };

  const createContact = async () => {
    const branchIdStr = contactForm.branch_id ? String(contactForm.branch_id) : null;
    
    await base44.entities.BranchContact.create({
      branch_id: branchIdStr,
      contact_name: contactForm.contact_name,
      phone_number: contactForm.phone_number,
      is_active: contactForm.is_active
    });
    setShowContactDialog(false);
    setContactForm({ branch_id: null, contact_name: "", phone_number: "", is_active: true });
    await loadData();
  };

  const deleteContact = async (id) => {
    if (!confirm("האם אתה בטוח שברצונך למחוק איש קשר זה?")) return;
    await base44.entities.BranchContact.delete(id);
    await loadData();
  };

  const createAllowedIP = async () => {
    await base44.entities.AllowedIP.create(ipForm);
    setShowIpDialog(false);
    setIpForm({ ip_address: "", description: "", is_active: true });
    await loadData();
  };

  const deleteAllowedIP = async (id) => {
    if (!confirm("האם אתה בטוח שברצונך למחוק כתובת IP זו?")) return;
    await base44.entities.AllowedIP.delete(id);
    await loadData();
  };

  const toggleIPStatus = async (id, currentStatus) => {
    await base44.entities.AllowedIP.update(id, { is_active: !currentStatus });
    await loadData();
  };

  const getBranchName = (branchId) => {
    return branches.find(b => String(b.id) === String(branchId))?.name || "לא ידוע";
  };

  // NEW: Clean duplicate branches by name (merge related entities, delete extras)
  const cleanDuplicateBranches = async () => {
    if (!confirm("פעולה זו תאחד סניפים בעלי אותו שם (ללא הבדל אותיות קטנות/גדולות) לסניף אחד ותמחק את הכפילויות. כל הנתונים הקשורים (הגדרות מחלקות, תורים, אנשי קשר) יועברו לסניף הראשי. זוהי פעולה בלתי הפיכה.\n\nהאם להמשיך?")) return;

    setCleaningDupes(true);
    const delay = (ms) => new Promise(r => setTimeout(r, ms));

    try {
      console.log("Starting duplicate branch cleanup...");
      const allBranches = await base44.entities.Branch.list();
      const groups = allBranches.reduce((acc, b) => {
        const key = normalizeName(b.name);
        acc[key] = acc[key] || [];
        acc[key].push(b);
        return acc;
      }, {});

      let duplicatesFound = false;
      let cleanedCount = 0;

      for (const [nameKey, list] of Object.entries(groups)) {
        if (list.length <= 1) continue;

        duplicatesFound = true;
        console.log(`Found duplicates for "${nameKey}": ${list.map(b => b.id).join(", ")}`);

        // Choose primary: the one with earliest created_date (or first)
        const primary = [...list].sort((a, b) => new Date(a.created_date) - new Date(b.created_date))[0];
        const primaryIdStr = String(primary.id);
        console.log(`Primary branch for "${nameKey}" is ID: ${primaryIdStr}`);

        // Re-fetch all related entities inside the loop to get the most up-to-date lists
        const allSettings = await base44.entities.BranchDepartmentSetting.list();
        const allQueues = await base44.entities.Queue.list();
        const allContacts = await base44.entities.BranchContact.list();

        for (const dup of list) {
          if (dup.id === primary.id) continue;

          const dupIdStr = String(dup.id);
          console.log(`Processing duplicate branch ID: ${dupIdStr}`);

          // Migrate BDS
          const dupSettings = allSettings.filter(s => String(s.branch_id) === dupIdStr);
          for (const s of dupSettings) {
            const hasSame = allSettings.find(x => String(x.branch_id) === primaryIdStr && x.department === s.department);
            if (hasSame) {
              if (s.is_active && !hasSame.is_active) {
                console.log(`  Updating primary setting ${hasSame.id} to active for department ${s.department}`);
                await base44.entities.BranchDepartmentSetting.update(hasSame.id, { is_active: true });
              }
              console.log(`  Deleting duplicate setting ${s.id} for department ${s.department}`);
              try {
                await base44.entities.BranchDepartmentSetting.delete(s.id);
              } catch (e) { console.warn(`Failed to delete BDS ${s.id}: ${e.message}`); }
            } else {
              console.log(`  Migrating setting ${s.id} to primary branch ${primaryIdStr}`);
              await base44.entities.BranchDepartmentSetting.update(s.id, { branch_id: primaryIdStr });
            }
            await delay(60);
          }

          // Migrate Queues
          const dupQueues = allQueues.filter(q => String(q.branch_id) === dupIdStr);
          for (const q of dupQueues) {
            const existingQ = allQueues.find(x => String(x.branch_id) === primaryIdStr && x.name === q.name);
            if (existingQ) {
              console.log(`  Deleting duplicate queue ${q.id} for department ${q.name}`);
              try {
                await base44.entities.Queue.delete(q.id);
              } catch (e) { console.warn(`Failed to delete Queue ${q.id}: ${e.message}`); }
            } else {
              console.log(`  Migrating queue ${q.id} to primary branch ${primaryIdStr}`);
              await base44.entities.Queue.update(q.id, { branch_id: primaryIdStr });
            }
            await delay(60);
          }

          // Migrate Contacts
          const dupContacts = allContacts.filter(c => String(c.branch_id) === dupIdStr);
          for (const c of dupContacts) {
            console.log(`  Migrating contact ${c.id} to primary branch ${primaryIdStr}`);
            await base44.entities.BranchContact.update(c.id, { branch_id: primaryIdStr });
            await delay(60);
          }

          // Delete duplicate branch
          console.log(`  Deleting duplicate branch ID: ${dup.id}`);
          try {
            await base44.entities.Branch.delete(dup.id);
            cleanedCount++;
          } catch (e) { console.error(`Failed to delete branch ${dup.id}: ${e.message}`); }
          await delay(100);
        }
      }

      broadcastBdsUpdate({ scope: "all" });
      await delay(200);
      await loadData(); // Reload all data after cleanup
      if (duplicatesFound) {
        alert(`ניקוי כפילויות הושלם בהצלחה ✅. ${cleanedCount} סניפים כפולים נמחקו.`);
      } else {
        alert("לא נמצאו סניפים כפולים לניקוי.");
      }
    } catch (e) {
      console.error("Duplicate cleanup failed:", e);
      alert("שגיאה בניקוי כפילויות: " + e.message + "\n\nנסה שוב לאחר מספר שניות, או בדוק את הקונסול לפרטים.");
    } finally {
      setCleaningDupes(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#E6F9EA' }}>
        <Card className="bg-white">
          <CardContent className="p-12 text-center">
            <p className="text-xl text-gray-600">טוען...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-8" dir="rtl" style={{ backgroundColor: '#E6F9EA' }}>
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex flex-col md:flex-row justify-between items-start gap-3 md:items-center">
          <div>
            <img 
              src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68dbe1252279022b9e191013/8866f21c5_SHuk_LOGO_HAYIR.png"
              alt="שוק העיר"
              className="h-14 w-auto mb-2"
            />
            <h1 className="text-4xl font-bold" style={{ color: '#111111' }}>ניהול מערכת</h1>
            <p className="text-gray-700 mt-2">ניהול סניפים, מחלקות ואנשי קשר</p>
          </div>
          <div className="flex gap-2 w-full md:w-auto">
            <Button
              onClick={runBackfill}
              disabled={isRunningBackfill}
              className="gap-2 text-white shadow-md hover:opacity-90"
              style={{ backgroundColor: '#41B649' }}
            >
              {isRunningBackfill ? "מתקן..." : "🔧 תקן תורים"}
            </Button>
            <Button
              onClick={cleanDuplicateBranches}
              disabled={cleaningDupes}
              variant="outline"
              className="gap-2"
              style={{ borderColor: '#E52521', color: '#E52521' }}
            >
              {cleaningDupes ? "מנקה..." : "🧹 נקה כפילויות"}
            </Button>
          </div>
        </div>

        <Tabs defaultValue="branches" className="w-full">
          <TabsList className="grid w-full max-w-2xl grid-cols-3 bg-white mx-auto" style={{ borderColor: '#41B649' }}>
            <TabsTrigger value="branches" className="data-[state=active]:bg-green-50 data-[state=active]:text-green-900">
              <Building2 className="w-4 h-4 mr-2" />
              סניפים ומחלקות
            </TabsTrigger>
            <TabsTrigger value="contacts" className="data-[state=active]:bg-green-50 data-[state=active]:text-green-900">
              <Phone className="w-4 h-4 mr-2" />
              התראות SMS
            </TabsTrigger>
            <TabsTrigger value="ip-whitelist" className="data-[state=active]:bg-green-50 data-[state=active]:text-green-900">
              🔒 הלבנת IP
            </TabsTrigger>
          </TabsList>

          <TabsContent value="branches" className="space-y-4">
            <div className="flex justify-end">
              <Button
                onClick={() => {
                  setBranchForm({ name: "", address: "", is_active: true });
                  setShowBranchDialog(true);
                }}
                className="gap-2 text-white shadow-md hover:opacity-90"
                style={{ backgroundColor: '#E52521' }}
              >
                <Plus className="w-4 h-4" />
                סניף חדש
              </Button>
            </div>

            <div className="space-y-4">
              {branches.map((branch) => {
                const settings = branchSettings[branch.id] || {};
                
                return (
                  <Card key={branch.id} className="bg-white shadow-lg" style={{ borderColor: '#41B649', borderWidth: '1px' }}>
                    <CardHeader style={{ backgroundColor: '#E6F9EA' }}>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle style={{ color: '#111111' }}>{branch.name}</CardTitle>
                          {branch.address && <p className="text-sm text-gray-600 mt-1">{branch.address}</p>}
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteBranch(branch.id)}
                        >
                          <Trash2 className="w-4 h-4" style={{ color: '#E52521' }} />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="p-6">
                      <div className="space-y-4">
                        <h3 className="text-lg font-semibold" style={{ color: '#111111' }}>מחלקות:</h3>
                        {DEPARTMENT_TYPES.map((dept) => {
                          const isChecked = settings[dept.key] === true;
                          
                          return (
                            <div key={dept.key} className="flex items-center justify-between p-4 rounded-lg" style={{ backgroundColor: '#E6F9EA' }}>
                              <span className="text-lg font-medium" style={{ color: '#111111' }}>{dept.name}</span>
                              <div className="flex items-center gap-2">
                                <span className="text-sm text-gray-600">
                                  {isChecked ? "פעיל" : "כבוי"}
                                </span>
                                <Switch
                                  checked={isChecked}
                                  onCheckedChange={() => toggleDepartment(branch.id, dept.key)}
                                  className="data-[state=checked]:bg-[#41B649]"
                                />
                              </div>
                            </div>
                          );
                        })}
                        <Button
                          onClick={() => saveBranchSettings(branch.id)}
                          disabled={savingBranch === branch.id}
                          className="w-full gap-2 text-white shadow-md hover:opacity-90"
                          style={{ backgroundColor: '#41B649' }}
                        >
                          <Save className="w-4 h-4" />
                          {savingBranch === branch.id ? "שומר..." : "שמור שינויים"}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="contacts" className="space-y-4">
            <div className="flex justify-end">
              <Button
                onClick={() => {
                  setContactForm({ branch_id: null, contact_name: "", phone_number: "", is_active: true });
                  setShowContactDialog(true);
                }}
                className="gap-2 text-white shadow-md hover:opacity-90"
                style={{ backgroundColor: '#E52521' }}
              >
                <Plus className="w-4 h-4" />
                איש קשר חדש
              </Button>
            </div>

            <Card className="bg-white shadow-lg" style={{ borderColor: '#41B649', borderWidth: '1px' }}>
              <CardHeader style={{ backgroundColor: '#E6F9EA' }}>
                <CardTitle style={{ color: '#111111' }}>אנשי קשר להתראות SMS</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>סניף</TableHead>
                      <TableHead>שם</TableHead>
                      <TableHead>טלפון</TableHead>
                      <TableHead>סטטוס</TableHead>
                      <TableHead>פעולות</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {contacts.map((contact) => (
                      <TableRow key={contact.id}>
                        <TableCell className="font-medium">{getBranchName(contact.branch_id)}</TableCell>
                        <TableCell>{contact.contact_name}</TableCell>
                        <TableCell>{contact.phone_number}</TableCell>
                        <TableCell>
                          <Badge style={{ backgroundColor: contact.is_active ? '#E6F9EA' : '#f3f4f6', color: contact.is_active ? '#41B649' : '#6b7280' }}>
                            {contact.is_active ? "פעיל" : "לא פעיל"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteContact(contact.id)}
                          >
                            <Trash2 className="w-4 h-4" style={{ color: '#E52521' }} />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {contacts.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    אין אנשי קשר מוגדרים
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="ip-whitelist" className="space-y-4">
            <div className="flex justify-end gap-2">
              <Button
                onClick={async () => {
                  try {
                    const response = await base44.functions.invoke('getCurrentIP', {});
                    console.log('getCurrentIP response:', response);

                    const data = response.data || response;
                    const ipSourcesList = Object.entries(data.allIPSources || {})
                      .map(([key, value]) => `  • ${key}: ${value}`)
                      .join('\n');

                    const message = [
                      `ה-IP שזוהה: ${data.detectedIP}`,
                      '',
                      ipSourcesList ? `מקורות IP שנמצאו:\n${ipSourcesList}` : 'לא נמצאו מקורות IP',
                      '',
                      'ניתן להוסיף את ה-IP הזה לרשימת הכתובות המותרות למטה ↓'
                    ].join('\n');

                    alert(message);
                  } catch (error) {
                    console.error('getCurrentIP error:', error);
                    alert('שגיאה בזיהוי IP: ' + error.message);
                  }
                }}
                variant="outline"
                className="gap-2"
                style={{ borderColor: '#41B649', color: '#41B649' }}
              >
                🔍 בדוק את ה-IP שלי
              </Button>
              <Button
                onClick={() => {
                  setIpForm({ ip_address: "", description: "", is_active: true });
                  setShowIpDialog(true);
                }}
                className="gap-2 text-white shadow-md hover:opacity-90"
                style={{ backgroundColor: '#E52521' }}
              >
                <Plus className="w-4 h-4" />
                כתובת IP חדשה
              </Button>
            </div>

            <Card className="bg-white shadow-lg" style={{ borderColor: '#41B649', borderWidth: '1px' }}>
              <CardHeader style={{ backgroundColor: '#E6F9EA' }}>
                <CardTitle style={{ color: '#111111' }}>כתובות IP מותרות</CardTitle>
                <p className="text-sm text-gray-600 mt-2">רק כתובות IP מהרשימה הזו יוכלו להתחבר למערכת</p>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>כתובת IP</TableHead>
                      <TableHead>תיאור</TableHead>
                      <TableHead>סטטוס</TableHead>
                      <TableHead>פעולות</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allowedIPs.map((ip) => (
                      <TableRow key={ip.id}>
                        <TableCell className="font-mono font-medium">{ip.ip_address}</TableCell>
                        <TableCell>{ip.description || "-"}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={ip.is_active}
                              onCheckedChange={() => toggleIPStatus(ip.id, ip.is_active)}
                              className="data-[state=checked]:bg-[#41B649]"
                            />
                            <Badge style={{ backgroundColor: ip.is_active ? '#E6F9EA' : '#f3f4f6', color: ip.is_active ? '#41B649' : '#6b7280' }}>
                              {ip.is_active ? "פעיל" : "לא פעיל"}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteAllowedIP(ip.id)}
                          >
                            <Trash2 className="w-4 h-4" style={{ color: '#E52521' }} />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {allowedIPs.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    אין כתובות IP מוגדרות - כל המשתמשים יכולים להתחבר
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={showBranchDialog} onOpenChange={setShowBranchDialog}>
        <DialogContent dir="rtl" className="bg-white">
          <DialogHeader>
            <DialogTitle>סניף חדש</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>שם הסניף</Label>
              <Input
                value={branchForm.name}
                onChange={(e) => setBranchForm({ ...branchForm, name: e.target.value })}
                placeholder="למשל: תל אביב מרכז"
                className="bg-white"
              />
            </div>
            <div>
              <Label>כתובת</Label>
              <Input
                value={branchForm.address}
                onChange={(e) => setBranchForm({ ...branchForm, address: e.target.value })}
                placeholder="למשל: רחוב הרצל 123"
                className="bg-white"
              />
            </div>
            <div className="flex items-center gap-3 py-2">
              <Switch
                checked={branchForm.is_active}
                onCheckedChange={(checked) => setBranchForm({ ...branchForm, is_active: checked })}
                className="data-[state=checked]:bg-[#41B649]"
              />
              <Label>סניף פעיל</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBranchDialog(false)}>
              ביטול
            </Button>
            <Button 
              onClick={createBranch}
              disabled={!branchForm.name}
              className="text-white hover:opacity-90"
              style={{ backgroundColor: '#41B649' }}
            >
              צור סניף
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showContactDialog} onOpenChange={setShowContactDialog}>
        <DialogContent dir="rtl" className="bg-white">
          <DialogHeader>
            <DialogTitle>איש קשר חדש</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>סניף</Label>
              <select
                value={contactForm.branch_id || ""}
                onChange={(e) => setContactForm({ ...contactForm, branch_id: e.target.value})}
                className="w-full p-2 border rounded-md bg-white"
              >
                <option value="">בחר סניף</option>
                {branches.filter(b => b.is_active).map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>שם איש הקשר</Label>
              <Input
                value={contactForm.contact_name}
                onChange={(e) => setContactForm({ ...contactForm, contact_name: e.target.value })}
                placeholder="למשל: דוד כהן"
                className="bg-white"
              />
            </div>
            <div>
              <Label>מספר טלפון</Label>
              <Input
                value={contactForm.phone_number}
                onChange={(e) => setContactForm({ ...contactForm, phone_number: e.target.value })}
                placeholder="050-1234567"
                className="bg-white"
                dir="ltr"
              />
            </div>
            <div className="flex items-center gap-3 py-2">
              <Switch
                checked={contactForm.is_active}
                onCheckedChange={(checked) => setContactForm({ ...contactForm, is_active: checked })}
                className="data-[state=checked]:bg-[#41B649]"
              />
              <Label>איש קשר פעיל</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowContactDialog(false)}>
              ביטול
            </Button>
            <Button 
              onClick={createContact}
              disabled={!contactForm.branch_id || !contactForm.contact_name || !contactForm.phone_number}
              className="text-white hover:opacity-90"
              style={{ backgroundColor: '#41B649' }}
            >
              צור
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showIpDialog} onOpenChange={setShowIpDialog}>
        <DialogContent dir="rtl" className="bg-white">
          <DialogHeader>
            <DialogTitle>כתובת IP חדשה</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>כתובת IP</Label>
              <Input
                value={ipForm.ip_address}
                onChange={(e) => setIpForm({ ...ipForm, ip_address: e.target.value })}
                placeholder="למשל: 192.168.1.100"
                className="bg-white font-mono"
                dir="ltr"
              />
            </div>
            <div>
              <Label>תיאור (אופציונלי)</Label>
              <Input
                value={ipForm.description}
                onChange={(e) => setIpForm({ ...ipForm, description: e.target.value })}
                placeholder="למשל: משרד ראשי, בית מנהל"
                className="bg-white"
              />
            </div>
            <div className="flex items-center gap-3 py-2">
              <Switch
                checked={ipForm.is_active}
                onCheckedChange={(checked) => setIpForm({ ...ipForm, is_active: checked })}
                className="data-[state=checked]:bg-[#41B649]"
              />
              <Label>כתובת פעילה</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowIpDialog(false)}>
              ביטול
            </Button>
            <Button 
              onClick={createAllowedIP}
              disabled={!ipForm.ip_address}
              className="text-white hover:opacity-90"
              style={{ backgroundColor: '#41B649' }}
            >
              הוסף
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}