import React from "react";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";

export default function PrintTicket({ ticket, queue, onAfterPrint, children }) {
  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    
    const ticketNumber = String(ticket.seq).padStart(3, "0");
    
    const printContent = `
      <!DOCTYPE html>
      <html dir="rtl">
      <head>
        <meta charset="utf-8">
        <title>כרטיס תור - ${ticketNumber}</title>
        <style>
          @media print {
            @page { margin: 0; size: 80mm auto; }
            body { margin: 0; }
          }
          body {
            font-family: Arial, sans-serif;
            text-align: center;
            padding: 20px;
            direction: rtl;
          }
          .header {
            font-size: 24px;
            font-weight: bold;
            margin-bottom: 10px;
            color: #1e40af;
          }
          .ticket-code {
            font-size: 72px;
            font-weight: bold;
            margin: 30px 0;
            color: #000;
            border: 4px solid #1e40af;
            padding: 20px;
            border-radius: 10px;
          }
          .info {
            font-size: 18px;
            margin: 10px 0;
            color: #374151;
          }
          .footer {
            margin-top: 30px;
            font-size: 14px;
            color: #6b7280;
            border-top: 2px dashed #d1d5db;
            padding-top: 15px;
          }
          .barcode {
            margin: 20px 0;
            font-family: 'Courier New', monospace;
            font-size: 20px;
            letter-spacing: 4px;
          }
        </style>
      </head>
      <body>
        <div class="header">${queue.name}</div>
        <div class="ticket-code">${ticketNumber}</div>
        <div class="info">מספר תור שלך</div>
        ${ticket.eta ? `<div class="info">זמן המתנה משוער: ${Math.ceil(ticket.eta / 60)} דקות</div>` : ''}
        <div class="info">נוצר: ${new Date(ticket.created_date).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}</div>
        <div class="barcode">|||  ${ticketNumber}  |||</div>
        <div class="footer">
          <div>אנא המתן עד שיקראו למספר שלך</div>
          <div>תודה על הסבלנות!</div>
        </div>
      </body>
      </html>
    `;
    
    printWindow.document.write(printContent);
    printWindow.document.close();
    
    printWindow.onload = () => {
      printWindow.print();
      printWindow.onafterprint = () => {
        printWindow.close();
        if (onAfterPrint) onAfterPrint();
      };
    };
  };

  if (children) {
    return React.cloneElement(children, { onClick: handlePrint });
  }

  return (
    <Button onClick={handlePrint} variant="outline" className="gap-2">
      <Printer className="w-4 h-4" />
      הדפס כרטיס
    </Button>
  );
}