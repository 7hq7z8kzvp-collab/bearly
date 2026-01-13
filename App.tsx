
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Task, TaskStatus } from './types';
import { geminiService } from './services/geminiService';
import { GeminiVoicePlayer } from './services/audioService';

const voicePlayer = new GeminiVoicePlayer();

const MUSIC_URL = 'https://www.bearlylearning.com/wp-content/uploads/2026/01/Circle-of-Breath.mp3';

const formatTime = (ms: number) => {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

const App: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [inputText, setInputText] = useState('');
  const [helpText, setHelpText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [showDecomposePrompt, setShowDecomposePrompt] = useState(false);
  const [isDecomposing, setIsDecomposing] = useState(false);
  const [celebration, setCelebration] = useState<{ active: boolean; text: string }>({ active: false, text: '' });
  const [hasInteracted, setHasInteracted] = useState(false);
  
  // Custom Scheduling State
  const [customDate, setCustomDate] = useState('');
  const [customTime, setCustomTime] = useState('');
  
  // Deletion State
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Music & Volume State
  const [isMusicPlaying, setIsMusicPlaying] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);
  
  // Scheduling Prompt State
  const [schedulingTask, setSchedulingTask] = useState<{ id: string; title: string } | null>(null);

  // Stats
  const [xp, setXp] = useState(0);
  const [level, setLevel] = useState(1);
  const [streak, setStreak] = useState(0);

  const musicRef = useRef<HTMLAudioElement | null>(null);
  const tasksRef = useRef<Task[]>([]);

  useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);

  const updateTaskStatus = useCallback((id: string, updates: Partial<Task>) => {
    setTasks(current => current.map(t => t.id === id ? { ...t, ...updates, lastActionTime: Date.now() } : t));
    setActiveTask(prev => prev?.id === id ? { ...prev, ...updates, lastActionTime: Date.now() } : prev);
  }, []);

  const speakText = useCallback(async (text: string) => {
    if (!hasInteracted) return;
    
    setIsSpeaking(true);
    const audio = await geminiService.speak(text);
    if (audio) {
      await voicePlayer.play(audio);
    } else {
      const utterance = new SpeechSynthesisUtterance(text);
      window.speechSynthesis.speak(utterance);
    }
    setIsSpeaking(false);
  }, [hasInteracted]);

  const initAudio = useCallback(async () => {
    if (hasInteracted) return;
    
    try {
      // Warm up TTS Audio Context
      await voicePlayer.warmUp();
      
      // Initialize Background Music
      const audio = new Audio();
      audio.src = MUSIC_URL;
      audio.loop = true;
      audio.volume = 0.06;
      audio.preload = 'auto';
      
      musicRef.current = audio;

      audio.addEventListener('error', () => {
        const error = audio.error;
        let errorMessage = 'Unknown error';
        if (error) {
          switch (error.code) {
            case error.MEDIA_ERR_ABORTED: errorMessage = 'Fetch aborted'; break;
            case error.MEDIA_ERR_NETWORK: errorMessage = 'Network error'; break;
            case error.MEDIA_ERR_DECODE: errorMessage = 'Decode error'; break;
            case error.MEDIA_ERR_SRC_NOT_SUPPORTED: errorMessage = 'Source not supported (404 or invalid format)'; break;
          }
        }
        console.error("Audio Load Error:", errorMessage, error);
        console.warn(`Background music (${MUSIC_URL}) failed to load. The app will proceed without it.`);
      });

      setHasInteracted(true);

      if (isMusicPlaying) {
        // We call play() on the interaction that triggers initAudio
        audio.play().catch(err => {
          console.error("Music play failed:", err);
        });
      }
      
      speakText("Ready to focus.");
    } catch (err) {
      console.error("Audio initialization failed:", err);
    }
  }, [hasInteracted, isMusicPlaying, speakText]);

  useEffect(() => {
    const handleFirstInteraction = () => {
      initAudio();
      // Remove listeners once we've had any interaction
      document.removeEventListener('click', handleFirstInteraction);
      document.removeEventListener('keydown', handleFirstInteraction);
      document.removeEventListener('touchstart', handleFirstInteraction);
    };
    document.addEventListener('click', handleFirstInteraction);
    document.addEventListener('keydown', handleFirstInteraction);
    document.addEventListener('touchstart', handleFirstInteraction);
    return () => {
      document.removeEventListener('click', handleFirstInteraction);
      document.removeEventListener('keydown', handleFirstInteraction);
      document.removeEventListener('touchstart', handleFirstInteraction);
    };
  }, [initAudio]);

  useEffect(() => {
    if (musicRef.current) {
      musicRef.current.volume = isSpeaking ? 0.01 : 0.06;
    }
  }, [isSpeaking]);

  const toggleMusic = () => {
    if (!musicRef.current) return;
    if (isMusicPlaying) {
      musicRef.current.pause();
    } else {
      musicRef.current.play().catch(console.error);
    }
    setIsMusicPlaying(!isMusicPlaying);
  };

  // Persistence
  useEffect(() => {
    const savedTasks = localStorage.getItem('adhd_helper_tasks');
    const savedStats = localStorage.getItem('adhd_helper_stats');
    if (savedTasks) {
      try {
        const parsed = JSON.parse(savedTasks) as Task[];
        setTasks(parsed.map(t => ({ ...t, isParsing: false })));
      } catch (e) {}
    }
    if (savedStats) {
      try {
        const { xp, level, streak } = JSON.parse(savedStats);
        setXp(xp || 0); setLevel(level || 1); setStreak(streak || 0);
      } catch (e) {}
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('adhd_helper_stats', JSON.stringify({ xp, level, streak }));
    if (tasks.length > 0) localStorage.setItem('adhd_helper_tasks', JSON.stringify(tasks));
    else localStorage.removeItem('adhd_helper_tasks');
  }, [xp, level, streak, tasks]);

  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick(s => s + 1), 100); 
    return () => clearInterval(t);
  }, []);

  const startVoiceRecognition = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Speech Recognition API is not supported in this browser.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onerror = (event: any) => {
      console.error("Speech Recognition Error:", event.error);
      setIsListening(false);
    };

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      addTask(transcript);
    };

    recognition.start();
  }, [hasInteracted]);

  const triggerCelebration = useCallback((text: string) => {
    setCelebration({ active: true, text });
    setTimeout(() => setCelebration({ active: false, text: '' }), 4000);
    const gain = 25;
    let nextXp = xp + gain;
    let nextLevel = level;
    if (nextXp >= 100) { nextXp -= 100; nextLevel += 1; speakText(`Level Up!`); }
    setXp(nextXp); setLevel(nextLevel); setStreak(s => s + 1);
  }, [xp, level, speakText]);

  const handleInitialTrigger = useCallback(async (task: Task) => {
    const noReminder = task.scheduledTime > Date.now() + 31536000000;
    if (noReminder) return;

    setActiveTask(task);
    await speakText(task.title);
    updateTaskStatus(task.id, { status: TaskStatus.COUNTDOWN, lastActionTime: Date.now(), scheduledTime: Date.now() + 15000 });
  }, [speakText, updateTaskStatus]);

  const addTask = async (rawInput: string, customTime?: number) => {
    const id = Math.random().toString(36).substr(2, 9);
    const newTask: Task = {
      id, title: rawInput, scheduledTime: Date.now() + 999999999999,
      status: TaskStatus.PENDING, retryCount: 0, lastActionTime: Date.now(),
      isParsing: true, isImageLoading: true, modalDismissed: false
    };
    setTasks(prev => [...prev, newTask]);

    const parsed = await geminiService.parseTaskInput(rawInput);
    if (!parsed.timeSpecified && customTime === undefined) {
      setSchedulingTask({ id, title: parsed.title });
    }

    const scheduledTime = customTime !== undefined 
      ? Date.now() + customTime 
      : (parsed.timeSpecified ? Date.now() + (parsed.minutesFromNow * 60000) : Date.now() + 999999999999);

    setTasks(current => current.map(t => t.id === id ? {
      ...t, title: parsed.title,
      scheduledTime,
      isParsing: false
    } : t));

    const imageUrl = await geminiService.generateTaskImage(parsed.title);
    setTasks(current => current.map(t => t.id === id ? { ...t, imageUrl, isImageLoading: false } : t));
  };

  const setTaskSchedule = (minutes: number | null) => {
    if (!schedulingTask) return;
    const time = minutes === null ? Date.now() + 3153600000000 : Date.now() + (minutes * 60000);
    setTasks(prev => prev.map(t => t.id === schedulingTask.id ? { ...t, scheduledTime: time } : t));
    setSchedulingTask(null);
  };

  const handleCustomSchedule = () => {
    if (!schedulingTask || !customDate || !customTime) return;
    const selectedDate = new Date(`${customDate}T${customTime}`);
    const time = selectedDate.getTime();
    if (isNaN(time)) return alert("Invalid date or time");
    
    setTasks(prev => prev.map(t => t.id === schedulingTask.id ? { ...t, scheduledTime: time } : t));
    setSchedulingTask(null);
    setCustomDate('');
    setCustomTime('');
  };

  const onConfirmStart = async (task: Task, started: boolean) => {
    if (started) {
      triggerCelebration("Great start!");
      await speakText("Congratulations!");
      updateTaskStatus(task.id, { status: TaskStatus.WAITING_FOR_COMPLETION, lastActionTime: Date.now(), scheduledTime: Date.now() + (10 * 60000), modalDismissed: false });
      setActiveTask(null);
    } else {
      setStreak(0);
      if (task.retryCount === 0) {
        await speakText(`${task.title}. 5, 4, 3, 2, 1, GO!`);
        if (!showDecomposePrompt) setShowDecomposePrompt(true);
        updateTaskStatus(task.id, { retryCount: 1, status: TaskStatus.COUNTDOWN, lastActionTime: Date.now(), scheduledTime: Date.now() + 15000 });
      } else if (task.retryCount === 1) {
        await speakText("I'll ask you again in 1 minute.");
        updateTaskStatus(task.id, { status: TaskStatus.PENDING, retryCount: 2, lastActionTime: Date.now(), scheduledTime: Date.now() + 60000 });
        setActiveTask(null); setShowDecomposePrompt(false);
      } else {
        updateTaskStatus(task.id, { status: TaskStatus.BLOCKED });
        await speakText("What might help you get started right now?");
        setActiveTask({ ...task, status: TaskStatus.BLOCKED });
      }
    }
  };

  const handleHelpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!helpText.trim() || !activeTask) return;
    
    const suggestion = helpText.trim();
    setHelpText('');
    
    await addTask(suggestion, 0); 
    updateTaskStatus(activeTask.id, { 
      status: TaskStatus.PENDING, 
      scheduledTime: Date.now() + 5 * 60000,
      retryCount: 0,
      lastActionTime: Date.now()
    });
    
    await speakText(`Added ${suggestion} to your queue. Let's do that first.`);
    setActiveTask(null);
  };

  const handleDecompose = async () => {
    if (!activeTask) return;
    setIsDecomposing(true);
    const subs = await geminiService.decomposeTask(activeTask.title);
    if (subs.length > 0) {
      setTasks(prev => prev.filter(t => t.id !== activeTask.id));
      for (const st of subs) await addTask(st);
      await speakText("Broken down. Step one is ready!");
      setActiveTask(null); setShowDecomposePrompt(false);
    }
    setIsDecomposing(false);
  };

  const onConfirmCompletion = async (task: Task, completed: boolean) => {
    if (completed) {
      triggerCelebration("Done!");
      setTasks(prev => prev.filter(t => t.id !== task.id));
      await speakText("Awesome job!");
      setActiveTask(null);
    } else {
      setStreak(0);
      await speakText("Resetting timer.");
      await handleInitialTrigger(task);
    }
  };

  const dismissModal = () => {
    if (activeTask) updateTaskStatus(activeTask.id, { modalDismissed: true });
    setActiveTask(null); setShowDecomposePrompt(false);
  };

  const snoozeTask = (task: Task) => {
    updateTaskStatus(task.id, { scheduledTime: Date.now() + 5 * 60000, status: TaskStatus.PENDING, modalDismissed: false, lastActionTime: Date.now() });
    setActiveTask(null); setShowDecomposePrompt(false);
  };

  const removeTask = (id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id));
    setDeleteConfirmId(null);
  };

  useEffect(() => {
    if (!hasInteracted) return;
    
    const i = setInterval(() => {
      const now = Date.now();
      if (!activeTask && !celebration.active && !schedulingTask) {
        const p = tasksRef.current.find(t => t.status === TaskStatus.PENDING && !t.isParsing && !t.modalDismissed && t.scheduledTime <= now);
        if (p) return handleInitialTrigger(p);
        
        const c = tasksRef.current.find(t => t.status === TaskStatus.COUNTDOWN && t.scheduledTime <= now);
        if (c) {
          updateTaskStatus(c.id, { status: TaskStatus.WAITING_FOR_START_CONFIRMATION, lastActionTime: now });
          setActiveTask({ ...c, status: TaskStatus.WAITING_FOR_START_CONFIRMATION });
          speakText(`Did you start: ${c.title}?`);
        }
        
        const w = tasksRef.current.find(t => t.status === TaskStatus.WAITING_FOR_COMPLETION && t.scheduledTime <= now);
        if (w) { setActiveTask(w); speakText(`Is it done: ${w.title}?`); }
      }
    }, 1000);
    return () => clearInterval(i);
  }, [activeTask, celebration.active, schedulingTask, updateTaskStatus, hasInteracted, speakText, handleInitialTrigger]);

  const timeSlicePercent = useMemo(() => {
    if (!activeTask || activeTask.status !== TaskStatus.COUNTDOWN) return 0;
    return Math.min(100, ((Date.now() - activeTask.lastActionTime) / 15000) * 100);
  }, [activeTask]);

  const groupedTasks = useMemo(() => {
    const g: Record<string, Task[]> = {};
    tasks.forEach(t => { const c = t.category || 'Focus'; if (!g[c]) g[c] = []; g[c].push(t); });
    return g;
  }, [tasks]);

  return (
    <div className="min-h-screen flex flex-col items-center p-4 md:p-8 space-y-8 max-w-4xl mx-auto relative selection:bg-indigo-100 pb-20">
      
      {/* Dopamine Stats Bar */}
      <div className="fixed top-0 left-0 right-0 bg-white/95 backdrop-blur-md z-[60] px-4 md:px-6 py-4 border-b border-slate-100 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3 md:gap-6">
           <div className="flex items-center gap-2">
             <div className="bg-indigo-600 text-white px-2 py-0.5 md:px-3 md:py-1 rounded-lg font-black text-[10px] md:text-xs">LVL {level}</div>
             <div className="w-20 md:w-32 h-2 md:h-2.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
               <div className="bg-gradient-to-r from-teal-400 to-indigo-600 h-full transition-all duration-500" style={{ width: `${xp}%` }}></div>
             </div>
           </div>
           <div className="flex items-center gap-1">
             <span className="text-orange-500 font-black animate-pulse text-sm md:text-lg">🔥</span>
             <span className="font-black text-slate-700 text-xs md:text-sm">{streak}</span>
           </div>
        </div>
        <button onClick={toggleMusic} className={`p-2 md:p-2.5 rounded-xl transition-all ${isMusicPlaying ? 'text-indigo-600 bg-indigo-50 shadow-inner' : 'text-slate-300'}`}>
          <svg viewBox="0 0 24 24" className="h-4 w-4 md:h-5 md:w-5" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /></svg>
        </button>
      </div>

      <header className="flex flex-col md:flex-row items-center gap-4 md:gap-6 pt-16 md:pt-20">
        <div className="w-16 h-16 md:w-20 md:h-20 relative">
          <div className="absolute inset-0 bg-teal-400/20 rounded-2xl blur-lg animate-pulse"></div>
          <div className="relative w-full h-full bg-white rounded-2xl shadow-xl flex items-center justify-center border border-slate-100 overflow-hidden">
             <svg viewBox="0 0 100 100" className="w-12 h-12 md:w-14 md:h-14">
               <defs>
                 <linearGradient id="focusGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                   <stop offset="0%" stopColor="#2dd4bf" />
                   <stop offset="100%" stopColor="#4f46e5" />
                 </linearGradient>
               </defs>
               <circle cx="50" cy="50" r="40" stroke="url(#focusGrad)" strokeWidth="8" fill="none" strokeDasharray="180 60" />
               <path d="M50 30L65 65L50 55L35 65L50 30Z" fill="url(#focusGrad)" />
               <circle cx="50" cy="50" r="4" fill="#1e293b" />
             </svg>
          </div>
        </div>
        <div className="text-center md:text-left">
          <h1 className="text-3xl md:text-5xl font-black text-slate-800 tracking-tight">ADHD<span className="text-indigo-600">Helper</span></h1>
          <p className="text-slate-400 text-[10px] md:text-xs font-black uppercase tracking-[0.4em] mt-1">Executive Function</p>
        </div>
      </header>

      {/* Input Section */}
      <section className="w-full bg-white rounded-[2rem] md:rounded-[2.5rem] shadow-2xl p-6 md:p-8 border-2 border-slate-50 relative overflow-hidden">
        <form onSubmit={(e) => { e.preventDefault(); if (inputText.trim()) addTask(inputText); setInputText(''); }} className="space-y-4">
          <div className="relative">
            <input 
              value={inputText} 
              onChange={(e) => setInputText(e.target.value)} 
              placeholder="Next mission?" 
              className="w-full px-6 py-5 md:px-8 md:py-7 rounded-[1.5rem] md:rounded-[2rem] border-4 border-slate-100 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50 outline-none text-lg md:text-2xl font-black transition-all placeholder:text-slate-300" 
            />
            <button 
              type="button" 
              onClick={startVoiceRecognition} 
              className={`absolute right-4 md:right-6 top-1/2 -translate-y-1/2 p-3 md:p-4 rounded-xl md:rounded-2xl transition-all ${isListening ? 'bg-rose-500 text-white animate-bounce' : 'text-slate-300 hover:text-indigo-500'}`}
            >
              <svg viewBox="0 0 24 24" className="h-6 w-6 md:h-8 md:w-8" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
            </button>
          </div>
          <button 
            type="submit" 
            disabled={!inputText.trim()} 
            className="w-full bg-indigo-600 text-white font-black py-5 md:py-7 rounded-[1.5rem] md:rounded-[2rem] text-xl md:text-2xl shadow-[0_8px_0_rgba(67,56,202,1)] active:translate-y-1 active:shadow-none transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:shadow-none disabled:active:translate-y-0"
          >
            <svg viewBox="0 0 24 24" className="h-6 w-6 md:h-8 md:w-8" fill="none" stroke="currentColor" strokeWidth="4"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
            ADD TASK
          </button>
        </form>

        {schedulingTask && (
          <div className="mt-6 md:mt-8 bg-indigo-50/50 p-6 md:p-8 rounded-[2rem] md:rounded-[3rem] border-2 border-indigo-100 animate-in fade-in slide-in-from-top-6 space-y-6">
            <p className="font-black text-indigo-900 text-lg md:text-xl text-center">When should I remind you?</p>
            <div className="grid grid-cols-2 gap-3 md:gap-4 max-w-sm mx-auto">
              {[10, 60].map(m => (
                <button key={m} onClick={() => setTaskSchedule(m)} className="bg-white border-2 border-indigo-100 py-4 md:py-5 rounded-2xl md:rounded-[2rem] font-black text-indigo-600 hover:border-indigo-500 hover:bg-indigo-600 hover:text-white transition-all text-base md:text-lg shadow-sm">
                  {`${m} mins`}
                </button>
              ))}
            </div>
            
            <div className="bg-white/60 p-5 rounded-[2rem] border-2 border-indigo-50 space-y-4">
               <p className="text-xs font-black text-indigo-400 uppercase tracking-widest text-center">Custom Schedule</p>
               <div className="flex flex-col md:flex-row gap-3">
                 <input type="date" value={customDate} onChange={(e) => setCustomDate(e.target.value)} className="flex-1 px-4 py-3 rounded-xl border-2 border-indigo-50 outline-none focus:border-indigo-300 font-bold" />
                 <input type="time" value={customTime} onChange={(e) => setCustomTime(e.target.value)} className="flex-1 px-4 py-3 rounded-xl border-2 border-indigo-50 outline-none focus:border-indigo-300 font-bold" />
                 <button onClick={handleCustomSchedule} className="bg-indigo-500 text-white px-6 py-3 rounded-xl font-black hover:bg-indigo-600 transition-colors">SET</button>
               </div>
            </div>

            <button onClick={() => setTaskSchedule(null)} className="w-full bg-slate-100 border-2 border-transparent py-4 rounded-2xl md:rounded-[2rem] font-black text-slate-500 hover:bg-slate-200 transition-colors">Queue only (No reminder)</button>
          </div>
        )}
      </section>

      {/* Active Modal */}
      {activeTask && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-2xl z-[100] flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-[3rem] md:rounded-[4rem] p-8 md:p-14 max-w-lg w-full text-center space-y-8 md:space-y-10 relative overflow-hidden shadow-2xl">
            {activeTask.status === TaskStatus.COUNTDOWN && (
              <div className="absolute top-6 right-6 md:top-10 md:right-10 w-20 h-20 md:w-24 md:h-24">
                <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                   <circle cx="50" cy="50" r="45" fill="transparent" stroke="#f1f5f9" strokeWidth="10" />
                   <circle cx="50" cy="50" r="45" fill="transparent" stroke="#4f46e5" strokeWidth="10" strokeDasharray="283" strokeDashoffset={283 - (283 * timeSlicePercent / 100)} className="transition-all duration-100 ease-linear stroke-indigo-600" />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center font-black text-xl md:text-2xl text-indigo-600">{Math.ceil(15 - (timeSlicePercent / 100 * 15))}</div>
              </div>
            )}
            <div className="space-y-6">
              {activeTask.imageUrl && <img src={activeTask.imageUrl} className="w-32 h-32 md:w-40 md:h-40 mx-auto rounded-[2.5rem] md:rounded-[3rem] border-8 border-white shadow-xl object-cover" />}
              <h2 className="text-3xl md:text-4xl font-black text-slate-800 leading-tight">{activeTask.title}</h2>
            </div>
            
            {(activeTask.status === TaskStatus.COUNTDOWN || activeTask.status === TaskStatus.PENDING) && (
              <div className="grid grid-cols-2 gap-4 md:gap-6">
                <button onClick={dismissModal} className="bg-indigo-600 text-white font-black py-6 md:py-7 rounded-[2rem] md:rounded-[2.5rem] shadow-[0_12px_0_rgba(67,56,202,1)] active:translate-y-1 text-xl md:text-2xl">OKAY</button>
                <button onClick={() => snoozeTask(activeTask)} className="bg-slate-100 text-slate-400 font-black py-6 md:py-7 rounded-[2rem] md:rounded-[2.5rem] text-lg md:text-xl">SNOOZE</button>
              </div>
            )}
            
            {activeTask.status === TaskStatus.WAITING_FOR_START_CONFIRMATION && (
              <div className="space-y-6 md:space-y-8">
                <p className="text-2xl md:text-3xl font-black text-slate-700">Started yet?</p>
                <div className="grid grid-cols-2 gap-4 md:gap-6">
                  <button onClick={() => onConfirmStart(activeTask, true)} className="bg-emerald-500 text-white font-black py-7 md:py-8 rounded-[2rem] md:rounded-[2.5rem] shadow-[0_12px_0_rgba(16,185,129,1)] text-2xl md:text-3xl active:translate-y-1">YES</button>
                  <button onClick={() => onConfirmStart(activeTask, false)} className="bg-slate-100 text-slate-400 font-black py-7 md:py-8 rounded-[2rem] md:rounded-[2.5rem] text-2xl md:text-3xl">NO</button>
                </div>
                {showDecomposePrompt && <button onClick={handleDecompose} disabled={isDecomposing} className="w-full bg-indigo-50 text-indigo-600 font-black py-4 md:py-5 rounded-[1.5rem] md:rounded-[2rem] border-2 border-indigo-200 text-lg md:text-xl">{isDecomposing ? 'Thinking...' : 'Break it down?'}</button>}
              </div>
            )}
            
            {activeTask.status === TaskStatus.WAITING_FOR_COMPLETION && (
              <div className="space-y-6 md:space-y-8">
                <p className="text-2xl md:text-3xl font-black text-slate-700">Finished mission?</p>
                <div className="grid grid-cols-2 gap-4 md:gap-6">
                  <button onClick={() => onConfirmCompletion(activeTask, true)} className="bg-indigo-600 text-white font-black py-7 md:py-8 rounded-[2rem] md:rounded-[2.5rem] shadow-[0_12px_0_rgba(67,56,202,1)] text-2xl md:text-3xl active:translate-y-1">DONE!</button>
                  <button onClick={() => onConfirmCompletion(activeTask, false)} className="bg-slate-100 text-slate-400 font-black py-7 md:py-8 rounded-[2rem] md:rounded-[2.5rem] text-2xl md:text-3xl">LATER</button>
                </div>
              </div>
            )}

            {activeTask.status === TaskStatus.BLOCKED && (
              <div className="space-y-6 animate-in slide-in-from-bottom-4">
                <p className="text-xl font-black text-indigo-600">What would help you start?</p>
                <form onSubmit={handleHelpSubmit} className="space-y-4">
                   <input 
                    autoFocus
                    value={helpText}
                    onChange={(e) => setHelpText(e.target.value)}
                    placeholder="e.g., Drink water, play music..."
                    className="w-full px-6 py-4 rounded-2xl border-2 border-indigo-100 focus:border-indigo-500 outline-none text-lg font-bold"
                   />
                   <div className="grid grid-cols-2 gap-4">
                    <button type="submit" className="bg-indigo-600 text-white font-black py-4 rounded-2xl shadow-lg">ADD HELP TASK</button>
                    <button type="button" onClick={dismissModal} className="bg-slate-100 text-slate-400 font-black py-4 rounded-2xl">SKIP</button>
                   </div>
                </form>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
          <div className="bg-white p-8 rounded-[2.5rem] shadow-2xl max-w-sm w-full text-center space-y-6 animate-in zoom-in-95">
            <h3 className="text-2xl font-black text-slate-800">Remove task?</h3>
            <p className="text-slate-500 font-medium">This will permanently delete this mission from your queue.</p>
            <div className="grid grid-cols-2 gap-4">
              <button onClick={() => removeTask(deleteConfirmId)} className="bg-rose-500 text-white font-black py-4 rounded-2xl shadow-lg">DELETE</button>
              <button onClick={() => setDeleteConfirmId(null)} className="bg-slate-100 text-slate-400 font-black py-4 rounded-2xl">CANCEL</button>
            </div>
          </div>
        </div>
      )}

      {/* Task Queue */}
      <section className="w-full">
        {tasks.length === 0 ? (
          <div className="text-center py-24 opacity-20 flex flex-col items-center">
            <p className="font-black text-xl md:text-2xl uppercase tracking-[0.3em]">Quiet Mind</p>
          </div>
        ) : (
          (Object.entries(groupedTasks) as [string, Task[]][]).map(([cat, ts]) => (
            <div key={cat} className="mb-10 md:mb-12">
              <h3 className="text-[10px] md:text-sm font-black text-indigo-400 mb-5 md:mb-6 uppercase tracking-[0.3em] bg-indigo-50/50 inline-block px-3 py-1 md:px-4 md:py-1.5 rounded-lg md:rounded-xl">{cat}</h3>
              <div className="space-y-4 md:space-y-5">
                {ts.map(t => {
                  const due = t.scheduledTime <= Date.now();
                  const noReminder = t.scheduledTime > Date.now() + 31536000000;
                  
                  return (
                    <div key={t.id} onClick={() => handleInitialTrigger(t)} className="bg-white p-5 md:p-7 rounded-[1.8rem] md:rounded-[2.5rem] flex items-center gap-4 md:gap-6 cursor-pointer shadow-sm border-2 border-slate-50 hover:border-indigo-100 hover:shadow-xl hover:-translate-y-1 transition-all group relative">
                      <div className="w-12 h-12 md:w-16 md:h-16 rounded-xl md:rounded-[1.5rem] bg-slate-50 flex items-center justify-center shrink-0 border-2 border-white shadow-sm overflow-hidden">
                        {t.imageUrl ? <img src={t.imageUrl} className="w-full h-full object-cover" /> : <div className="w-4 h-4 md:w-5 md:h-5 bg-indigo-100 rounded-full" />}
                      </div>
                      <div className="flex-1 truncate font-black text-slate-800 text-lg md:text-2xl pr-8">{t.title}</div>
                      
                      <button 
                        onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(t.id); }}
                        className="absolute right-4 top-1/2 -translate-y-1/2 p-2 text-slate-200 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all z-10"
                      >
                         <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>

                      {/* Display countdown only if a reminder is set */}
                      {!noReminder && (
                        <div className={`font-black text-lg md:text-2xl tabular-nums px-3 py-1 md:px-4 md:py-2 rounded-xl md:rounded-2xl shrink-0 group-hover:opacity-0 transition-opacity ${due ? 'bg-rose-50 text-rose-500 animate-pulse' : 'bg-slate-50 text-indigo-300'}`}>
                          {formatTime(t.scheduledTime - Date.now())}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </section>

      {celebration.active && <div className="fixed inset-0 z-[110] flex items-center justify-center pointer-events-none animate-in zoom-in"><div className="bg-gradient-to-r from-teal-400 to-indigo-600 text-white px-8 md:px-10 py-5 md:py-6 rounded-2xl md:rounded-[2.5rem] shadow-2xl font-black text-2xl md:text-3xl">{celebration.text} ✨</div></div>}
    </div>
  );
};

export default App;
