import { useEffect, useRef } from "react";

export default function AudioNotification({ ticket, onPlayComplete }) {
  const playedRef = useRef(false);

  useEffect(() => {
    if (!ticket || playedRef.current) return;
    playedRef.current = true;

    playBeep();

    const t = setTimeout(async () => {
      await speakAnnouncement(ticket.seq);
      onPlayComplete?.();
    }, 500);

    return () => {
      clearTimeout(t);
      playedRef.current = false;
      try { window.speechSynthesis.cancel(); } catch {}
    };
  }, [ticket, onPlayComplete]);

  const playBeep = () => {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      const ctx = new Ctx();
      [800, 1000].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = "sine";
        osc.frequency.value = freq;
        const t = ctx.currentTime + i * 0.15;
        gain.gain.setValueAtTime(0.3, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.1);
        osc.start(t);
        osc.stop(t + 0.15);
      });
    } catch {}
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

  const speakAnnouncement = async (seq) => {
    if (!("speechSynthesis" in window)) return;

    const ss = window.speechSynthesis;
    try { ss.cancel(); ss.resume(); } catch {}

    const voices = await getVoicesWithRetry();
    const heVoice = pickHebrewVoice(voices);

    // Say digits: "מספר {seq}" (not words)
    const text = `מספר ${seq}`;

    const u = new SpeechSynthesisUtterance(text);
    u.lang = "he-IL";
    u.rate = 0.95;
    u.pitch = 1;
    u.volume = 1;
    if (heVoice) u.voice = heVoice;

    try { ss.resume(); } catch {}
    ss.speak(u);
  };

  return null;
}