import React, { useState, useEffect, useCallback } from 'react';
import { Loan, SimulationResult } from './types';
import * as Simulation from './utils/simulation';
import { Activity, AlertTriangle, BarChart3, Play, RefreshCw, ShieldAlert, TrendingUp } from 'lucide-react';

const NUM_LOANS = 1000;
const ITERATIONS = 10000;
const RHO = 0.2; // Systemic correlation

const formatCurrency = (val: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  }).format(val);
};

export default function App() {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [isModelTrained, setIsModelTrained] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [baselineResult, setBaselineResult] = useState<SimulationResult | null>(null);
  const [stressedResult, setStressedResult] = useState<SimulationResult | null>(null);

  // Initialize Data and Model
  useEffect(() => {
    // 1. Generate Data
    const rawLoans = Simulation.generateMockLoans(NUM_LOANS);
    
    // 2. Train Model (Simulated Logistic Regression)
    const trainedLoans = Simulation.trainPDModel(rawLoans);
    
    setLoans(trainedLoans);
    setIsModelTrained(true);
  }, []);

  const runSimulations = useCallback(async () => {
    if (!loans.length) return;
    setIsSimulating(true);

    // Use setTimeout to allow UI to update before heavy calculation blocks main thread
    setTimeout(() => {
      // Scenario 1: Baseline (Stress Factor = 1.0)
      const resBase = Simulation.runVasicekSimulation(
        loans, 
        ITERATIONS, 
        RHO, 
        1.0, 
        "Baseline Scenario"
      );
      setBaselineResult(resBase);

      // Scenario 2: Severe Downturn (Stress Factor = 2.5)
      const resStress = Simulation.runVasicekSimulation(
        loans, 
        ITERATIONS, 
        RHO, 
        2.5, 
        "Severe Downturn"
      );
      setStressedResult(resStress);

      setIsSimulating(false);
    }, 100);
  }, [loans]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-6 md:p-12 font-sans">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-6">
          <div>
            <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
              <Activity className="text-indigo-600 w-8 h-8" />
              Affirm Risk Simulator
            </h1>
            <p className="text-slate-500 mt-2 max-w-2xl">
              Dynamic Portfolio Risk Engine using Vasicek ASRF Model & Monte Carlo Simulation.
            </p>
          </div>
          <div className="flex items-center gap-4">
             <div className="px-4 py-2 bg-white rounded-lg border border-slate-200 shadow-sm text-sm">
                <span className="text-slate-500 block text-xs uppercase tracking-wider font-semibold">Portfolio Size</span>
                <span className="font-bold text-slate-800">{NUM_LOANS.toLocaleString()} Loans</span>
             </div>
             <div className="px-4 py-2 bg-white rounded-lg border border-slate-200 shadow-sm text-sm">
                <span className="text-slate-500 block text-xs uppercase tracking-wider font-semibold">Iterations</span>
                <span className="font-bold text-slate-800">{ITERATIONS.toLocaleString()}</span>
             </div>
          </div>
        </header>

        {/* Controls */}
        <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-emerald-600" />
              Model Status
            </h2>
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${isModelTrained ? 'bg-emerald-500' : 'bg-slate-300'}`}></span>
              <p className="text-sm text-slate-600">
                {isModelTrained 
                  ? "Logistic Regression Trained (PD Coefficients Optimized)" 
                  : "Initializing Data & Model..."}
              </p>
            </div>
          </div>

          <button
            onClick={runSimulations}
            disabled={!isModelTrained || isSimulating}
            className={`flex items-center gap-2 px-6 py-3 rounded-lg font-semibold shadow-md transition-all
              ${!isModelTrained || isSimulating 
                ? 'bg-slate-100 text-slate-400 cursor-not-allowed' 
                : 'bg-indigo-600 hover:bg-indigo-700 text-white hover:shadow-lg active:scale-95'}`}
          >
            {isSimulating ? (
              <>
                <RefreshCw className="w-5 h-5 animate-spin" />
                Running Monte Carlo...
              </>
            ) : (
              <>
                <Play className="w-5 h-5" />
                Run Risk Simulation
              </>
            )}
          </button>
        </section>

        {/* Results Dashboard */}
        {baselineResult && stressedResult && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            
            {/* Baseline Card */}
            <ResultCard 
              result={baselineResult} 
              type="baseline"
              icon={<ShieldAlert className="w-6 h-6 text-blue-600" />}
              description="Normal economic conditions (Stress Factor = 1.0)"
            />

            {/* Stressed Card */}
            <ResultCard 
              result={stressedResult} 
              type="stressed"
              icon={<AlertTriangle className="w-6 h-6 text-amber-600" />}
              description="Severe economic downturn (Stress Factor = 2.5)"
            />

          </div>
        )}

        {/* Empty State */}
        {!baselineResult && !isSimulating && (
          <div className="text-center py-20 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200">
            <BarChart3 className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-xl font-medium text-slate-400">Ready to simulate</h3>
            <p className="text-slate-400 mt-2">Click "Run Risk Simulation" to execute the Vasicek model.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function ResultCard({ result, type, icon, description }: { 
  result: SimulationResult; 
  type: 'baseline' | 'stressed';
  icon: React.ReactNode;
  description: string;
}) {
  const isStressed = type === 'stressed';
  const headerColor = isStressed ? 'bg-amber-50 border-amber-100' : 'bg-blue-50 border-blue-100';
  const textColor = isStressed ? 'text-amber-900' : 'text-blue-900';
  
  // Simple histogram generation
  const bins = 20;
  const min = Math.min(...result.losses);
  const max = Math.max(...result.losses);
  const step = (max - min) / bins;
  const histogram = new Array(bins).fill(0);
  result.losses.forEach(l => {
    const binIdx = Math.min(Math.floor((l - min) / step), bins - 1);
    histogram[binIdx]++;
  });
  const maxCount = Math.max(...histogram);

  return (
    <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-slate-200">
      <div className={`p-6 border-b ${headerColor}`}>
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              {icon}
              <h3 className={`text-xl font-bold ${textColor}`}>{result.scenarioName}</h3>
            </div>
            <p className="text-sm text-slate-600">{description}</p>
          </div>
          <span className="text-xs font-mono text-slate-400 bg-white px-2 py-1 rounded border">
            {result.processingTime.toFixed(0)}ms
          </span>
        </div>
      </div>

      <div className="p-6 space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 bg-slate-50 rounded-lg border border-slate-100">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Mean Expected Loss</p>
            <p className="text-2xl font-bold text-slate-800">{formatCurrency(result.meanEL)}</p>
          </div>
          <div className="p-4 bg-slate-50 rounded-lg border border-slate-100">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">VaR (99%)</p>
            <p className={`text-2xl font-bold ${isStressed ? 'text-red-600' : 'text-slate-800'}`}>
              {formatCurrency(result.var99)}
            </p>
          </div>
        </div>

        {/* Histogram Visualization */}
        <div className="mt-4">
          <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Loss Distribution (Monte Carlo)</h4>
          <div className="flex items-end gap-1 h-32 w-full pt-4 pb-2 border-b border-l border-slate-200">
            {histogram.map((count, i) => (
              <div 
                key={i} 
                className={`flex-1 rounded-t-sm transition-all hover:opacity-80 ${isStressed ? 'bg-amber-400' : 'bg-blue-400'}`}
                style={{ height: `${(count / maxCount) * 100}%` }}
                title={`Bin ${i+1}: ${count} simulations`}
              />
            ))}
          </div>
          <div className="flex justify-between text-xs text-slate-400 mt-2 font-mono">
             <span>{formatCurrency(min)}</span>
             <span>{formatCurrency(max)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
