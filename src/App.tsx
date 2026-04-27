/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, 
  Briefcase, 
  Zap, 
  Plus, 
  Trash2, 
  BrainCircuit, 
  CheckCircle2, 
  AlertCircle,
  LayoutDashboard,
  Settings2,
  ChevronRight,
  LogIn,
  LogOut,
  History,
  FileText,
  Lightbulb,
  BarChart3,
  Database,
  Share2
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell,
  PieChart,
  Pie,
  Legend
} from 'recharts';
import { Resource, Task, AllocationReport, Priority } from './types';
import { INITIAL_RESOURCES, INITIAL_TASKS } from './constants';
import { generateAllocation } from './services/geminiService';
import { auth, db, signIn, signOut } from './firebase';
import { 
  collection, 
  doc, 
  setDoc, 
  getDocs, 
  query, 
  where, 
  onSnapshot, 
  deleteDoc,
  serverTimestamp,
  getDocFromServer
} from 'firebase/firestore';
import { User } from 'firebase/auth';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null, setError?: (msg: string) => void) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
    },
    operationType,
    path
  };
  console.error('Firestore Error details: ', JSON.stringify(errInfo));
  
  if (setError) {
    if (errInfo.error.includes('permissions')) {
      setError("Database access denied. Please check your account privileges.");
    } else if (errInfo.error.includes('unavailable')) {
      setError("Database is currently offline. Retrying connection...");
    } else {
      setError(`System Error: ${operationType} failed.`);
    }
  }
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [resources, setResources] = useState<Resource[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [report, setReport] = useState<AllocationReport | null>(null);
  const [history, setHistory] = useState<(AllocationReport & { id: string })[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab ] = useState<'input' | 'results' | 'history'>('input');
  const [error, setError ] = useState<string | null>(null);
  const [tryHeuristic, setTryHeuristic] = useState(false);

  // Heuristic fallback for when AI is unavailable
  const generateHeuristicAllocation = (resList: Resource[], taskList: Task[]): AllocationReport => {
    const allocations: any[] = [];
    const sortedTasks = [...taskList].sort((a, b) => b.priority === 'high' ? 1 : -1);
    const availableRes = [...resList];

    sortedTasks.forEach((task, index) => {
      // Simple round-robin for fallback
      const resource = availableRes[index % availableRes.length];
      if (resource) {
        allocations.push({
          taskId: task.id,
          resourceId: resource.id,
          reason: "Fallback heuristic applied due to service availability. Tasks prioritized by priority level."
        });
      }
    });

    return {
      summary: "Manual heuristic plan generated (AI services currently under high load). This plan balances workload across available resources based on task priority.",
      efficiencyScore: 0.7,
      aiSuggestions: [
        "System is currently in fallback mode.",
        "Consider manually reviewing task assignments.",
        "Retry AI analysis when demand decreases."
      ],
      allocations,
      createdAt: new Date().toISOString(),
      ownerId: user?.uid || ''
    };
  };

  const useFallback = async () => {
    if (!user) return;
    setIsLoading(true);
    setError(null);
    try {
      const result = generateHeuristicAllocation(resources, tasks);
      setReport(result);
      const reportId = `rep-fallback-${Date.now()}`;
      await setDoc(doc(db, 'reports', reportId), { 
        ...result, 
        ownerId: user.uid,
        createdAt: new Date().toISOString()
      });
      setTryHeuristic(false);
      setActiveTab('results');
    } catch (err) {
      setError("Fallback generation failed.");
    } finally {
      setIsLoading(false);
    }
  };

  // Auth State
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((u) => {
      setUser(u);
      if (!u) {
        setResources([]);
        setTasks([]);
        setReport(null);
        setHistory([]);
      }
    });
    return unsubscribe;
  }, []);

  // Connection Test
  useEffect(() => {
    async function testConnection() {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (err) {
        // Silent fail or log
      }
    }
    testConnection();
  }, []);

  // Data Sync
  useEffect(() => {
    if (!user) return;

    const qRes = query(collection(db, 'resources'), where('ownerId', '==', user.uid));
    const unsubscribeRes = onSnapshot(qRes, (snap) => {
      setResources(snap.docs.map(d => d.data() as Resource));
      setError(null); // Clear error if successful
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'resources', setError));

    const qTasks = query(collection(db, 'tasks'), where('ownerId', '==', user.uid));
    const unsubscribeTasks = onSnapshot(qTasks, (snap) => {
      setTasks(snap.docs.map(d => d.data() as Task));
      setError(null);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'tasks', setError));

    const qReports = query(collection(db, 'reports'), where('ownerId', '==', user.uid));
    const unsubscribeReports = onSnapshot(qReports, (snap) => {
      setHistory(snap.docs.map(d => ({ ...d.data(), id: d.id } as AllocationReport & { id: string })));
      setError(null);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'reports', setError));

    // Auto-seed if empty
    const checkAndSeed = async () => {
      try {
        const resSnap = await getDocs(qRes);
        const taskSnap = await getDocs(qTasks);
        if (resSnap.empty && taskSnap.empty) {
          console.log("Database empty, auto-seeding...");
          for (const r of INITIAL_RESOURCES) await setDoc(doc(db, 'resources', r.id), { ...r, ownerId: user.uid });
          for (const t of INITIAL_TASKS) await setDoc(doc(db, 'tasks', t.id), { ...t, ownerId: user.uid });
        }
      } catch (err) {
        console.warn("Auto-seed check failed (likely network/permissions):", err);
      }
    };
    checkAndSeed();

    return () => {
      unsubscribeRes();
      unsubscribeTasks();
      unsubscribeReports();
    };
  }, [user]);

  const addResource = async () => {
    if (!user) return;
    const newRes: Resource = {
      id: `r-${Date.now()}`,
      name: "New Team Member",
      role: "Contributor",
      skills: ["General"],
      availability: 100,
    };
    try {
      await setDoc(doc(db, 'resources', newRes.id), { ...newRes, ownerId: user.uid });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'resources', setError);
    }
  };

  const addTask = async () => {
    if (!user) return;
    const newTask: Task = {
      id: `t-${Date.now()}`,
      title: "New Project Task",
      priority: "medium" as Priority,
      requiredSkills: ["Skill"],
      estimatedHours: 10,
    };
    try {
      await setDoc(doc(db, 'tasks', newTask.id), { ...newTask, ownerId: user.uid });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'tasks', setError);
    }
  };

  const deleteResource = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'resources', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `resources/${id}`, setError);
    }
  };

  const deleteTask = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'tasks', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `tasks/${id}`, setError);
    }
  };

  const updateResource = async (id: string, updates: Partial<Resource>) => {
    const res = resources.find(r => r.id === id);
    if (!res || !user) return;
    try {
      await setDoc(doc(db, 'resources', id), { ...res, ...updates, ownerId: user.uid });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `resources/${id}`, setError);
    }
  };

  const updateTask = async (id: string, updates: Partial<Task>) => {
    const task = tasks.find(t => t.id === id);
    if (!task || !user) return;
    try {
      await setDoc(doc(db, 'tasks', id), { ...task, ...updates, ownerId: user.uid });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `tasks/${id}`, setError);
    }
  };

  const resetData = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      // Clear existing
      for (const r of resources) await deleteDoc(doc(db, 'resources', r.id));
      for (const t of tasks) await deleteDoc(doc(db, 'tasks', t.id));
      
      // Load initial
      for (const r of INITIAL_RESOURCES) await setDoc(doc(db, 'resources', r.id), { ...r, ownerId: user.uid });
      for (const t of INITIAL_TASKS) await setDoc(doc(db, 'tasks', t.id), { ...t, ownerId: user.uid });
      
      setReport(null);
      setActiveTab('input');
      setError(null);
    } catch (err) {
      setError("Reset failed. Check connection.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAllocate = async () => {
    if (!user) {
      setError("Please sign in to optimize allocations.");
      return;
    }
    if (resources.length === 0 || tasks.length === 0) {
      setError("Please add at least one resource and one task.");
      return;
    }
    
    setIsLoading(true);
    setReport(null);
    setError(null);
    setTryHeuristic(false);
    try {
      const result = await generateAllocation(resources, tasks);
      setReport(result);
      
      // Save report
      const reportId = `rep-${Date.now()}`;
      await setDoc(doc(db, 'reports', reportId), { 
        ...result, 
        ownerId: user.uid,
        createdAt: new Date().toISOString()
      });
      
      setActiveTab('results');
    } catch (err: any) {
      const isQuota = err.message?.includes('429') || err.message?.toLowerCase().includes('quota') || err.message?.toLowerCase().includes('demand');
      if (isQuota) {
        setError("AI services are currently overloaded. Would you like to use the Smart Fallback?");
        setTryHeuristic(true);
      } else {
        setError("AI Analysis failed. Check connection or try again later.");
      }
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white p-12 rounded-2xl shadow-2xl max-w-md w-full text-center space-y-8"
        >
          <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center mx-auto shadow-lg shadow-indigo-200">
            <Zap className="text-white w-8 h-8" />
          </div>
          <div>
            <h1 className="text-4xl font-bold text-slate-900 tracking-tight mb-2">Allocai</h1>
            <p className="text-slate-500 font-medium italic">Smart Resource Allocation Engine</p>
          </div>
          <div className="space-y-4">
            <p className="text-sm text-slate-400">Sign in to optimize your team's workflow with advanced AI analysis.</p>
            <button 
              onClick={signIn}
              className="w-full flex items-center justify-center gap-3 bg-slate-900 text-white font-bold py-4 rounded-xl hover:bg-slate-800 transition-all shadow-lg active:scale-95"
            >
              <LogIn className="w-5 h-5" />
              Sign in with Google
            </button>
          </div>
          <div className="pt-4 border-t border-slate-100 italic text-[10px] text-slate-300 uppercase tracking-widest font-bold">
            Powered by Gemini AI & Firebase
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full bg-slate-50 text-slate-900 font-sans overflow-hidden">
      {/* Sidebar Navigation */}
      <nav className="w-64 bg-slate-900 text-slate-300 flex flex-col shrink-0">
        <div className="p-6 flex items-center gap-3 border-b border-slate-800">
          <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-white text-lg tracking-tight">Allocai AI</span>
        </div>
        
        <div className="flex-1 p-4 space-y-2">
          <button 
            onClick={() => setActiveTab('input')}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-md transition-all ${
              activeTab === 'input' ? 'bg-slate-800 text-white' : 'hover:bg-slate-800'
            }`}
          >
            <LayoutDashboard className="w-5 h-5 opacity-70" />
            <span className="font-medium">Configuration</span>
          </button>
          
          <button 
            onClick={() => setActiveTab('history')}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-md transition-all ${
              activeTab === 'history' ? 'bg-slate-800 text-white' : 'hover:bg-slate-800'
            }`}
          >
            <History className="w-5 h-5 opacity-70" />
            <span className="font-medium">Plan History</span>
          </button>

          <button 
            onClick={resetData}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-md transition-all hover:bg-slate-800 text-slate-500 hover:text-white"
          >
            <Database className="w-5 h-5 opacity-70" />
            <span className="font-medium">Reset & Seed Data</span>
          </button>

          <button 
            onClick={() => {
              navigator.clipboard.writeText(window.location.origin);
              alert("Project URL copied to clipboard! Share this link with others.");
            }}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-md transition-all hover:bg-slate-800 text-slate-500 hover:text-white"
          >
            <Share2 className="w-5 h-5 opacity-70" />
            <span className="font-medium">Share Project</span>
          </button>
        </div>

        <div className="p-4 border-t border-slate-800 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-indigo-400 font-bold border border-slate-600 overflow-hidden">
            {user.photoURL ? <img src={user.photoURL} alt="p" className="w-full h-full object-cover" referrerPolicy="no-referrer" /> : user.displayName?.charAt(0)}
          </div>
          <div className="overflow-hidden flex-1">
            <p className="text-sm font-semibold text-white truncate">{user.displayName || 'Human'}</p>
            <p className="text-xs opacity-50 truncate">Resource Analyst</p>
          </div>
          <button onClick={signOut} className="text-slate-500 hover:text-white transition-colors">
            <LogOut size={16} />
          </button>
        </div>
      </nav>

      {/* Main Viewport */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 bg-white border-b border-slate-200 px-8 flex items-center justify-between shrink-0">
          <h1 className="text-xl font-bold text-slate-800 capitalize">
            {activeTab === 'input' ? 'Optimization Setup' : activeTab === 'results' ? 'AI Proposal Analysis' : 'Historical Archives'}
          </h1>
          <div className="flex items-center gap-6">
            <div className="hidden md:flex items-center gap-2 text-sm font-medium text-slate-500">
              <span className={`w-2 h-2 rounded-full ${isLoading ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`}></span>
              Status: {isLoading ? 'Processing' : 'Active'}
            </div>
            {activeTab === 'input' && (
              <button 
                onClick={handleAllocate}
                disabled={isLoading}
                className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-indigo-700 shadow-sm transition-all disabled:opacity-50 flex items-center gap-2"
              >
                {isLoading ? <Settings2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                Optimize
              </button>
            )}
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8">
          <AnimatePresence mode="wait">
            {activeTab === 'input' ? (
              <motion.div 
                key="input"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="max-w-6xl mx-auto grid grid-cols-1 xl:grid-cols-2 gap-8"
              >
                {error && (
                  <div className="col-span-full">
                    <div className="bg-red-50 border border-red-100 p-4 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-red-700">
                      <div className="flex items-center gap-3">
                        <AlertCircle className="shrink-0 w-5 h-5" />
                        <p className="text-sm font-medium">{error}</p>
                      </div>
                      {tryHeuristic && (
                        <button 
                          onClick={useFallback}
                          className="bg-white border border-red-200 px-4 py-2 rounded-lg text-xs font-bold text-red-600 hover:bg-red-100 transition-all shadow-sm shrink-0 flex items-center gap-2"
                        >
                          <BrainCircuit className="w-4 h-4" />
                          Apply Smart Fallback
                        </button>
                      )}
                    </div>
                  </div>
                )}

                <div className="col-span-full grid grid-cols-1 sm:grid-cols-3 gap-6 mb-2">
                  <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                    <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1 text-center">Resources</p>
                    <p className="text-3xl font-bold text-slate-800 text-center">{resources.length}</p>
                  </div>
                  <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                    <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1 text-center">Tasks</p>
                    <p className="text-3xl font-bold text-slate-800 text-center">{tasks.length}</p>
                  </div>
                  <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                    <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1 text-center">Avg Capacity</p>
                    <p className="text-3xl font-bold text-slate-800 text-center">
                      {(resources.reduce((acc, curr) => acc + curr.availability, 0) / (resources.length || 1)).toFixed(0)}%
                    </p>
                  </div>
                </div>

                <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col">
                  <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Users className="w-5 h-5 text-indigo-500" />
                      <h3 className="font-bold text-slate-800">Resources</h3>
                    </div>
                    <button onClick={addResource} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all">
                      <Plus className="w-5 h-5" />
                    </button>
                  </div>
                  <div className="divide-y divide-slate-100 max-h-[500px] overflow-y-auto">
                    {resources.map((res, i) => (
                      <div key={res.id} className="p-4 hover:bg-slate-50 transition-colors group">
                        <div className="flex items-start justify-between">
                          <input 
                            className="font-bold text-slate-800 bg-transparent border-none p-0 focus:ring-0 outline-none w-full"
                            value={res.name}
                            onChange={(e) => updateResource(res.id, { name: e.target.value })}
                          />
                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight block">Alloc %</span>
                              <input 
                                type="number"
                                className="w-10 text-sm font-mono font-bold text-indigo-600 bg-transparent border-none p-0 focus:ring-0 text-right outline-none"
                                value={res.availability}
                                onChange={(e) => updateResource(res.id, { availability: Math.min(100, Math.max(0, parseInt(e.target.value) || 0)) })}
                              />
                            </div>
                            <button onClick={() => deleteResource(res.id)} className="opacity-0 group-hover:opacity-100 p-1.5 text-red-400 hover:bg-red-50 rounded transition-all">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {res.skills.map(s => (
                            <span key={s} className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-bold rounded uppercase tracking-wider">{s}</span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col">
                  <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Briefcase className="w-5 h-5 text-indigo-500" />
                      <h3 className="font-bold text-slate-800">Tasks</h3>
                    </div>
                    <button onClick={addTask} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all">
                      <Plus className="w-5 h-5" />
                    </button>
                  </div>
                  <div className="divide-y divide-slate-100 max-h-[500px] overflow-y-auto">
                    {tasks.map((task, i) => (
                      <div key={task.id} className="p-4 hover:bg-slate-50 transition-colors group">
                        <div className="flex items-start justify-between">
                          <div className="space-y-1">
                            <input 
                              className="font-bold text-slate-800 bg-transparent border-none p-0 focus:ring-0 outline-none w-full"
                              value={task.title}
                              onChange={(e) => updateTask(task.id, { title: e.target.value })}
                            />
                            <select 
                              className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-widest border-none focus:ring-0 outline-none ${
                                task.priority === 'high' ? 'bg-red-50 text-red-600' : 'bg-indigo-50 text-indigo-600'
                              }`}
                              value={task.priority}
                              onChange={(e) => updateTask(task.id, { priority: e.target.value as Priority })}
                            >
                              <option value="low">Low</option>
                              <option value="medium">Medium</option>
                              <option value="high">High</option>
                            </select>
                          </div>
                          <div className="flex items-center gap-3">
                            <input 
                              type="number"
                              className="w-10 text-sm font-mono font-bold text-slate-700 bg-transparent border-none p-0 focus:ring-0 text-right outline-none"
                              value={task.estimatedHours}
                              onChange={(e) => updateTask(task.id, { estimatedHours: Math.max(1, parseInt(e.target.value) || 1) })}
                            />
                            <button onClick={() => deleteTask(task.id)} className="opacity-0 group-hover:opacity-100 p-1.5 text-red-400 hover:bg-red-50 rounded transition-all">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            ) : activeTab === 'results' ? (
              <motion.div key="results" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="max-w-6xl mx-auto space-y-8">
                {report && (
                  <>
                    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col items-center justify-center">
                        <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-2">Efficiency Rating</p>
                        <p className="text-5xl font-bold text-indigo-600">{(report.efficiencyScore * 100).toFixed(0)}%</p>
                        <p className="text-[10px] text-slate-400 mt-2 font-medium">Higher is better</p>
                      </div>
                      
                      <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col">
                        <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-4 flex items-center gap-2">
                          <BarChart3 className="w-4 h-4 text-indigo-500" /> Allocation Confidence scores
                        </p>
                        <div className="h-[140px] w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={report.allocations.map(a => ({ name: tasks.find(t => t.id === a.taskId)?.title.substring(0, 10) + '...', confidence: a.confidence * 100 }))}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                              <XAxis dataKey="name" hide />
                              <YAxis hide domain={[0, 100]} />
                              <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                              <Bar dataKey="confidence" radius={[4, 4, 0, 0]} barSize={30}>
                                {report.allocations.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={entry.confidence > 0.8 ? '#10b981' : entry.confidence > 0.5 ? '#6366f1' : '#f59e0b'} />
                                ))}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>

                      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col">
                        <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-4 flex items-center gap-2">
                          <Users className="w-4 h-4 text-indigo-500" /> Workload Share
                        </p>
                        <div className="h-[140px] w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={resources.map(r => ({
                                  name: r.name,
                                  value: report.allocations.filter(a => a.resourceId === r.id).length
                                })).filter(d => d.value > 0)}
                                cx="50%"
                                cy="50%"
                                innerRadius={40}
                                outerRadius={60}
                                paddingAngle={5}
                                dataKey="value"
                              >
                                {resources.map((_, index) => (
                                  <Cell key={`cell-${index}`} fill={['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6'][index % 5]} />
                                ))}
                              </Pie>
                              <Tooltip contentStyle={{ fontSize: '10px', borderRadius: '4px' }} />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="bg-slate-900 text-white p-8 rounded-xl relative overflow-hidden shadow-lg border border-slate-800 flex flex-col justify-center min-h-[180px]">
                        <div className="relative z-10">
                          <p className="text-indigo-400 text-xs font-bold uppercase tracking-widest mb-4 flex items-center gap-2">
                            <BrainCircuit className="w-4 h-4" /> AI Strategic Overview
                          </p>
                          <p className="text-xl font-medium leading-relaxed italic opacity-90">"{report.summary}"</p>
                        </div>
                        <div className="absolute -bottom-10 -right-10 p-4 opacity-5">
                          <BrainCircuit size={180} />
                        </div>
                      </div>

                      <div className="bg-gradient-to-br from-indigo-50 to-white p-8 rounded-xl border border-indigo-100 shadow-sm relative overflow-hidden">
                        <p className="text-indigo-600 text-xs font-bold uppercase tracking-widest mb-4 flex items-center gap-2">
                          <Lightbulb className="w-4 h-4" /> Optimization Recommendations
                        </p>
                        <div className="grid grid-cols-1 gap-3">
                          {report.aiSuggestions.map((suggestion, idx) => (
                            <div key={idx} className="flex items-start gap-4 p-3 bg-white/60 rounded-lg border border-white group hover:border-indigo-200 transition-all">
                              <span className="w-6 h-6 rounded-lg bg-indigo-600 text-white flex items-center justify-center text-xs font-bold shrink-0 shadow-sm">{idx + 1}</span>
                              <p className="text-sm text-slate-700 font-medium leading-normal">{suggestion}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                      <div className="p-6 border-b border-slate-100 font-bold text-slate-800">Allocation Plan</div>
                      <div className="divide-y divide-slate-100">
                        {report.allocations.map((alloc) => {
                          const task = tasks.find(t => t.id === alloc.taskId);
                          const resource = resources.find(r => r.id === alloc.resourceId);
                          return (
                            <div key={alloc.taskId} className="p-6 grid grid-cols-1 xl:grid-cols-12 gap-6 items-center">
                              <div className="xl:col-span-4 font-bold text-slate-800">{task?.title || "Unknown Task"}</div>
                              <div className="xl:col-span-1 opacity-20 hidden xl:flex justify-center"><ChevronRight /></div>
                              <div className="xl:col-span-3 flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xs">{resource?.name.charAt(0)}</div>
                                <div className="font-bold text-slate-800">{resource?.name}</div>
                              </div>
                              <div className="xl:col-span-4 bg-emerald-50/50 p-4 rounded-lg border border-emerald-100">
                                <p className="text-sm text-slate-600 italic leading-snug">{alloc.reasoning}</p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    <div className="text-center"><button onClick={() => setActiveTab('input')} className="px-6 py-2 border border-slate-200 rounded-lg font-bold text-slate-600 hover:bg-slate-50 transition-all">New Setup</button></div>
                  </>
                )}
              </motion.div>
            ) : (
              <motion.div key="history" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-4xl mx-auto space-y-6">
                <h3 className="text-lg font-bold text-slate-800 mb-6">Generated Plan Archives</h3>
                {history.length === 0 ? (
                  <div className="bg-white p-12 rounded-xl border border-slate-200 text-center space-y-4">
                    <FileText className="w-12 h-12 text-slate-200 mx-auto" />
                    <p className="text-slate-400 font-medium">No archived reports yet. Run an optimization to see it here.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {history.map(ret => (
                      <div key={ret.id} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between hover:border-indigo-200 transition-colors cursor-pointer" onClick={() => { setReport(ret); setActiveTab('results'); }}>
                        <div className="space-y-1">
                          <p className="font-bold text-slate-800">Plan Optimization {ret.id.split('-')[1]}</p>
                          <p className="text-xs text-slate-400">Created: {new Date(ret.createdAt || '').toLocaleString()}</p>
                        </div>
                        <div className="flex items-center gap-6">
                          <div className="text-right">
                            <p className="text-[10px] font-bold text-slate-400 uppercase">Efficiency</p>
                            <p className="font-bold text-indigo-600">{(ret.efficiencyScore * 100).toFixed(0)}%</p>
                          </div>
                          <ChevronRight className="text-slate-300" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <footer className="h-8 bg-slate-100 border-t border-slate-200 px-8 flex items-center justify-between text-[10px] font-medium text-slate-500 shrink-0">
          <div className="flex gap-4 uppercase font-bold tracking-tight"><span>Allocai Engine v2.5</span><span>Live Analytics</span></div>
          <div className="opacity-50">Cloud Database Synced: {new Date().toLocaleTimeString()}</div>
        </footer>
      </main>
    </div>
  );
}

