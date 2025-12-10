export interface Loan {
  id: number;
  EAD: number;
  LGD: number;
  prior_late_payments: number;
  pd_base: number;
  defaulted: boolean; // Initial mock status
}

export interface SimulationResult {
  scenarioName: string;
  stressFactor: number;
  meanEL: number;
  var99: number;
  losses: number[];
  processingTime: number;
}

export interface SimulationConfig {
  numLoans: number;
  iterations: number;
  rho: number;
}

export interface ChartDataPoint {
  bin: number;
  baselineFrequency: number;
  stressedFrequency: number;
}
