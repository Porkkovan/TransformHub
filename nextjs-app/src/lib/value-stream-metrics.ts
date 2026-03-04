export interface ProductMetrics {
  productName: string;
  leadTime: number;
  manualEffort: number;
  automatedEffort: number;
  manualPercentage: number;
  stepCount: number;
  bottleneck: string;
  bottleneckDuration: number;
}

export interface ImprovementMetrics {
  productName: string;
  currentLeadTime: number;
  futureLeadTime: number;
  leadTimeReduction: number;
  currentManualPercent: number;
  futureManualPercent: number;
  automationGain: number;
  currentBottleneck: string;
  futureBottleneck: string;
}

interface StreamStep {
  name: string;
  type: string;
  duration: number;
}

export function computeProductMetrics(
  steps: StreamStep[],
  productName: string
): ProductMetrics {
  const leadTime = steps.reduce((sum, s) => sum + s.duration, 0);
  const manualEffort = steps
    .filter((s) => s.type === "manual")
    .reduce((sum, s) => sum + s.duration, 0);
  const automatedEffort = leadTime - manualEffort;
  const manualPercentage = leadTime > 0 ? (manualEffort / leadTime) * 100 : 0;

  let bottleneck = "N/A";
  let bottleneckDuration = 0;
  for (const step of steps) {
    if (step.duration > bottleneckDuration) {
      bottleneckDuration = step.duration;
      bottleneck = step.name;
    }
  }

  return {
    productName,
    leadTime,
    manualEffort,
    automatedEffort,
    manualPercentage,
    stepCount: steps.length,
    bottleneck,
    bottleneckDuration,
  };
}

export function computeImprovementMetrics(
  currentSteps: StreamStep[],
  futureSteps: StreamStep[],
  productName: string
): ImprovementMetrics {
  const current = computeProductMetrics(currentSteps, productName);
  const future = computeProductMetrics(futureSteps, productName);

  const leadTimeReduction =
    current.leadTime > 0
      ? ((current.leadTime - future.leadTime) / current.leadTime) * 100
      : 0;

  const automationGain = current.manualPercentage - future.manualPercentage;

  return {
    productName,
    currentLeadTime: current.leadTime,
    futureLeadTime: future.leadTime,
    leadTimeReduction,
    currentManualPercent: current.manualPercentage,
    futureManualPercent: future.manualPercentage,
    automationGain,
    currentBottleneck: current.bottleneck,
    futureBottleneck: future.bottleneck,
  };
}
