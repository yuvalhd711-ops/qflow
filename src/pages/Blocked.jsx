import React from "react";

export default function BlockedPage() {
  const urlParams = new URLSearchParams(window.location.search);
  const clientIP = urlParams.get('ip') || 'לא ידוע';

  return (
    <div className="min-h-screen flex items-center justify-center p-4" dir="rtl" style={{ backgroundColor: '#E6F9EA' }}>
      <div className="max-w-md w-full bg-white rounded-xl shadow-2xl p-8 text-center" style={{ borderColor: '#E52521', borderWidth: '3px', borderStyle: 'solid' }}>
        <div className="text-6xl mb-4">🚫</div>
        <h1 className="text-3xl font-bold mb-4" style={{ color: '#E52521' }}>גישה נחסמה</h1>
        <p className="text-gray-700 text-lg mb-6">
          כתובת ה-IP שלך אינה מורשית לגשת למערכת זו.
        </p>
        <div className="bg-gray-100 rounded-lg p-4 mb-6">
          <p className="text-sm text-gray-600 mb-1">כתובת ה-IP שלך:</p>
          <p className="font-mono font-bold text-lg" style={{ color: '#E52521' }}>{clientIP}</p>
        </div>
        <p className="text-gray-600 text-sm">
          אם אתה צריך גישה למערכת, אנא פנה למנהל המערכת כדי להוסיף את כתובת ה-IP שלך לרשימת הכתובות המורשות.
        </p>
      </div>
    </div>
  );
}