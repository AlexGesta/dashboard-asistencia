import React, { useState, useMemo, useEffect } from 'react';
import { 
  Users, Calendar, Clock, RefreshCw, CheckCircle2, XCircle, Sparkles, BrainCircuit, FileText, BarChart3, TrendingUp, AlertTriangle, Award, Maximize2, Minimize2, Share2, Copy
} from 'lucide-react';

// URL del CSV de Google Sheets
const YOUR_SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vR5QJy5WxLujzVZZkudkyCn4jHPbVzOoFft4vYINFu_Rl3Ei63K9lepYr39YANV9J466L2je0VTOHqC/pub?gid=1756945709&single=true&output=csv";
const apiKey = ""; // La plataforma proporciona la clave de Gemini en tiempo de ejecución

// Función de limpieza de strings
const clean = (str) => str ? str.trim().replace(/["']/g, "") : "";

// Función para parsear el CSV
const parseCSV = (csvText) => {
  const lines = csvText.split('\n').filter(line => line.trim() !== '');
  if (lines.length < 2) return { rawData: [], studentList: [] };
  
  const rawHeaders = lines[0].split(',').map(h => clean(h));
  let dateIdx = rawHeaders.findIndex(h => h.toLowerCase().includes('fecha'));
  if (dateIdx === -1) dateIdx = 0; 

  const studentCols = [];
  rawHeaders.forEach((header, index) => {
    if (index !== dateIdx && index !== 0) { 
      const match = header.match(/\[(.*?)\]/);
      let name = match ? match[1] : header.replace(/pregunta sin título/i, '').trim();
      if (name) studentCols.push({ index, name });
    }
  });

  const parsedData = lines.slice(1).map(line => {
    const values = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(v => clean(v));
    const rowObj = { fecha: values[dateIdx] || values[0] || 'Sin fecha' };
    studentCols.forEach(col => {
      let status = values[col.index] ? values[col.index].toLowerCase() : '';
      const isPresent = status.includes('presen') || status === 'p' || status === 'si' || status.includes('atras');
      rowObj[col.name] = isPresent ? 'Presente' : 'Ausente';
    });
    return rowObj;
  });

  return { rawData: parsedData, studentList: studentCols.map(c => c.name) };
};

export default function App() {
  const [data, setData] = useState({ rawData: [], studentList: [] });
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [aiInsight, setAiInsight] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showAiPanel, setShowAiPanel] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showCopyMessage, setShowCopyMessage] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${YOUR_SHEET_CSV_URL}&t=${new Date().getTime()}`); 
      const csvText = await response.text();
      setData(parseCSV(csvText));
      setLastUpdated(new Date().toLocaleTimeString());
    } catch (err) {
      console.error("Error al obtener datos:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(e => {
        console.error(`Error al intentar modo pantalla completa: ${e.message}`);
      });
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
        setIsFullscreen(false);
      }
    }
  };

  const shareDashboard = () => {
    const url = window.location.href;
    const el = document.createElement('textarea');
    el.value = url;
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
    
    setShowCopyMessage(true);
    setTimeout(() => setShowCopyMessage(false), 3000);
  };

  // Cálculos de estadísticas
  const { matrix, dates, stats, sessionStats, globalAverage } = useMemo(() => {
    if (!data.rawData.length) return { matrix: {}, dates: [], stats: [], sessionStats: [], globalAverage: 0 };

    const matrixMap = {}; 
    const studentStats = {}; 
    const datesSet = new Set();
    const sessionData = {};

    data.studentList.forEach(name => { studentStats[name] = { p: 0, a: 0, total: 0 }; });

    data.rawData.forEach(row => {
      const fechaCorta = row.fecha.includes(' ') ? row.fecha.split(' ')[0] : row.fecha;
      datesSet.add(fechaCorta);
      if (!matrixMap[fechaCorta]) matrixMap[fechaCorta] = {};
      if (!sessionData[fechaCorta]) sessionData[fechaCorta] = { p: 0, total: 0 };

      data.studentList.forEach(name => {
        const status = row[name];
        matrixMap[fechaCorta][name] = status;
        studentStats[name].total++;
        sessionData[fechaCorta].total++;
        if (status === 'Presente') {
          studentStats[name].p++;
          sessionData[fechaCorta].p++;
        } else {
          studentStats[name].a++;
        }
      });
    });

    const datesList = Array.from(datesSet).sort((a, b) => {
        const pA = a.split('/'); const pB = b.split('/');
        return pA.length === 3 ? new Date(pB[2], pB[1]-1, pB[0]) - new Date(pA[2], pA[1]-1, pA[0]) : b.localeCompare(a);
    });

    const finalStats = data.studentList.map(name => {
      const s = studentStats[name];
      const perc = s.total > 0 ? ((s.p / s.total) * 100).toFixed(1) : 0;
      return { nombre: name, ...s, porcentaje: parseFloat(perc) };
    }).sort((a, b) => b.porcentaje - a.porcentaje);

    const finalSessionStats = datesList.map(date => {
      const s = sessionData[date];
      const perc = s.total > 0 ? ((s.p / s.total) * 100).toFixed(1) : 0;
      return { fecha: date, porcentaje: parseFloat(perc), presentes: s.p, total: s.total };
    });

    const totalP = finalSessionStats.reduce((acc, curr) => acc + curr.presentes, 0);
    const totalT = finalSessionStats.reduce((acc, curr) => acc + curr.total, 0);
    const avg = totalT > 0 ? ((totalP / totalT) * 100).toFixed(1) : 0;

    return { matrix: matrixMap, dates: datesList, stats: finalStats, sessionStats: finalSessionStats, globalAverage: avg };
  }, [data]);

  const getGeminiInsights = async (mode = 'analyze') => {
    setIsAnalyzing(true); setAiInsight(''); setShowAiPanel(true);
    const context = `Promedio Global: ${globalAverage}%. Alumnos: ${stats.map(s => `${s.nombre}(${s.porcentaje}%)`).join(', ')}`;
    let prompt = mode === 'analyze' 
      ? `Analiza la asistencia: ${context}. Resume riesgos y sugiere 3 acciones. Sé breve y profesional en español.`
      : `Reporte formal: Asistencia promedio ${globalAverage}%. Resumen de sesiones y alumnos críticos. Español.`;

    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
      });
      const result = await response.json();
      setAiInsight(result.candidates?.[0]?.content?.parts?.[0]?.text || "No se pudo obtener el análisis en este momento.");
    } catch (err) { setAiInsight("Error de conexión con la IA."); } finally { setIsAnalyzing(false); }
  };

  if (loading && !data.rawData.length) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50">
        <RefreshCw className="animate-spin text-emerald-600 mb-4" size={40} />
        <p className="text-slate-600 font-medium">Sincronizando registros en tiempo real...</p>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${isFullscreen ? 'bg-white p-4' : 'bg-slate-50 p-4 md:p-8'} font-sans text-slate-900 pb-24 transition-all duration-300`}>
      {showCopyMessage && (
        <div className="fixed top-4 right-4 bg-slate-900 text-white px-6 py-3 rounded-2xl shadow-2xl z-[100] flex items-center gap-2 animate-in fade-in slide-in-from-top-4">
          <Copy size={16} className="text-emerald-400" />
          <span className="text-sm font-bold">Enlace de acceso copiado</span>
        </div>
      )}

      <header className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black flex items-center gap-2">
            <div className="bg-emerald-600 p-1.5 rounded-lg text-white"><Calendar size={20} /></div>
            Monitor de Asistencia
          </h1>
          <p className="text-slate-500 text-sm mt-1">Sincronizado: {lastUpdated || '--:--'}</p>
        </div>
        <div className="flex flex-wrap gap-2 w-full md:w-auto">
          <button onClick={fetchData} className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-white border border-slate-200 px-4 py-2 rounded-xl text-sm font-bold shadow-sm hover:bg-slate-50 active:scale-95 transition-all">
            <RefreshCw size={16} /> <span className="hidden sm:inline">Recargar</span>
          </button>
          <button onClick={shareDashboard} className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-white border border-slate-200 px-4 py-2 rounded-xl text-sm font-bold shadow-sm hover:bg-slate-50 active:scale-95 transition-all">
            <Share2 size={16} /> <span className="hidden sm:inline">Compartir</span>
          </button>
          <button onClick={toggleFullscreen} className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-slate-800 text-white border border-slate-800 px-4 py-2 rounded-xl text-sm font-bold shadow-sm hover:bg-slate-700 active:scale-95 transition-all">
            {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            <span className="hidden sm:inline">{isFullscreen ? 'Esc' : 'Presentar'}</span>
          </button>
          <button onClick={() => getGeminiInsights('analyze')} className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-md hover:bg-emerald-700 active:scale-95 transition-all">
            <Sparkles size={16} /> ✨ IA
          </button>
        </div>
      </header>

      {/* Resumen de KPI */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4 hover:shadow-md transition-shadow">
          <div className="bg-blue-100 p-3 rounded-2xl text-blue-600"><TrendingUp size={24} /></div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Cumplimiento Global</p>
            <h2 className="text-2xl font-black text-slate-800">{globalAverage}%</h2>
          </div>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4 hover:shadow-md transition-shadow">
          <div className="bg-emerald-100 p-3 rounded-2xl text-emerald-600"><Award size={24} /></div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Pico de Asistencia</p>
            <h2 className="text-2xl font-black text-slate-800">{sessionStats.length ? Math.max(...sessionStats.map(s=>s.porcentaje)) : 0}%</h2>
          </div>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4 hover:shadow-md transition-shadow">
          <div className="bg-red-100 p-3 rounded-2xl text-red-600"><AlertTriangle size={24} /></div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-wrap leading-tight">Alerta de Riesgo</p>
            <h2 className="text-2xl font-black text-slate-800">{stats.filter(s => s.porcentaje < 50).length} alumnos</h2>
          </div>
        </div>
      </div>

      {/* Panel de IA */}
      {showAiPanel && (
        <div className="mb-8 bg-slate-900 rounded-3xl p-6 text-white shadow-2xl relative overflow-hidden border border-indigo-500/30">
          <div className="flex justify-between items-start mb-4 relative z-10">
            <div className="flex items-center gap-2 bg-indigo-500/20 px-3 py-1 rounded-full border border-indigo-400/30">
              <Sparkles size={14} className="text-indigo-300" /><span className="text-[10px] font-black uppercase tracking-widest">Gemini Insights</span>
            </div>
            <button onClick={() => setShowAiPanel(false)} className="p-1 hover:bg-white/10 rounded-lg"><XCircle size={20} className="text-slate-400" /></button>
          </div>
          <div className="relative z-10">
            {isAnalyzing ? (
              <div className="py-4 flex items-center gap-3 animate-pulse text-indigo-200 text-sm">
                <BrainCircuit className="animate-spin" size={18} /> Procesando datos de asistencia...
              </div>
            ) : (
              <div className="prose prose-invert max-w-none text-sm text-slate-200 whitespace-pre-wrap leading-relaxed">
                {aiInsight}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Grid Principal */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 items-start">
        <div className="xl:col-span-2 space-y-8">
          {/* Gráfico de Sesiones */}
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-50">
              <h3 className="font-black text-slate-800 flex items-center gap-2 uppercase text-[10px] tracking-widest">
                <BarChart3 size={16} className="text-blue-500" /> Evolución de Sesiones
              </h3>
            </div>
            <div className="p-6 space-y-4 max-h-[400px] overflow-y-auto custom-scrollbar">
              {sessionStats.map((s, i) => (
                <div key={i} className="group">
                  <div className="flex justify-between text-[10px] mb-1 font-bold text-slate-500">
                    <span>{s.fecha} ({s.presentes}/{s.total})</span>
                    <span>{s.porcentaje}%</span>
                  </div>
                  <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden flex">
                    <div 
                      className={`h-full transition-all duration-1000 ${s.porcentaje > 80 ? 'bg-emerald-500' : s.porcentaje > 60 ? 'bg-amber-500' : 'bg-red-500'}`} 
                      style={{ width: `${s.porcentaje}%` }} 
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Ranking Estudiantes */}
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-50 bg-slate-900 text-white flex justify-between items-center">
              <h3 className="font-black uppercase text-xs tracking-widest">Ranking Estudiantil</h3>
              <Users size={18} className="text-emerald-400" />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  <tr>
                    <th className="p-5">Alumno</th>
                    <th className="p-5 text-center">P</th>
                    <th className="p-5 text-center">A</th>
                    <th className="p-5">Cumplimiento</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {stats.map((s, i) => (
                    <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                      <td className="p-5 font-bold text-slate-700">{s.nombre}</td>
                      <td className="p-5 text-center font-mono text-emerald-600 font-bold">{s.p}</td>
                      <td className="p-5 text-center font-mono text-red-500 font-bold">{s.a}</td>
                      <td className="p-5">
                        <div className="flex items-center gap-3">
                          <div className="flex-1 bg-slate-100 h-1.5 rounded-full overflow-hidden max-w-[100px]">
                            <div className={`h-full ${s.porcentaje >= 85 ? 'bg-emerald-500' : s.porcentaje >= 50 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${s.porcentaje}%` }} />
                          </div>
                          <span className="text-[10px] font-black w-8">{s.porcentaje}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Registro Detallado Lateral */}
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden h-full flex flex-col">
          <div className="p-6 border-b border-slate-50 flex justify-between items-center bg-white sticky top-0 z-20">
            <h3 className="font-black text-slate-800 flex items-center gap-2 uppercase text-[10px] tracking-widest"><Clock size={16} className="text-indigo-500" /> Bitácora de Registro</h3>
          </div>
          <div className="overflow-x-auto flex-1 max-h-[700px] xl:max-h-none custom-scrollbar">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-[10px] font-black text-slate-400 border-b border-slate-100">
                  <th className="p-4 sticky left-0 bg-slate-50 z-10">FECHA</th>
                  {data.studentList.map(n => <th key={n} className="p-4 text-center min-w-[80px]">{n.split(' ')[0]}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-[11px]">
                {dates.map(date => (
                  <tr key={date} className="hover:bg-slate-50 transition-colors">
                    <td className="p-4 font-bold text-slate-700 sticky left-0 bg-white z-10 border-r border-slate-50">{date}</td>
                    {data.studentList.map(n => (
                      <td key={n} className="p-4 text-center border-r border-slate-50/50">
                        {matrix[date]?.[n] === 'Presente' ? <CheckCircle2 size={14} className="text-emerald-500 mx-auto" /> : <XCircle size={14} className="text-red-300 mx-auto" />}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
