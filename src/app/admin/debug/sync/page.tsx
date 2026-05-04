'use client';

import React, { useEffect, useState } from 'react';
import { db, type SyncLog } from '@/lib/db';

import { 
  Terminal, 
  RefreshCw, 
  Trash2, 
  Info, 
  AlertTriangle, 
  XCircle, 
  CheckCircle2,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

const formatLogDate = (timestamp: number) => {
  return new Intl.DateTimeFormat('es-ES', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    day: '2-digit',
    month: '2-digit',
    hour12: false
  }).format(new Date(timestamp));
};


export default function SyncLogPage() {
  const [logs, setLogs] = useState<SyncLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const allLogs = await db.syncLogs.orderBy('timestamp').reverse().toArray();
      setLogs(allLogs);
    } catch (error) {
      console.error('Error fetching logs:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
    // Refresh every 5 seconds if page is visible
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') fetchLogs();
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const clearLogs = async () => {
    if (confirm('¿Estás seguro de que quieres borrar todos los logs?')) {
      await db.syncLogs.clear();
      fetchLogs();
    }
  };

  const getLevelIcon = (level: string) => {
    switch (level) {
      case 'success': return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
      case 'error': return <XCircle className="w-4 h-4 text-rose-500" />;
      case 'warn': return <AlertTriangle className="w-4 h-4 text-amber-500" />;
      default: return <Info className="w-4 h-4 text-blue-500" />;
    }
  };

  const getLevelClass = (level: string) => {
    switch (level) {
      case 'success': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'error': return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
      case 'warn': return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      default: return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0f1e] text-slate-200 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <Terminal className="w-8 h-8 text-blue-500" />
              Logs del Robot (PWA)
            </h1>
            <p className="text-slate-400 mt-2">
              Monitoreo en tiempo real de la sincronización en segundo plano.
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <button 
              onClick={fetchLogs}
              className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors border border-slate-700"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Actualizar
            </button>
            <button 
              onClick={clearLogs}
              className="flex items-center gap-2 px-4 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-lg transition-colors border border-rose-500/20"
            >
              <Trash2 className="w-4 h-4" />
              Limpiar
            </button>
          </div>
        </div>

        <div className="bg-[#111827] rounded-xl border border-slate-800 overflow-hidden shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-slate-900/50 border-b border-slate-800">
                  <th className="px-4 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider w-16">Nivel</th>
                  <th className="px-4 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider w-40">Fecha/Hora</th>
                  <th className="px-4 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider w-32">Tipo</th>
                  <th className="px-4 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Mensaje</th>
                  <th className="px-4 py-4 text-center text-xs font-semibold text-slate-400 uppercase tracking-wider w-16">Detalle</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {logs.length === 0 && !loading ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center text-slate-500 italic">
                      No hay logs registrados todavía. El robot está durmiendo.
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <React.Fragment key={log.id}>
                      <tr 
                        className={`hover:bg-slate-800/30 transition-colors ${expandedId === log.id ? 'bg-slate-800/50' : ''}`}
                        onClick={() => log.details ? setExpandedId(expandedId === log.id ? null : log.id!) : null}
                      >
                        <td className="px-4 py-3">
                          <div className={`inline-flex items-center justify-center p-1.5 rounded-md border ${getLevelClass(log.level)}`}>
                            {getLevelIcon(log.level)}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm font-mono text-slate-400 whitespace-nowrap">
                          {formatLogDate(log.timestamp)}
                        </td>

                        <td className="px-4 py-3">
                          <span className="text-xs font-bold px-2 py-1 bg-slate-800 rounded text-slate-300 uppercase tracking-tight">
                            {log.type || 'General'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-300">
                          {log.message}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {log.details && (
                            <button className="text-slate-500 hover:text-white transition-colors">
                              {expandedId === log.id ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                            </button>
                          )}
                        </td>
                      </tr>
                      {expandedId === log.id && log.details && (
                        <tr className="bg-slate-900/80 border-l-2 border-l-blue-500">
                          <td colSpan={5} className="px-8 py-4">
                            <pre className="text-xs font-mono text-blue-300 whitespace-pre-wrap break-all bg-black/40 p-4 rounded-lg border border-slate-800">
                              {log.details}
                            </pre>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-center gap-6 text-sm text-slate-500">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Auto-actualización activa
          </div>
          <div className="text-slate-600">|</div>
          <div>Mostrando los últimos 200 eventos</div>
        </div>
      </div>
    </div>
  );
}
