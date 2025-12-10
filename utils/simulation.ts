import { Loan, SimulationResult } from '../types';
import { normCDF, normInv } from './statistics';

/**
 * Generates mock loan portfolio data.
 * Creates a dependency between prior late payments and default status
 * to allow the logistic regression model to learn a pattern.
 */
export const generateMockLoans = (count: number): Loan[] => {
  const loans: Loan[] = [];
  for (let i = 0; i < count; i++) {
    // EAD between $500 and $5000
    const EAD = 500 + Math.random() * 4500;
    const LGD = 0.6; // Fixed Loss Given Default
    // Prior late payments 0-5
    const prior_late_payments = Math.floor(Math.random() * 6);
    
    // Simulate actual default status for training
    // Higher late payments -> Higher probability of default
    // Using a latent variable approach: y* = beta*x + epsilon
    const latent_risk = -3 + (0.8 * prior_late_payments) + (Math.random() * 1.5);
    const defaulted = latent_risk > 0;

    loans.push({
      id: i,
      EAD,
      LGD,
      prior_late_payments,
      pd_base: 0.0, // To be filled by model
      defaulted
    });
  }
  return loans;
};

/**
 * Trains a simple Logistic Regression model using Gradient Descent.
 * Predicts Probability of Default (PD) based on prior_late_payments.
 */
export const trainPDModel = (loans: Loan[]): Loan[] => {
  // Initialize weights
  let intercept = -1.0; 
  let beta = 0.5;
  const learningRate = 0.01;
  const epochs = 500;

  // Gradient Descent
  for (let iter = 0; iter < epochs; iter++) {
    let dIntercept = 0;
    let dBeta = 0;

    for (const loan of loans) {
      const x = loan.prior_late_payments;
      const y = loan.defaulted ? 1 : 0;
      const z = intercept + (beta * x);
      const prediction = 1 / (1 + Math.exp(-z));
      
      const error = prediction - y;
      dIntercept += error;
      dBeta += error * x;
    }

    intercept -= (learningRate * dIntercept) / loans.length;
    beta -= (learningRate * dBeta) / loans.length;
  }

  // Apply model to calculate PD_Base for all loans
  return loans.map(loan => {
    const z = intercept + (beta * loan.prior_late_payments);
    const pd = 1 / (1 + Math.exp(-z));
    return { ...loan, pd_base: pd };
  });
};

/**
 * Core Monte Carlo Simulation using Vasicek Asymptotic Single Risk Factor Model.
 */
export const runVasicekSimulation = (
  loans: Loan[],
  iterations: number,
  rho: number,
  stressFactor: number,
  scenarioName: string
): SimulationResult => {
  const start = performance.now();
  const losses: number[] = [];

  // Pre-calculate constants and loan parameters to optimize loop
  const sqrtRho = Math.sqrt(rho);
  const sqrtStress = Math.sqrt(stressFactor);
  const denominator = Math.sqrt(1 - rho);
  
  // Pre-compute exposure and probit(PD) for each loan
  const loanParams = loans.map(l => ({
    exposure: l.EAD * l.LGD,
    probitPd: normInv(l.pd_base)
  }));

  for (let i = 0; i < iterations; i++) {
    // Generate Systematic Risk Factor Z ~ N(0, 1)
    // Using Box-Muller transform
    let u1 = Math.random();
    if (u1 === 0) u1 = 1e-9; // Avoid log(0)
    const u2 = Math.random();
    const Z = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);

    // Apply Stress Factor scaling to the systematic component
    const systematicComponent = sqrtRho * sqrtStress * Z;
    
    let iterationLoss = 0;

    // Calculate loss for this economic scenario
    for (let j = 0; j < loanParams.length; j++) {
      const lp = loanParams[j];
      
      // Vasicek Formula for Stressed PD
      // PD_Stressed = Phi( (Phi^-1(PD_Base) + sqrt(rho)*sqrt(SF)*Z) / sqrt(1-rho) )
      const score = (lp.probitPd + systematicComponent) / denominator;
      const pdStressed = normCDF(score);
      
      // Expected Loss for this specific scenario
      iterationLoss += lp.exposure * pdStressed;
    }
    losses.push(iterationLoss);
  }

  // Calculate Metrics
  losses.sort((a, b) => a - b);
  const totalLoss = losses.reduce((sum, l) => sum + l, 0);
  const meanEL = totalLoss / iterations;
  
  // VaR 99%: The loss value at the 99th percentile
  const varIndex = Math.floor(iterations * 0.99);
  const var99 = losses[varIndex];

  return {
    scenarioName,
    stressFactor,
    meanEL,
    var99,
    losses,
    processingTime: performance.now() - start
  };
};
