import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import { createHash } from "crypto";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

function sha256(data: string): string {
  return createHash("sha256").update(data).digest("hex");
}

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════

interface FuncDef { name: string; description: string; sourceFiles: string[] }
interface CapDef { name: string; description: string; category: string; functionalities: FuncDef[] }
interface VsmDef { processTime: number; leadTime: number; waitTime: number; flowEfficiency: number; mermaidSource: string }
interface ProductDef {
  name: string; description: string; currentState: string; futureState: string;
  businessSegment: string;
  capabilities: CapDef[];
  group: { name: string; description: string };
  steps: { name: string; stepOrder: number; stepType: string }[];
  vsm: VsmDef;
}
interface RiskData { productIndex: number; riskCategory: string; riskScore: number; severity: string; description: string; mitigationPlan: string; transitionBlocked: boolean }
interface ComplianceData { productIndex: number; framework: string; requirement: string; description: string; status: string; evidenceLinks: string[] }
interface ProductReadinessData { readinessScore: number; factors: { name: string; score: number }[]; migrationSteps: { phase: string; description: string; status: string; estimatedDuration: string }[]; gateApproved: boolean; blockers: string[] }
interface FutureStateData { automationMix: { productName: string; rpa: number; aiMl: number; agentBased: number; conversational: number; analytics: number }[]; currentSteps: { name: string; type: string; duration: number }[]; futureSteps: { name: string; type: string; duration: number }[]; capabilities: { name: string; category: string; businessImpact: string; complexity: string; techStack: string[]; description: string; reach: number; impact: number; confidence: number; effort: number; riceScore: number }[]; productStreams?: Record<string, { currentSteps: { name: string; type: string; duration: number }[]; futureSteps: { name: string; type: string; duration: number }[] }> }
interface ArchitectureData { current_architecture: string; target_architecture: string; migration_plan: string; architecture_diagrams: { functional: string; technical: string; solution: string; products?: Record<string, { solution: string; technical: string; sequence: string }> } }

interface OrgSeedData {
  org: { name: string; slug: string; industryType: string; description: string; competitors: string[]; businessSegments: string[]; regulatoryFrameworks: string[]; personas: { type: string; name: string; responsibilities: string[] }[] };
  repo: { name: string; url: string; description: string; language: string };
  products: ProductDef[];
  risks: RiskData[];
  compliance: ComplianceData[];
  productReadiness: ProductReadinessData[];
  futureState: FutureStateData;
  architecture: ArchitectureData;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Seed function for a single organization
// ═══════════════════════════════════════════════════════════════════════════════

async function seedOrganization(data: OrgSeedData) {
  const org = await prisma.organization.create({
    data: {
      name: data.org.name,
      slug: data.org.slug,
      industryType: data.org.industryType,
      description: data.org.description,
      competitors: data.org.competitors,
      businessSegments: data.org.businessSegments,
      regulatoryFrameworks: data.org.regulatoryFrameworks,
      personas: data.org.personas,
    },
  });

  const repo = await prisma.repository.create({
    data: {
      name: data.repo.name,
      url: data.repo.url,
      description: data.repo.description,
      language: data.repo.language,
      organizationId: org.id,
    },
  });

  const productIds: string[] = [];
  const productNames: string[] = [];
  const firstCapabilityIds: string[] = [];
  // Track all capability and functionality IDs per product for roadmap seeding
  const capabilityIdsByProduct: string[][] = [];
  const capabilityNamesByProduct: string[][] = [];
  const functionalityIdsByCapability: Map<string, string[]> = new Map();
  const functionalityNamesByCapability: Map<string, string[]> = new Map();
  let totalCaps = 0;
  let totalFuncs = 0;

  for (const product of data.products) {
    // a. Create DigitalProduct (with repositoryId + businessSegment)
    const prod = await prisma.digitalProduct.create({
      data: {
        name: product.name,
        description: product.description,
        currentState: product.currentState,
        futureState: product.futureState,
        businessSegment: product.businessSegment,
        repositoryId: repo.id,
      },
    });
    productIds.push(prod.id);
    productNames.push(prod.name);

    // b. Create ProductGroup (with digitalProductId)
    const group = await prisma.productGroup.create({
      data: {
        name: product.group.name,
        description: product.group.description,
        digitalProductId: prod.id,
      },
    });

    // c. Create ValueStreamSteps (with productGroupId)
    await prisma.valueStreamStep.createMany({
      data: product.steps.map((s) => ({
        name: s.name,
        stepOrder: s.stepOrder,
        stepType: s.stepType,
        productGroupId: group.id,
      })),
    });

    // e. For each capability → create DigitalCapability, then Functionalities + PersonaMappings
    let personaIdx = 0;
    let firstCapId: string | null = null;
    const productCapIds: string[] = [];
    const productCapNames: string[] = [];

    for (const cap of product.capabilities) {
      const capability = await prisma.digitalCapability.create({
        data: {
          name: cap.name,
          description: cap.description,
          category: cap.category,
          digitalProductId: prod.id,
        },
      });
      totalCaps++;
      if (!firstCapId) firstCapId = capability.id;
      productCapIds.push(capability.id);
      productCapNames.push(capability.name);

      const capFuncIds: string[] = [];
      const capFuncNames: string[] = [];

      for (const func of cap.functionalities) {
        const functionality = await prisma.functionality.create({
          data: {
            name: func.name,
            description: func.description,
            sourceFiles: func.sourceFiles,
            digitalCapabilityId: capability.id,
          },
        });
        totalFuncs++;
        capFuncIds.push(functionality.id);
        capFuncNames.push(functionality.name);

        // Cycle through org personas for PersonaMapping
        const persona = data.org.personas[personaIdx % data.org.personas.length];
        await prisma.personaMapping.create({
          data: {
            personaType: persona.type,
            personaName: persona.name,
            responsibilities: persona.responsibilities,
            functionalityId: functionality.id,
          },
        });
        personaIdx++;
      }

      functionalityIdsByCapability.set(capability.id, capFuncIds);
      functionalityNamesByCapability.set(capability.id, capFuncNames);
    }

    capabilityIdsByProduct.push(productCapIds);
    capabilityNamesByProduct.push(productCapNames);

    // f. Create VsmMetrics linked to the first capability of the product
    if (firstCapId) {
      await prisma.vsmMetrics.create({
        data: {
          processTime: product.vsm.processTime,
          leadTime: product.vsm.leadTime,
          waitTime: product.vsm.waitTime,
          flowEfficiency: product.vsm.flowEfficiency,
          mermaidSource: product.vsm.mermaidSource,
          digitalCapabilityId: firstCapId,
        },
      });
    }

    firstCapabilityIds.push(firstCapId!);
  }

  // ─── Risk Assessments ───────────────────────────────────────────────
  for (const risk of data.risks) {
    await prisma.riskAssessment.create({
      data: {
        entityType: "DigitalCapability",
        entityId: firstCapabilityIds[risk.productIndex],
        riskCategory: risk.riskCategory,
        riskScore: risk.riskScore,
        severity: risk.severity,
        description: risk.description,
        mitigationPlan: risk.mitigationPlan,
        transitionBlocked: risk.transitionBlocked,
      },
    });
  }

  // ─── Compliance Mappings ────────────────────────────────────────────
  for (const comp of data.compliance) {
    await prisma.complianceMapping.create({
      data: {
        framework: comp.framework,
        requirement: comp.requirement,
        description: comp.description,
        entityType: "DigitalCapability",
        entityId: firstCapabilityIds[comp.productIndex],
        status: comp.status,
        evidenceLinks: comp.evidenceLinks,
      },
    });
  }

  // ─── Agent Executions ───────────────────────────────────────────────
  const now = Date.now();

  // 1. discovery
  await prisma.agentExecution.create({
    data: {
      agentType: "discovery",
      status: "COMPLETED",
      repositoryId: repo.id,
      organizationId: org.id,
      input: { repositoryUrl: repo.url, analysisDepth: "full" },
      output: { functionalitiesFound: totalFuncs, capabilitiesMapped: totalCaps, personasIdentified: data.org.personas.length },
      startedAt: new Date(now - 600000),
      completedAt: new Date(now - 540000),
    },
  });

  // 2. lean_vsm
  const totalSteps = data.products.reduce((sum, p) => sum + p.steps.length, 0);
  await prisma.agentExecution.create({
    data: {
      agentType: "lean_vsm",
      status: "COMPLETED",
      repositoryId: repo.id,
      organizationId: org.id,
      input: { repositoryUrl: repo.url, scope: "full_value_stream" },
      output: { valueStreamsAnalyzed: data.products.length, totalSteps, bottlenecksIdentified: data.products.length, mermaidDiagramsGenerated: data.products.length },
      startedAt: new Date(now - 500000),
      completedAt: new Date(now - 420000),
    },
  });

  // 3. risk_compliance
  await prisma.agentExecution.create({
    data: {
      agentType: "risk_compliance",
      status: "COMPLETED",
      repositoryId: repo.id,
      organizationId: org.id,
      input: { repositoryUrl: repo.url, frameworks: data.org.regulatoryFrameworks },
      output: { risksIdentified: data.risks.length, complianceMappings: data.compliance.length, criticalFindings: data.risks.filter((r) => r.severity === "CRITICAL").length, blockedTransitions: data.risks.filter((r) => r.transitionBlocked).length },
      startedAt: new Date(now - 400000),
      completedAt: new Date(now - 320000),
    },
  });

  // 4. future_state_vision
  const futureStateOutput = {
    ...data.futureState,
    automationMix: data.futureState.automationMix.map((mix, i) => ({
      ...mix,
      productName: productNames[i] ?? mix.productName,
    })),
  };
  await prisma.agentExecution.create({
    data: {
      agentType: "future_state_vision",
      status: "COMPLETED",
      repositoryId: repo.id,
      organizationId: org.id,
      input: { repositoryUrl: repo.url, scope: "transformation_vision" },
      output: futureStateOutput,
      startedAt: new Date(now - 300000),
      completedAt: new Date(now - 200000),
    },
  });

  // 5. product_transformation
  const productReadinessOutput = productIds.map((id, i) => ({
    productId: id,
    productName: productNames[i],
    ...data.productReadiness[i],
  }));
  await prisma.agentExecution.create({
    data: {
      agentType: "product_transformation",
      status: "COMPLETED",
      repositoryId: repo.id,
      organizationId: org.id,
      input: { repositoryUrl: repo.url, scope: "product_readiness_assessment" },
      output: productReadinessOutput,
      startedAt: new Date(now - 180000),
      completedAt: new Date(now - 60000),
    },
  });

  // 6. architecture
  await prisma.agentExecution.create({
    data: {
      agentType: "architecture",
      status: "COMPLETED",
      repositoryId: repo.id,
      organizationId: org.id,
      input: { repositoryUrl: repo.url, scope: "architecture_analysis" },
      output: {
        current_architecture: data.architecture.current_architecture,
        target_architecture: data.architecture.target_architecture,
        migration_plan: data.architecture.migration_plan,
        architecture_diagrams: data.architecture.architecture_diagrams,
      },
      startedAt: new Date(now - 50000),
      completedAt: new Date(now - 10000),
    },
  });

  // ─── Product Roadmap Agent Execution + Items (product-centric) ──────
  const quarters = ["Q1 2026", "Q2 2026", "Q3 2026", "Q4 2026"];
  const roadmapStatuses = ["planned", "in_progress", "completed", "planned", "deferred"];
  const approvalStatuses = ["APPROVED", "PENDING", "APPROVED", "PENDING", "REJECTED"];
  const initiatives = ["Digital Transformation", "Operational Excellence", "Customer Experience", "Risk Modernization", "Platform Migration"];

  interface RoadmapItemSeedData {
    organizationId: string;
    capabilityName: string;
    category: string;
    description: string | null;
    reach: number;
    impact: number;
    confidence: number;
    effort: number;
    riceScore: number;
    quarter: string;
    status: string;
    source: string;
    approvalStatus: string;
    reviewedBy: string | null;
    reviewNote: string | null;
    digitalProductId: string;
    digitalCapabilityId: string | null;
    functionalityId: string | null;
    itemType: string;
    initiative: string | null;
  }

  const roadmapItemsData: RoadmapItemSeedData[] = [];
  let globalIdx = 0;

  for (let pIdx = 0; pIdx < productIds.length; pIdx++) {
    const prodId = productIds[pIdx];
    const capIds = capabilityIdsByProduct[pIdx];
    const capNames = capabilityNamesByProduct[pIdx];

    // Capability-level roadmap items
    for (let cIdx = 0; cIdx < capIds.length; cIdx++) {
      const capId = capIds[cIdx];
      const capName = capNames[cIdx];
      const reach = 5 + (cIdx % 5);
      const impact = 4 + (cIdx % 6);
      const confidence = 0.5 + ((cIdx % 5) * 0.1);
      const effort = 2 + (cIdx % 4);
      const riceScore = (reach * impact * confidence) / effort;

      roadmapItemsData.push({
        organizationId: org.id,
        capabilityName: capName,
        category: data.products[pIdx].capabilities[cIdx]?.category || "General",
        description: data.products[pIdx].capabilities[cIdx]?.description || null,
        reach,
        impact,
        confidence,
        effort,
        riceScore,
        quarter: quarters[(pIdx + cIdx) % 4],
        status: roadmapStatuses[globalIdx % roadmapStatuses.length],
        source: globalIdx % 3 === 0 ? "manual" : "agent",
        approvalStatus: approvalStatuses[globalIdx % approvalStatuses.length],
        reviewedBy: approvalStatuses[globalIdx % approvalStatuses.length] !== "PENDING" ? "system" : null,
        reviewNote: approvalStatuses[globalIdx % approvalStatuses.length] === "REJECTED" ? "Needs more analysis" : null,
        digitalProductId: prodId,
        digitalCapabilityId: capId,
        functionalityId: null,
        itemType: "capability",
        initiative: initiatives[(pIdx + cIdx) % initiatives.length],
      });
      globalIdx++;

      // Functionality-level roadmap items (pick first 2 functionalities per capability)
      const funcIds = functionalityIdsByCapability.get(capId) || [];
      const funcNames = functionalityNamesByCapability.get(capId) || [];
      const funcLimit = Math.min(2, funcIds.length);

      for (let fIdx = 0; fIdx < funcLimit; fIdx++) {
        const fReach = 3 + (fIdx % 4);
        const fImpact = 3 + (fIdx % 5);
        const fConfidence = 0.6 + ((fIdx % 4) * 0.1);
        const fEffort = 1 + (fIdx % 3);
        const fRiceScore = (fReach * fImpact * fConfidence) / fEffort;

        roadmapItemsData.push({
          organizationId: org.id,
          capabilityName: funcNames[fIdx],
          category: data.products[pIdx].capabilities[cIdx]?.category || "General",
          description: data.products[pIdx].capabilities[cIdx]?.functionalities[fIdx]?.description || null,
          reach: fReach,
          impact: fImpact,
          confidence: fConfidence,
          effort: fEffort,
          riceScore: fRiceScore,
          quarter: quarters[(pIdx + cIdx + fIdx + 1) % 4],
          status: roadmapStatuses[globalIdx % roadmapStatuses.length],
          source: "agent",
          approvalStatus: approvalStatuses[globalIdx % approvalStatuses.length],
          reviewedBy: approvalStatuses[globalIdx % approvalStatuses.length] !== "PENDING" ? "system" : null,
          reviewNote: approvalStatuses[globalIdx % approvalStatuses.length] === "REJECTED" ? "Needs more analysis" : null,
          digitalProductId: prodId,
          digitalCapabilityId: capId,
          functionalityId: funcIds[fIdx],
          itemType: "functionality",
          initiative: null,
        });
        globalIdx++;
      }
    }
  }

  await prisma.roadmapItem.createMany({ data: roadmapItemsData });

  await prisma.agentExecution.create({
    data: {
      agentType: "product_roadmap",
      status: "COMPLETED",
      repositoryId: repo.id,
      organizationId: org.id,
      input: { organizationId: org.id, scope: "capability_prioritization" },
      output: { roadmapItems: roadmapItemsData.length, generatedFromFutureState: true },
      startedAt: new Date(now - 40000),
      completedAt: new Date(now - 5000),
    },
  });

  // ─── Audit Log (SHA-256 chained) ────────────────────────────────────
  const auditPayload1 = JSON.stringify({ action: "REPO_ANALYZED", repository: repo.name, functionalitiesFound: totalFuncs, capabilitiesMapped: totalCaps });
  const hash1 = sha256(auditPayload1);
  await prisma.auditLog.create({
    data: { action: "REPO_ANALYZED", entityType: "Repository", entityId: repo.id, actor: "discovery-agent", payload: JSON.parse(auditPayload1), payloadHash: hash1, previousHash: null },
  });

  const auditPayload2 = JSON.stringify({ action: "RISK_ASSESSED", risksIdentified: data.risks.length, criticalFindings: data.risks.filter((r) => r.severity === "CRITICAL").length });
  const hash2 = sha256(auditPayload2 + hash1);
  await prisma.auditLog.create({
    data: { action: "RISK_ASSESSED", entityType: "Repository", entityId: repo.id, actor: "risk-compliance-agent", payload: JSON.parse(auditPayload2), payloadHash: hash2, previousHash: hash1 },
  });

  const auditPayload3 = JSON.stringify({ action: "COMPLIANCE_MAPPED", frameworks: data.org.regulatoryFrameworks, mappingsCreated: data.compliance.length });
  const hash3 = sha256(auditPayload3 + hash2);
  await prisma.auditLog.create({
    data: { action: "COMPLIANCE_MAPPED", entityType: "Repository", entityId: repo.id, actor: "risk-compliance-agent", payload: JSON.parse(auditPayload3), payloadHash: hash3, previousHash: hash2 },
  });

  const auditPayload4 = JSON.stringify({ action: "TRANSFORMATION_PLANNED", productsAssessed: data.products.length, gatesApproved: data.productReadiness.filter((p) => p.gateApproved).length });
  const hash4 = sha256(auditPayload4 + hash3);
  await prisma.auditLog.create({
    data: { action: "TRANSFORMATION_PLANNED", entityType: "Repository", entityId: repo.id, actor: "product-transformation-agent", payload: JSON.parse(auditPayload4), payloadHash: hash4, previousHash: hash3 },
  });

  console.log(`  ✓ ${data.org.name} seeded (${totalCaps} capabilities, ${totalFuncs} functionalities)`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// Organization 1: US Bank
// ═══════════════════════════════════════════════════════════════════════════════

const US_BANK: OrgSeedData = {
  org: {
    name: "US Bank",
    slug: "us-bank",
    industryType: "Banking / Financial Services",
    description: "Major US financial institution offering retail banking, commercial lending, and wealth management services across 26 states.",
    competitors: ["JPMorgan Chase", "Wells Fargo", "PNC Financial"],
    businessSegments: ["Retail Banking", "Commercial Lending", "Wealth Management"],
    regulatoryFrameworks: ["FINRA", "SEC", "SOX", "FDIC", "BSA/AML"],
    personas: [
      { type: "FRONT_OFFICE", name: "Branch Manager", responsibilities: ["Customer relationship management", "Loan origination oversight", "Branch revenue targets"] },
      { type: "MIDDLE_OFFICE", name: "Credit Analyst", responsibilities: ["Credit risk assessment", "Portfolio monitoring", "Regulatory compliance reporting"] },
      { type: "BACK_OFFICE", name: "Payment Ops Specialist", responsibilities: ["Payment processing oversight", "Settlement reconciliation", "Fraud alert triage"] },
    ],
  },
  repo: {
    name: "usbank-core-banking",
    url: "https://github.com/usbank/core-banking",
    description: "Legacy core banking monolith handling accounts, lending, and payments",
    language: "Java",
  },
  products: [
    // ─── Product 1: LoanFlow Digital (9 capabilities) ───────────────────
    {
      name: "LoanFlow Digital",
      description: "Digital-first loan origination platform with AI-powered underwriting",
      currentState: "Paper-based application process with 5-day manual underwriting cycle",
      futureState: "Fully digital application with real-time AI credit decisioning and same-day disbursement",
      businessSegment: "Retail Banking",
      capabilities: [
        {
          name: "AI Underwriting", description: "AI-powered automated underwriting with credit scoring and income verification", category: "Lending",
          functionalities: [
            { name: "Credit Scoring Engine", description: "ML-based credit score computation using bureau data and alternative data sources", sourceFiles: ["src/main/java/com/usbank/lending/underwriting/CreditScoringEngine.java", "src/main/java/com/usbank/lending/underwriting/ScoreModel.java"] },
            { name: "Income Verification", description: "Automated income and employment verification via third-party integrations", sourceFiles: ["src/main/java/com/usbank/lending/underwriting/IncomeVerifier.java", "src/main/java/com/usbank/lending/underwriting/EmploymentCheck.java"] },
            { name: "DTI Calculator", description: "Debt-to-income ratio calculation engine with configurable thresholds", sourceFiles: ["src/main/java/com/usbank/lending/underwriting/DtiCalculator.java"] },
            { name: "Document Analysis", description: "AI-powered document extraction and validation for loan applications", sourceFiles: ["src/main/java/com/usbank/lending/underwriting/DocumentAnalyzer.java", "src/main/java/com/usbank/lending/underwriting/OcrPipeline.java"] },
          ],
        },
        {
          name: "Digital Application Portal", description: "Self-service loan application portal with guided workflows and real-time validation", category: "Lending",
          functionalities: [
            { name: "Form Builder", description: "Dynamic loan application form builder with conditional logic", sourceFiles: ["src/main/java/com/usbank/lending/portal/FormBuilder.java"] },
            { name: "Data Validation", description: "Real-time field validation and data enrichment during application entry", sourceFiles: ["src/main/java/com/usbank/lending/portal/DataValidator.java"] },
            { name: "Session Management", description: "Save and resume application sessions with encryption at rest", sourceFiles: ["src/main/java/com/usbank/lending/portal/SessionManager.java"] },
          ],
        },
        {
          name: "Loan Disbursement", description: "Automated loan funding and post-close audit processing", category: "Lending",
          functionalities: [
            { name: "Fund Transfer Engine", description: "Automated disbursement via ACH or wire with multi-approval workflows", sourceFiles: ["src/main/java/com/usbank/lending/disbursement/FundTransfer.java"] },
            { name: "Post-Close Audit", description: "Automated post-closing audit trail and document archival", sourceFiles: ["src/main/java/com/usbank/lending/disbursement/PostCloseAudit.java"] },
            { name: "Escrow Management", description: "Escrow account setup and initial funding management", sourceFiles: ["src/main/java/com/usbank/lending/disbursement/EscrowManager.java"] },
          ],
        },
        {
          name: "Customer Onboarding", description: "Digital customer onboarding with identity verification and KYC processing", category: "Lending",
          functionalities: [
            { name: "Identity Verification", description: "Multi-factor identity verification using document scan and biometric matching", sourceFiles: ["src/main/java/com/usbank/lending/onboarding/IdentityVerifier.java"] },
            { name: "KYC Processing", description: "Know Your Customer checks against sanctions lists and PEP databases", sourceFiles: ["src/main/java/com/usbank/lending/onboarding/KycProcessor.java"] },
            { name: "Account Opening", description: "Automated account creation and initial setup post-approval", sourceFiles: ["src/main/java/com/usbank/lending/onboarding/AccountOpener.java"] },
          ],
        },
        {
          name: "Credit Risk Analytics", description: "Portfolio-level credit risk modeling and stress testing", category: "Risk Management",
          functionalities: [
            { name: "Portfolio Risk Models", description: "Statistical models for portfolio credit risk assessment and concentration analysis", sourceFiles: ["src/main/java/com/usbank/lending/risk/PortfolioRiskModel.java"] },
            { name: "Loss Forecasting", description: "Expected and unexpected loss forecasting using Monte Carlo simulation", sourceFiles: ["src/main/java/com/usbank/lending/risk/LossForecaster.java"] },
            { name: "Stress Testing", description: "Regulatory stress testing scenarios for CCAR and DFAST compliance", sourceFiles: ["src/main/java/com/usbank/lending/risk/StressTester.java"] },
          ],
        },
        {
          name: "Document Management", description: "Enterprise document management with OCR and intelligent classification", category: "Operations",
          functionalities: [
            { name: "OCR Processing", description: "Optical character recognition for scanned loan documents", sourceFiles: ["src/main/java/com/usbank/lending/docs/OcrProcessor.java"] },
            { name: "Document Classification", description: "ML-based document type classification and metadata extraction", sourceFiles: ["src/main/java/com/usbank/lending/docs/DocClassifier.java"] },
            { name: "Archival System", description: "Compliant document archival with retention policy enforcement", sourceFiles: ["src/main/java/com/usbank/lending/docs/ArchivalSystem.java"] },
          ],
        },
        {
          name: "Compliance Engine", description: "Automated BSA/AML screening and regulatory reporting for lending", category: "Compliance",
          functionalities: [
            { name: "BSA/AML Screening", description: "Real-time BSA/AML screening against OFAC and FinCEN watchlists", sourceFiles: ["src/main/java/com/usbank/lending/compliance/AmlScreener.java"] },
            { name: "Regulatory Reporting", description: "Automated generation of HMDA, CRA, and fair lending reports", sourceFiles: ["src/main/java/com/usbank/lending/compliance/RegReporter.java"] },
            { name: "Audit Trail", description: "Immutable audit trail for all lending decisions and actions", sourceFiles: ["src/main/java/com/usbank/lending/compliance/AuditTrail.java"] },
          ],
        },
        {
          name: "Rate Engine", description: "Dynamic loan pricing engine with market data integration", category: "Lending",
          functionalities: [
            { name: "Dynamic Pricing", description: "Risk-based pricing algorithm with competitive rate optimization", sourceFiles: ["src/main/java/com/usbank/lending/rates/DynamicPricer.java"] },
            { name: "Market Data Integration", description: "Real-time treasury and benchmark rate feeds integration", sourceFiles: ["src/main/java/com/usbank/lending/rates/MarketDataFeed.java"] },
            { name: "Rate Lock Management", description: "Rate lock processing with expiration tracking and extension workflows", sourceFiles: ["src/main/java/com/usbank/lending/rates/RateLockManager.java"] },
          ],
        },
        {
          name: "Loan Servicing", description: "Post-origination loan servicing including payments, escrow, and collections", category: "Lending",
          functionalities: [
            { name: "Payment Scheduling", description: "Automated payment schedule generation and processing", sourceFiles: ["src/main/java/com/usbank/lending/servicing/PaymentScheduler.java"] },
            { name: "Escrow Administration", description: "Ongoing escrow analysis, disbursement, and shortage management", sourceFiles: ["src/main/java/com/usbank/lending/servicing/EscrowAdmin.java"] },
            { name: "Collections", description: "Delinquency tracking, workout options, and loss mitigation workflows", sourceFiles: ["src/main/java/com/usbank/lending/servicing/Collections.java"] },
          ],
        },
      ],
      group: { name: "Lending Operations", description: "Loan origination and credit decisioning workflow" },
      steps: [
        { name: "Application Entry", stepOrder: 1, stepType: "process" },
        { name: "Credit Bureau Pull", stepOrder: 2, stepType: "process" },
        { name: "Risk Assessment", stepOrder: 3, stepType: "decision" },
        { name: "Document Verification", stepOrder: 4, stepType: "process" },
        { name: "Underwriting Queue", stepOrder: 5, stepType: "wait" },
        { name: "Final Approval", stepOrder: 6, stepType: "decision" },
        { name: "Loan Disbursement", stepOrder: 7, stepType: "process" },
      ],
      vsm: {
        processTime: 6.0,
        leadTime: 96.0,
        waitTime: 90.0,
        flowEfficiency: 6.25,
        mermaidSource: `graph LR
    A[Application Entry]:::value --> B[Credit Check]:::value
    B --> C{Risk Assessment}:::bottleneck
    C -->|Approved| D[Document Verification]:::value
    C -->|Denied| E[Manual Review]:::waste
    E --> C
    D --> F[Loan Disbursement]:::value
    F --> G[Post-Close Audit]:::value

    classDef value fill:#22c55e,stroke:#16a34a,color:#fff
    classDef bottleneck fill:#f59e0b,stroke:#d97706,color:#fff
    classDef waste fill:#ef4444,stroke:#dc2626,color:#fff`,
      },
    },
    // ─── Product 2: InstaPay Hub (8 capabilities) ───────────────────────
    {
      name: "InstaPay Hub",
      description: "Unified real-time payment hub supporting all domestic and international payment rails",
      currentState: "Batch-processed ACH with T+1 settlement and separate wire transfer system",
      futureState: "Unified real-time payment hub with instant settlement and intelligent multi-rail routing",
      businessSegment: "Commercial Lending",
      capabilities: [
        {
          name: "Payment Routing", description: "Intelligent multi-rail payment routing with FedNow and SWIFT support", category: "Payments",
          functionalities: [
            { name: "Multi-Rail Router", description: "Smart routing engine selecting optimal payment rail based on speed, cost, and availability", sourceFiles: ["src/main/java/com/usbank/payments/routing/MultiRailRouter.java"] },
            { name: "FedNow Gateway", description: "FedNow instant payment network gateway integration", sourceFiles: ["src/main/java/com/usbank/payments/routing/FedNowGateway.java"] },
            { name: "SWIFT Interface", description: "SWIFT gpi messaging interface for international wire transfers", sourceFiles: ["src/main/java/com/usbank/payments/routing/SwiftInterface.java"] },
          ],
        },
        {
          name: "Fraud Screening", description: "Real-time transaction fraud detection with ML scoring and velocity checks", category: "Payments",
          functionalities: [
            { name: "Transaction Scoring", description: "ML-based real-time transaction risk scoring", sourceFiles: ["src/main/java/com/usbank/payments/fraud/TransactionScorer.java"] },
            { name: "Velocity Checks", description: "Transaction velocity and pattern analysis for anomaly detection", sourceFiles: ["src/main/java/com/usbank/payments/fraud/VelocityChecker.java"] },
            { name: "Device Fingerprint", description: "Device fingerprinting and behavioral analysis for fraud prevention", sourceFiles: ["src/main/java/com/usbank/payments/fraud/DeviceFingerprint.java"] },
          ],
        },
        {
          name: "AML Compliance", description: "Anti-money laundering compliance with sanctions screening and transaction monitoring", category: "Compliance",
          functionalities: [
            { name: "Sanctions Screening", description: "Real-time OFAC and global sanctions list screening", sourceFiles: ["src/main/java/com/usbank/payments/aml/SanctionsScreener.java"] },
            { name: "PEP Matching", description: "Politically exposed persons matching and enhanced due diligence", sourceFiles: ["src/main/java/com/usbank/payments/aml/PepMatcher.java"] },
            { name: "Transaction Monitoring", description: "Continuous transaction monitoring for suspicious activity patterns", sourceFiles: ["src/main/java/com/usbank/payments/aml/TxnMonitor.java"] },
          ],
        },
        {
          name: "Real-Time Settlement", description: "Instant settlement engine with liquidity management and reconciliation", category: "Payments",
          functionalities: [
            { name: "Net Settlement Engine", description: "Multi-lateral netting and gross settlement processing", sourceFiles: ["src/main/java/com/usbank/payments/settlement/NetSettlement.java"] },
            { name: "Liquidity Management", description: "Intraday liquidity monitoring and prefunding optimization", sourceFiles: ["src/main/java/com/usbank/payments/settlement/LiquidityManager.java"] },
            { name: "Reconciliation", description: "Automated T+0 reconciliation across all payment rails", sourceFiles: ["src/main/java/com/usbank/payments/settlement/Reconciler.java"] },
          ],
        },
        {
          name: "Payment Orchestration", description: "Payment lifecycle orchestration with queue management and SLA monitoring", category: "Payments",
          functionalities: [
            { name: "Queue Manager", description: "Priority-based payment queue management with retry logic", sourceFiles: ["src/main/java/com/usbank/payments/orchestration/QueueManager.java"] },
            { name: "Priority Routing", description: "SLA-aware priority routing for time-sensitive payments", sourceFiles: ["src/main/java/com/usbank/payments/orchestration/PriorityRouter.java"] },
            { name: "SLA Monitor", description: "Real-time SLA tracking and breach alerting for payment processing", sourceFiles: ["src/main/java/com/usbank/payments/orchestration/SlaMonitor.java"] },
          ],
        },
        {
          name: "Merchant Gateway", description: "Merchant payment acceptance gateway with API integration and settlement reporting", category: "Payments",
          functionalities: [
            { name: "API Integration", description: "RESTful payment acceptance API for merchant POS and e-commerce integration", sourceFiles: ["src/main/java/com/usbank/payments/merchant/ApiGateway.java"] },
            { name: "Webhook Manager", description: "Event-driven webhook delivery for payment status notifications", sourceFiles: ["src/main/java/com/usbank/payments/merchant/WebhookManager.java"] },
            { name: "Settlement Reports", description: "Merchant settlement reporting and fee calculation engine", sourceFiles: ["src/main/java/com/usbank/payments/merchant/SettlementReporter.java"] },
          ],
        },
        {
          name: "FX Processing", description: "Foreign exchange processing for cross-border payments with rate hedging", category: "Payments",
          functionalities: [
            { name: "Currency Conversion", description: "Real-time multi-currency conversion with competitive spread management", sourceFiles: ["src/main/java/com/usbank/payments/fx/CurrencyConverter.java"] },
            { name: "Cross-Border Routing", description: "Optimized cross-border payment routing via correspondent banking network", sourceFiles: ["src/main/java/com/usbank/payments/fx/CrossBorderRouter.java"] },
            { name: "Rate Hedging", description: "Automated FX rate hedging and exposure management", sourceFiles: ["src/main/java/com/usbank/payments/fx/RateHedger.java"] },
          ],
        },
        {
          name: "Notification Service", description: "Multi-channel payment notification service with status tracking", category: "Operations",
          functionalities: [
            { name: "Payment Alerts", description: "Real-time payment status alerts via SMS, email, and push notifications", sourceFiles: ["src/main/java/com/usbank/payments/notifications/PaymentAlerts.java"] },
            { name: "Status Updates", description: "Payment lifecycle status tracking and customer-facing updates", sourceFiles: ["src/main/java/com/usbank/payments/notifications/StatusUpdater.java"] },
            { name: "Receipt Generation", description: "Digital receipt generation and delivery for completed transactions", sourceFiles: ["src/main/java/com/usbank/payments/notifications/ReceiptGenerator.java"] },
          ],
        },
      ],
      group: { name: "Payment Operations", description: "Payment routing, clearing, and settlement workflow" },
      steps: [
        { name: "Payment Initiation", stepOrder: 1, stepType: "process" },
        { name: "Fraud Screening", stepOrder: 2, stepType: "decision" },
        { name: "AML/BSA Check", stepOrder: 3, stepType: "decision" },
        { name: "Payment Routing", stepOrder: 4, stepType: "process" },
        { name: "Clearing Queue", stepOrder: 5, stepType: "wait" },
        { name: "Settlement", stepOrder: 6, stepType: "process" },
      ],
      vsm: {
        processTime: 1.5,
        leadTime: 24.0,
        waitTime: 22.5,
        flowEfficiency: 6.25,
        mermaidSource: `graph LR
    A[Payment Initiation]:::value --> B[Fraud Screening]:::bottleneck
    B -->|Clear| C[AML Check]:::value
    B -->|Flagged| D[Manual Investigation]:::waste
    D --> B
    C --> E{Routing Decision}:::value
    E -->|Domestic| F[ACH Processing]:::value
    E -->|International| G[SWIFT Processing]:::value
    F --> H[Settlement]:::value
    G --> H

    classDef value fill:#22c55e,stroke:#16a34a,color:#fff
    classDef bottleneck fill:#f59e0b,stroke:#d97706,color:#fff
    classDef waste fill:#ef4444,stroke:#dc2626,color:#fff`,
      },
    },
    // ─── Product 3: FraudShield AI (9 capabilities) ─────────────────────
    {
      name: "FraudShield AI",
      description: "AI-powered fraud detection and prevention platform with real-time transaction monitoring",
      currentState: "Rule-based fraud detection with high false-positive rate and 24hr investigation cycle",
      futureState: "ML-powered real-time fraud scoring with graph-based network analysis and automated case resolution",
      businessSegment: "Wealth Management",
      capabilities: [
        {
          name: "ML Scoring Engine", description: "Machine learning model training and real-time inference for fraud scoring", category: "Risk Management",
          functionalities: [
            { name: "Model Training Pipeline", description: "Automated ML model training pipeline with feature selection and hyperparameter tuning", sourceFiles: ["src/main/java/com/usbank/fraud/ml/ModelTrainer.java", "src/main/java/com/usbank/fraud/ml/FeatureSelector.java"] },
            { name: "Feature Engineering", description: "Real-time and batch feature engineering for fraud detection models", sourceFiles: ["src/main/java/com/usbank/fraud/ml/FeatureEngineer.java"] },
            { name: "Inference API", description: "Low-latency model inference API for real-time transaction scoring", sourceFiles: ["src/main/java/com/usbank/fraud/ml/InferenceApi.java"] },
          ],
        },
        {
          name: "Rule Engine", description: "Dynamic rule engine with threshold management and performance analytics", category: "Risk Management",
          functionalities: [
            { name: "Dynamic Rules", description: "Hot-deployable fraud detection rules with version control", sourceFiles: ["src/main/java/com/usbank/fraud/rules/DynamicRuleEngine.java"] },
            { name: "Threshold Management", description: "Configurable risk thresholds with A/B testing support", sourceFiles: ["src/main/java/com/usbank/fraud/rules/ThresholdManager.java"] },
            { name: "Rule Performance Analytics", description: "Rule effectiveness tracking with precision/recall metrics", sourceFiles: ["src/main/java/com/usbank/fraud/rules/RuleAnalytics.java"] },
          ],
        },
        {
          name: "Case Management", description: "Fraud investigation workflow with evidence collection and SAR filing", category: "Operations",
          functionalities: [
            { name: "Investigation Workflow", description: "Structured fraud investigation workflow with SLA tracking", sourceFiles: ["src/main/java/com/usbank/fraud/cases/InvestigationWorkflow.java"] },
            { name: "Evidence Collection", description: "Automated evidence gathering and timeline reconstruction", sourceFiles: ["src/main/java/com/usbank/fraud/cases/EvidenceCollector.java"] },
            { name: "SAR Filing", description: "Automated SAR generation and FinCEN e-filing integration", sourceFiles: ["src/main/java/com/usbank/fraud/cases/SarFiler.java"] },
          ],
        },
        {
          name: "Network Analysis", description: "Graph-based fraud network detection with entity resolution", category: "Risk Management",
          functionalities: [
            { name: "Graph Analytics", description: "Graph database-powered fraud ring detection and community analysis", sourceFiles: ["src/main/java/com/usbank/fraud/network/GraphAnalytics.java"] },
            { name: "Entity Resolution", description: "Cross-channel entity resolution linking accounts, devices, and identities", sourceFiles: ["src/main/java/com/usbank/fraud/network/EntityResolver.java"] },
            { name: "Link Prediction", description: "ML-based link prediction for identifying emerging fraud networks", sourceFiles: ["src/main/java/com/usbank/fraud/network/LinkPredictor.java"] },
          ],
        },
        {
          name: "Device Intelligence", description: "Device fingerprinting and behavioral biometrics for authentication", category: "Security",
          functionalities: [
            { name: "Device Fingerprinting", description: "Browser and device fingerprint collection and matching", sourceFiles: ["src/main/java/com/usbank/fraud/device/Fingerprinter.java"] },
            { name: "Behavioral Biometrics", description: "Keystroke dynamics and mouse movement behavioral analysis", sourceFiles: ["src/main/java/com/usbank/fraud/device/BehavioralBiometrics.java"] },
            { name: "Geolocation", description: "IP geolocation and impossible travel detection", sourceFiles: ["src/main/java/com/usbank/fraud/device/GeoLocator.java"] },
          ],
        },
        {
          name: "Alert Triage", description: "Intelligent alert prioritization with auto-dismiss and escalation", category: "Operations",
          functionalities: [
            { name: "Alert Prioritization", description: "ML-based alert scoring and queue prioritization", sourceFiles: ["src/main/java/com/usbank/fraud/alerts/AlertPrioritizer.java"] },
            { name: "Auto-Dismiss Logic", description: "Rule-based auto-dismissal of low-risk false positive alerts", sourceFiles: ["src/main/java/com/usbank/fraud/alerts/AutoDismisser.java"] },
            { name: "Escalation Engine", description: "Time-based and severity-based alert escalation workflows", sourceFiles: ["src/main/java/com/usbank/fraud/alerts/EscalationEngine.java"] },
          ],
        },
        {
          name: "Account Takeover Detection", description: "Account takeover detection with login anomaly analysis and MFA integration", category: "Security",
          functionalities: [
            { name: "Login Anomaly Detection", description: "Real-time login pattern analysis for account compromise detection", sourceFiles: ["src/main/java/com/usbank/fraud/ato/LoginAnomalyDetector.java"] },
            { name: "Session Analysis", description: "In-session behavior analysis for ongoing account takeover detection", sourceFiles: ["src/main/java/com/usbank/fraud/ato/SessionAnalyzer.java"] },
            { name: "MFA Integration", description: "Adaptive MFA challenge triggers based on risk scoring", sourceFiles: ["src/main/java/com/usbank/fraud/ato/MfaIntegration.java"] },
          ],
        },
        {
          name: "Transaction Monitoring", description: "Continuous transaction pattern monitoring with velocity and amount profiling", category: "Risk Management",
          functionalities: [
            { name: "Pattern Detection", description: "Complex event processing for multi-step fraud pattern detection", sourceFiles: ["src/main/java/com/usbank/fraud/monitoring/PatternDetector.java"] },
            { name: "Velocity Analysis", description: "Transaction velocity profiling with adaptive baseline computation", sourceFiles: ["src/main/java/com/usbank/fraud/monitoring/VelocityAnalyzer.java"] },
            { name: "Amount Profiling", description: "Transaction amount profiling with anomaly detection for unusual values", sourceFiles: ["src/main/java/com/usbank/fraud/monitoring/AmountProfiler.java"] },
          ],
        },
        {
          name: "Reporting Dashboard", description: "Fraud analytics dashboard with loss metrics and trend analysis", category: "Analytics",
          functionalities: [
            { name: "Fraud Metrics", description: "Real-time fraud KPI dashboard with detection rate and false positive tracking", sourceFiles: ["src/main/java/com/usbank/fraud/reporting/FraudMetrics.java"] },
            { name: "Loss Analytics", description: "Fraud loss analytics with recovery tracking and chargeback reporting", sourceFiles: ["src/main/java/com/usbank/fraud/reporting/LossAnalytics.java"] },
            { name: "Trend Analysis", description: "Fraud trend analysis with seasonal patterns and emerging threat detection", sourceFiles: ["src/main/java/com/usbank/fraud/reporting/TrendAnalyzer.java"] },
          ],
        },
      ],
      group: { name: "Fraud Operations", description: "Fraud detection, investigation, and case management workflow" },
      steps: [
        { name: "Transaction Ingestion", stepOrder: 1, stepType: "process" },
        { name: "Rule Engine Scan", stepOrder: 2, stepType: "process" },
        { name: "ML Model Scoring", stepOrder: 3, stepType: "process" },
        { name: "Risk Threshold Decision", stepOrder: 4, stepType: "decision" },
        { name: "Analyst Review Queue", stepOrder: 5, stepType: "wait" },
        { name: "Case Resolution", stepOrder: 6, stepType: "decision" },
        { name: "SAR Filing", stepOrder: 7, stepType: "process" },
      ],
      vsm: {
        processTime: 0.8,
        leadTime: 4.0,
        waitTime: 3.2,
        flowEfficiency: 20.0,
        mermaidSource: `graph LR
    A[Transaction Ingestion]:::value --> B[Rule Engine Scan]:::value
    B --> C[ML Model Scoring]:::value
    C --> D{Risk Threshold}:::bottleneck
    D -->|Low Risk| E[Auto Approve]:::value
    D -->|Medium Risk| F[Enhanced Review]:::bottleneck
    D -->|High Risk| G[Block & Alert]:::value
    F --> H[Analyst Queue]:::waste
    H --> I{Analyst Decision}:::bottleneck
    I -->|Legit| E
    I -->|Fraud| G

    classDef value fill:#22c55e,stroke:#16a34a,color:#fff
    classDef bottleneck fill:#f59e0b,stroke:#d97706,color:#fff
    classDef waste fill:#ef4444,stroke:#dc2626,color:#fff`,
      },
    },
  ],
  risks: [
    { productIndex: 0, riskCategory: "REGULATORY", riskScore: 9.0, severity: "CRITICAL", description: "BSA/AML compliance gaps in automated lending decisions — FinCEN requires full audit trail for AI-driven approvals", mitigationPlan: "Implement explainable AI framework; maintain human-in-the-loop for loans above $250K; quarterly FinCEN audit readiness reviews", transitionBlocked: true },
    { productIndex: 1, riskCategory: "TECHNOLOGY", riskScore: 7.5, severity: "HIGH", description: "Real-time payment system migration risks including potential settlement failures during cutover", mitigationPlan: "Parallel run legacy and new payment rails for 90 days; implement circuit breakers; maintain fallback to ACH batch processing", transitionBlocked: false },
    { productIndex: 2, riskCategory: "OPERATIONAL", riskScore: 5.0, severity: "MEDIUM", description: "ML model drift may increase false positive rates during initial deployment period", mitigationPlan: "Establish model monitoring dashboard; weekly model performance reviews; automated retraining pipeline with A/B testing", transitionBlocked: false },
    { productIndex: 2, riskCategory: "DATA_PRIVACY", riskScore: 3.5, severity: "LOW", description: "Transaction data used for ML training requires proper anonymization controls", mitigationPlan: "Apply differential privacy techniques; data anonymization pipeline before model training; annual privacy impact assessment", transitionBlocked: false },
  ],
  compliance: [
    { productIndex: 0, framework: "BSA/AML", requirement: "31 CFR 1020.220 — Customer Identification Program", description: "AI lending decisions must maintain full CIP compliance with identity verification audit trails", status: "REMEDIATION", evidenceLinks: ["https://www.fincen.gov/resources/statutes-regulations/federal-register-notices/customer-identification-programs"] },
    { productIndex: 0, framework: "SOX", requirement: "Section 404 — Internal Controls", description: "Automated underwriting requires documented internal controls and management assessment", status: "COMPLIANT", evidenceLinks: ["https://www.sec.gov/spotlight/sarbanes-oxley.htm"] },
    { productIndex: 1, framework: "FINRA", requirement: "Rule 3110 — Supervisory Systems", description: "Real-time payment supervisory systems must include automated monitoring and exception reporting", status: "COMPLIANT", evidenceLinks: ["https://www.finra.org/rules-guidance/rulebooks/finra-rules/3110"] },
    { productIndex: 1, framework: "FDIC", requirement: "12 CFR Part 370 — Recordkeeping Requirements", description: "Payment processing records must be maintained for deposit insurance determination", status: "PENDING", evidenceLinks: [] },
    { productIndex: 2, framework: "SEC", requirement: "Regulation S-P — Privacy of Consumer Financial Information", description: "Fraud detection ML models must protect consumer financial data per Reg S-P", status: "COMPLIANT", evidenceLinks: ["https://www.sec.gov/rules/final/34-42974.htm"] },
    { productIndex: 2, framework: "BSA/AML", requirement: "SAR Filing Requirements — 31 CFR 1020.320", description: "AI-flagged suspicious activity must generate compliant SAR filings within 30 days", status: "REMEDIATION", evidenceLinks: ["https://www.fincen.gov/resources/filing-information"] },
  ],
  productReadiness: [
    {
      readinessScore: 7.2,
      factors: [{ name: "Technical Debt", score: 6.5 }, { name: "Team Readiness", score: 8.0 }, { name: "Data Quality", score: 7.0 }, { name: "Infrastructure", score: 7.5 }],
      migrationSteps: [
        { phase: "Assessment", description: "Evaluate legacy COBOL lending modules and dependency mapping", status: "completed", estimatedDuration: "2 weeks" },
        { phase: "Data Migration", description: "Migrate loan portfolio data to cloud-native data store", status: "in-progress", estimatedDuration: "6 weeks" },
        { phase: "Service Build", description: "Build microservices for credit decisioning and underwriting", status: "pending", estimatedDuration: "8 weeks" },
        { phase: "Integration Testing", description: "End-to-end testing with core banking and bureau integrations", status: "pending", estimatedDuration: "3 weeks" },
      ],
      gateApproved: true,
      blockers: [],
    },
    {
      readinessScore: 5.8,
      factors: [{ name: "Technical Debt", score: 4.5 }, { name: "Team Readiness", score: 7.0 }, { name: "Data Quality", score: 6.0 }, { name: "Infrastructure", score: 5.5 }],
      migrationSteps: [
        { phase: "Assessment", description: "Map legacy ACH batch processing and SWIFT interfaces", status: "completed", estimatedDuration: "3 weeks" },
        { phase: "Infrastructure", description: "Deploy real-time messaging infrastructure (Kafka clusters)", status: "in-progress", estimatedDuration: "5 weeks" },
        { phase: "Migration", description: "Migrate payment rails to real-time processing engine", status: "pending", estimatedDuration: "10 weeks" },
        { phase: "Certification", description: "FedNow and RTP network certification testing", status: "pending", estimatedDuration: "4 weeks" },
      ],
      gateApproved: false,
      blockers: ["Legacy ACH batch dependencies not fully mapped", "FedNow certification requirements pending review"],
    },
    {
      readinessScore: 8.1,
      factors: [{ name: "Technical Debt", score: 7.5 }, { name: "Team Readiness", score: 9.0 }, { name: "Data Quality", score: 8.0 }, { name: "Infrastructure", score: 8.0 }],
      migrationSteps: [
        { phase: "Assessment", description: "Audit current rule engine and ML model inventory", status: "completed", estimatedDuration: "2 weeks" },
        { phase: "Model Development", description: "Train and validate next-gen fraud detection models", status: "completed", estimatedDuration: "6 weeks" },
        { phase: "Integration", description: "Deploy ML scoring service with real-time transaction pipeline", status: "in-progress", estimatedDuration: "4 weeks" },
        { phase: "Rollout", description: "Phased rollout with shadow scoring and gradual traffic shift", status: "pending", estimatedDuration: "3 weeks" },
      ],
      gateApproved: true,
      blockers: [],
    },
  ],
  futureState: {
    automationMix: [
      { productName: "LoanFlow Digital", rpa: 20, aiMl: 30, agentBased: 25, conversational: 10, analytics: 15 },
      { productName: "InstaPay Hub", rpa: 15, aiMl: 20, agentBased: 30, conversational: 15, analytics: 20 },
      { productName: "FraudShield AI", rpa: 10, aiMl: 40, agentBased: 20, conversational: 5, analytics: 25 },
    ],
    currentSteps: [
      { name: "Application Entry", type: "manual", duration: 4 },
      { name: "Credit Check", type: "manual", duration: 3 },
      { name: "Document Verification", type: "manual", duration: 5 },
      { name: "Underwriting Review", type: "manual", duration: 8 },
      { name: "Loan Approval", type: "manual", duration: 2 },
    ],
    futureSteps: [
      { name: "Smart Application", type: "agent", duration: 0.5 },
      { name: "AI Credit Scoring", type: "ai", duration: 0.2 },
      { name: "Auto Document Scan", type: "ai", duration: 0.3 },
      { name: "Algorithmic Underwriting", type: "ai", duration: 0.5 },
      { name: "Instant Approval", type: "automated", duration: 0.1 },
    ],
    capabilities: [
      { name: "Intelligent Loan Processing", category: "AI_ML_INTEGRATION", businessImpact: "HIGH", complexity: "HIGH", techStack: ["TensorFlow", "Apache Kafka", "Spring Boot"], description: "AI-powered end-to-end loan origination with automated underwriting decisions", reach: 9, impact: 9, confidence: 0.6, effort: 8, riceScore: 6.08 },
      { name: "Real-Time Payment Intelligence", category: "AGENT_BASED", businessImpact: "HIGH", complexity: "MEDIUM", techStack: ["Apache Flink", "Kubernetes", "gRPC"], description: "Multi-agent payment routing and fraud detection in real-time", reach: 8, impact: 8, confidence: 0.7, effort: 5, riceScore: 8.96 },
      { name: "Conversational Banking Assistant", category: "CONVERSATIONAL_AI", businessImpact: "MEDIUM", complexity: "MEDIUM", techStack: ["GPT-4", "LangChain", "React Native"], description: "Natural language interface for account inquiries and loan applications", reach: 7, impact: 5, confidence: 0.8, effort: 4, riceScore: 7.0 },
      { name: "Fraud Pattern Analytics", category: "ADVANCED_ANALYTICS", businessImpact: "HIGH", complexity: "HIGH", techStack: ["Spark MLlib", "Neo4j", "Grafana"], description: "Graph-based fraud network detection and predictive risk analytics", reach: 8, impact: 9, confidence: 0.5, effort: 7, riceScore: 5.14 },
      { name: "Regulatory Report Automation", category: "RPA_AUTOMATION", businessImpact: "MEDIUM", complexity: "LOW", techStack: ["UiPath", "Python", "SQL Server"], description: "Automated generation of BSA/AML and SOX compliance reports", reach: 6, impact: 6, confidence: 0.9, effort: 2, riceScore: 16.2 },
    ],
    productStreams: {
      "LoanFlow Digital": {
        currentSteps: [
          { name: "Application Entry", type: "manual", duration: 4 },
          { name: "Credit Check", type: "manual", duration: 3 },
          { name: "Document Verification", type: "manual", duration: 5 },
          { name: "Underwriting Review", type: "manual", duration: 8 },
          { name: "Loan Approval", type: "manual", duration: 2 },
        ],
        futureSteps: [
          { name: "Smart Application", type: "agent", duration: 0.5 },
          { name: "AI Credit Scoring", type: "ai", duration: 0.2 },
          { name: "Auto Document Scan", type: "ai", duration: 0.3 },
          { name: "Algorithmic Underwriting", type: "ai", duration: 0.5 },
          { name: "Instant Approval", type: "automated", duration: 0.1 },
        ],
      },
      "InstaPay Hub": {
        currentSteps: [
          { name: "Payment Initiation", type: "manual", duration: 2 },
          { name: "Fraud Screening", type: "manual", duration: 3 },
          { name: "Rail Selection", type: "manual", duration: 2 },
          { name: "Settlement Processing", type: "manual", duration: 6 },
          { name: "Reconciliation", type: "manual", duration: 4 },
        ],
        futureSteps: [
          { name: "API Payment Trigger", type: "automated", duration: 0.1 },
          { name: "Real-Time Fraud AI", type: "ai", duration: 0.2 },
          { name: "Smart Rail Router", type: "agent", duration: 0.3 },
          { name: "Instant Settlement", type: "automated", duration: 0.1 },
          { name: "Auto Reconciliation", type: "automated", duration: 0.1 },
        ],
      },
      "FraudShield AI": {
        currentSteps: [
          { name: "Transaction Monitoring", type: "automated", duration: 1 },
          { name: "Alert Triage", type: "manual", duration: 5 },
          { name: "Case Investigation", type: "manual", duration: 8 },
          { name: "Decision & Escalation", type: "manual", duration: 3 },
          { name: "SAR Filing", type: "manual", duration: 4 },
        ],
        futureSteps: [
          { name: "ML Transaction Scoring", type: "ai", duration: 0.1 },
          { name: "AI Alert Prioritization", type: "ai", duration: 0.2 },
          { name: "Agent-Led Investigation", type: "agent", duration: 0.5 },
          { name: "Auto Decision Engine", type: "ai", duration: 0.3 },
          { name: "Smart SAR Generation", type: "agent", duration: 0.5 },
        ],
      },
    },
  },
  architecture: {
    current_architecture: "Monolithic Java application built on IBM WebSphere with Oracle DB backend. Tightly coupled modules for lending, payments, and fraud with shared database schema. COBOL batch processing for end-of-day settlements.",
    target_architecture: "Microservices-based cloud-native architecture on AWS EKS. Event-driven design using Apache Kafka for inter-service communication. Domain-driven design with separate bounded contexts for lending, payments, and fraud detection.",
    migration_plan: "Phase 1: Strangler fig pattern to extract lending microservices (Q1-Q2). Phase 2: Payment processing migration to real-time event-driven architecture (Q3). Phase 3: Fraud detection ML pipeline deployment on SageMaker (Q4). Phase 4: Legacy decommission and data migration (Q1 next year).",
    architecture_diagrams: {
      functional: "graph TD\n  A[Customer Channels] --> B[API Gateway]\n  B --> C[Lending Service]\n  B --> D[Payment Service]\n  B --> E[Fraud Detection]\n  C --> F[Credit Engine]\n  C --> G[Underwriting]\n  D --> H[Payment Router]\n  D --> I[Settlement Engine]\n  E --> J[ML Scoring]\n  E --> K[Rule Engine]\n  F --> L[(Lending DB)]\n  H --> M[(Payment DB)]\n  J --> N[(ML Feature Store)]",
      technical: "graph TD\n  A[AWS EKS Cluster] --> B[Istio Service Mesh]\n  B --> C[Spring Boot Services]\n  C --> D[Apache Kafka]\n  D --> E[Event Processors]\n  C --> F[Amazon RDS PostgreSQL]\n  C --> G[Amazon ElastiCache]\n  E --> H[Amazon SageMaker]\n  C --> I[Amazon S3]\n  A --> J[AWS ALB]\n  J --> K[CloudFront CDN]",
      solution: "graph TD\n  A[Mobile/Web App] --> B[Kong API Gateway]\n  B --> C{Service Router}\n  C --> D[Lending Microservice]\n  C --> E[Payment Microservice]\n  C --> F[Fraud Microservice]\n  D --> G[PostgreSQL - Lending]\n  E --> H[PostgreSQL - Payments]\n  F --> I[PostgreSQL - Fraud]\n  D & E & F --> J[Kafka Event Bus]\n  J --> K[Analytics Pipeline]\n  K --> L[Data Warehouse]",
      products: {
        "LoanFlow Digital": {
          solution: "graph LR\n  subgraph Personas\n    B1[Borrower]\n    B2[Underwriter]\n    B3[Compliance Officer]\n  end\n  subgraph Agentic Workstreams\n    A1[AI Underwriting Agent]\n    A2[Doc Analysis Agent]\n    A3[Risk Scoring Agent]\n  end\n  subgraph Security and Compliance\n    S1[Credit Engine]\n    S2[KYC Gateway]\n    S3[Compliance Rules]\n  end\n  B1 --> A1\n  B2 --> A2\n  B3 --> A3\n  A1 --> S1\n  A2 --> S2\n  A3 --> S3\n  A1 --> A2\n  A2 --> A3",
          technical: "graph TD\n  subgraph Infrastructure\n    I1[AWS EKS]\n    I2[Oracle DB]\n    I3[Amazon S3]\n  end\n  subgraph Platform\n    P1[Spring Boot]\n    P2[Apache Kafka]\n    P3[Redis Cache]\n  end\n  subgraph Application\n    AP1[Loan Origination Service]\n    AP2[Underwriting API]\n    AP3[Document Service]\n  end\n  I1 --> P1\n  I2 --> P1\n  P1 --> AP1\n  P2 --> AP2\n  P3 --> AP3\n  AP1 --> P2\n  AP2 --> AP3",
          sequence: "sequenceDiagram\n  participant B as Borrower\n  participant AP as Application Portal\n  participant AI as AI Underwriting\n  participant CS as Credit Scoring\n  participant D as Disbursement\n  B->>AP: Submit Loan Application\n  AP->>AI: Route for AI Review\n  AI->>CS: Request Credit Score\n  CS-->>AI: Return Risk Assessment\n  AI-->>AP: Approval Decision\n  AP->>D: Initiate Disbursement\n  D-->>B: Funds Transferred",
        },
        "InstaPay Hub": {
          solution: "graph LR\n  subgraph Personas\n    P1[Partner Bank]\n    P2[Merchant]\n    P3[End User]\n  end\n  subgraph Agentic Workstreams\n    A1[Smart Router Agent]\n    A2[Fraud Detection Agent]\n    A3[Settlement Agent]\n  end\n  subgraph Integrations\n    S1[Payment Rails]\n    S2[FX Engine]\n    S3[Compliance Gateway]\n  end\n  P1 --> A1\n  P2 --> A2\n  P3 --> A1\n  A1 --> S1\n  A2 --> S3\n  A3 --> S2\n  A1 --> A2\n  A2 --> A3",
          technical: "graph TD\n  subgraph Infrastructure\n    I1[AWS EKS]\n    I2[FedNow Gateway]\n    I3[HSM Cluster]\n  end\n  subgraph Platform\n    P1[Apache Kafka]\n    P2[SWIFT Adapter]\n    P3[Redis Streams]\n  end\n  subgraph Application\n    AP1[Payment Router]\n    AP2[Settlement Engine]\n    AP3[FX Service]\n  end\n  I1 --> P1\n  I2 --> AP1\n  P1 --> AP1\n  P2 --> AP2\n  P3 --> AP3\n  AP1 --> P1\n  AP2 --> AP3",
          sequence: "sequenceDiagram\n  participant M as Merchant\n  participant PO as Payment Orchestrator\n  participant FS as Fraud Screening\n  participant MR as Multi-Rail Router\n  participant SE as Settlement Engine\n  M->>PO: Initiate Payment\n  PO->>FS: Screen Transaction\n  FS-->>PO: Risk Score OK\n  PO->>MR: Route Payment\n  MR->>SE: Execute Settlement\n  SE-->>MR: Settlement Confirmed\n  MR-->>M: Payment Complete",
        },
        "FraudShield AI": {
          solution: "graph LR\n  subgraph Personas\n    P1[Fraud Analyst]\n    P2[System Monitor]\n    P3[Customer]\n  end\n  subgraph Agentic Workstreams\n    A1[ML Scoring Agent]\n    A2[Network Analysis Agent]\n    A3[Triage Agent]\n  end\n  subgraph Systems\n    S1[Case Management]\n    S2[SAR Filing]\n    S3[Alert Dashboard]\n  end\n  P1 --> A3\n  P2 --> A1\n  P3 --> A3\n  A1 --> S1\n  A2 --> S3\n  A3 --> S2\n  A1 --> A2\n  A2 --> A3",
          technical: "graph TD\n  subgraph Infrastructure\n    I1[Amazon SageMaker]\n    I2[GPU Cluster]\n    I3[S3 Data Lake]\n  end\n  subgraph Platform\n    P1[Feature Store]\n    P2[Model Registry]\n    P3[Kafka Streams]\n  end\n  subgraph Application\n    AP1[Inference API]\n    AP2[Alert Engine]\n    AP3[Case Manager]\n  end\n  I1 --> P1\n  I2 --> P2\n  P1 --> AP1\n  P2 --> AP1\n  P3 --> AP2\n  AP1 --> AP2\n  AP2 --> AP3",
          sequence: "sequenceDiagram\n  participant TX as Transaction\n  participant ML as ML Scoring\n  participant RE as Rule Engine\n  participant AT as Alert Triage\n  participant CM as Case Management\n  participant SAR as SAR Filing\n  TX->>ML: Score Transaction\n  ML->>RE: Apply Business Rules\n  RE-->>AT: Generate Alert\n  AT->>CM: Create Case\n  CM->>SAR: File Suspicious Activity\n  SAR-->>CM: Filing Confirmed",
        },
      },
    },
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// Organization 2: Telstra Health
// ═══════════════════════════════════════════════════════════════════════════════

const TELSTRA_HEALTH: OrgSeedData = {
  org: {
    name: "Telstra Health",
    slug: "telstra-health",
    industryType: "Healthcare Technology",
    description: "Australia's leading health technology company providing clinical systems, health data analytics, and telehealth solutions to hospitals, clinics, and aged care facilities.",
    competitors: ["Cerner", "Epic Systems", "Allscripts"],
    businessSegments: ["Clinical Systems", "Health Data Analytics", "Telehealth"],
    regulatoryFrameworks: ["HIPAA", "HL7 FHIR", "NIST", "Australian Privacy Act", "My Health Records Act"],
    personas: [
      { type: "FRONT_OFFICE", name: "Clinical Director", responsibilities: ["Clinical workflow oversight", "Care quality management", "Patient outcome reporting"] },
      { type: "MIDDLE_OFFICE", name: "Health Informatics Analyst", responsibilities: ["Health data governance", "Clinical analytics reporting", "Interoperability compliance"] },
      { type: "BACK_OFFICE", name: "Integration Engineer", responsibilities: ["HL7/FHIR integration maintenance", "System uptime and monitoring", "Data migration operations"] },
    ],
  },
  repo: {
    name: "telstra-health-platform",
    url: "https://github.com/telstra-health/clinical-platform",
    description: "Clinical data management system supporting EHR, decision support, and telehealth",
    language: "C#",
  },
  products: [
    {
      name: "HealthConnect EHR",
      description: "Unified electronic health record system with cross-facility interoperability",
      currentState: "Siloed clinical records across facilities with manual data reconciliation and paper-based referrals",
      futureState: "FHIR-native unified patient record with AI-powered data reconciliation and real-time cross-facility sharing",
      businessSegment: "Clinical Systems",
      capabilities: [
        { name: "Unified Patient Hub", description: "Single source of truth for patient records with cross-facility data reconciliation", category: "Clinical Data", functionalities: [
          { name: "Patient Registration", description: "Patient demographic capture and MRN assignment", sourceFiles: ["src/Clinical/PatientHub/Registration.cs"] },
          { name: "Identity Matching", description: "Probabilistic patient identity matching across facilities", sourceFiles: ["src/Clinical/PatientHub/IdentityMatcher.cs"] },
          { name: "Record Merging", description: "Clinical record merge with conflict resolution", sourceFiles: ["src/Clinical/PatientHub/RecordMerger.cs"] },
          { name: "Cross-Facility Sync", description: "Real-time patient data synchronization across facilities", sourceFiles: ["src/Clinical/PatientHub/FacilitySync.cs"] },
        ]},
        { name: "Clinical Documentation", description: "Structured and unstructured clinical documentation with voice transcription", category: "Clinical Data", functionalities: [
          { name: "Progress Notes", description: "SOAP-format clinical progress note creation and management", sourceFiles: ["src/Clinical/Documentation/ProgressNotes.cs"] },
          { name: "Discharge Summaries", description: "Automated discharge summary generation with medication reconciliation", sourceFiles: ["src/Clinical/Documentation/DischargeSummary.cs"] },
          { name: "Clinical Templates", description: "Specialty-specific clinical documentation templates", sourceFiles: ["src/Clinical/Documentation/Templates.cs"] },
          { name: "Voice Transcription", description: "AI-powered clinical voice-to-text transcription", sourceFiles: ["src/Clinical/Documentation/VoiceTranscription.cs"] },
        ]},
        { name: "Lab & Diagnostics", description: "Laboratory order management and diagnostic result processing", category: "Clinical Data", functionalities: [
          { name: "Lab Order Management", description: "Electronic lab order creation with CPOE integration", sourceFiles: ["src/Clinical/Lab/OrderManager.cs"] },
          { name: "Result Processing", description: "Lab result ingestion, normalization, and critical value alerting", sourceFiles: ["src/Clinical/Lab/ResultProcessor.cs"] },
          { name: "Imaging Integration", description: "DICOM/PACS integration for radiology image viewing", sourceFiles: ["src/Clinical/Lab/ImagingIntegration.cs"] },
        ]},
        { name: "Medication Management", description: "End-to-end medication lifecycle from prescribing to dispensing", category: "Pharmacy", functionalities: [
          { name: "Prescribing Module", description: "Electronic prescribing with dose calculation and allergy checking", sourceFiles: ["src/Clinical/Medication/Prescriber.cs"] },
          { name: "Drug Interaction Checker", description: "Real-time drug-drug and drug-food interaction screening", sourceFiles: ["src/Clinical/Medication/InteractionChecker.cs"] },
          { name: "Formulary Management", description: "Hospital formulary management with therapeutic substitution", sourceFiles: ["src/Clinical/Medication/Formulary.cs"] },
          { name: "Dispensing Tracker", description: "Medication dispensing tracking with barcode verification", sourceFiles: ["src/Clinical/Medication/DispensingTracker.cs"] },
        ]},
        { name: "Care Planning", description: "Multidisciplinary care plan creation and goal tracking", category: "Clinical Workflow", functionalities: [
          { name: "Care Plan Builder", description: "Template-based care plan creation with evidence-based pathways", sourceFiles: ["src/Clinical/CarePlan/Builder.cs"] },
          { name: "Goal Tracking", description: "Patient goal tracking with outcome measurement", sourceFiles: ["src/Clinical/CarePlan/GoalTracker.cs"] },
          { name: "Multidisciplinary Coordination", description: "Cross-team care coordination with task assignment", sourceFiles: ["src/Clinical/CarePlan/TeamCoordination.cs"] },
        ]},
        { name: "Patient Portal", description: "Patient-facing portal for appointment booking and health record access", category: "Patient Engagement", functionalities: [
          { name: "Appointment Booking", description: "Online appointment scheduling with provider availability", sourceFiles: ["src/Clinical/Portal/AppointmentBooking.cs"] },
          { name: "Health Records Access", description: "Patient access to lab results, medications, and visit history", sourceFiles: ["src/Clinical/Portal/HealthRecords.cs"] },
          { name: "Messaging System", description: "Secure patient-provider messaging with attachment support", sourceFiles: ["src/Clinical/Portal/Messaging.cs"] },
        ]},
        { name: "Clinical Coding", description: "Automated clinical coding for revenue cycle management", category: "Revenue Cycle", functionalities: [
          { name: "ICD-10 Auto-Coding", description: "NLP-powered automatic ICD-10 code suggestion from clinical notes", sourceFiles: ["src/Clinical/Coding/IcdAutoCoder.cs"] },
          { name: "DRG Assignment", description: "Diagnosis-related group assignment with optimization", sourceFiles: ["src/Clinical/Coding/DrgAssigner.cs"] },
          { name: "Coding Audit Trail", description: "Complete coding audit trail with amendment tracking", sourceFiles: ["src/Clinical/Coding/AuditTrail.cs"] },
        ]},
        { name: "Referral Management", description: "Electronic referral creation and specialist matching", category: "Clinical Workflow", functionalities: [
          { name: "Referral Creation", description: "Structured referral form with clinical summary attachment", sourceFiles: ["src/Clinical/Referral/Creator.cs"] },
          { name: "Specialist Matching", description: "AI-assisted specialist matching based on condition and availability", sourceFiles: ["src/Clinical/Referral/SpecialistMatcher.cs"] },
          { name: "Status Tracking", description: "Referral lifecycle tracking with automated follow-up reminders", sourceFiles: ["src/Clinical/Referral/StatusTracker.cs"] },
        ]},
        { name: "Bed Management", description: "Hospital bed allocation and capacity management", category: "Operations", functionalities: [
          { name: "Bed Allocation", description: "Real-time bed assignment with isolation and acuity matching", sourceFiles: ["src/Clinical/BedMgmt/BedAllocator.cs"] },
          { name: "Capacity Dashboard", description: "Hospital-wide capacity visualization with predicted demand", sourceFiles: ["src/Clinical/BedMgmt/CapacityDashboard.cs"] },
          { name: "Discharge Planning", description: "Discharge readiness assessment and planning workflow", sourceFiles: ["src/Clinical/BedMgmt/DischargePlanner.cs"] },
        ]},
      ],
      group: { name: "Patient Data Operations", description: "Patient registration, record management, and data sharing workflow" },
      steps: [
        { name: "Patient Registration", stepOrder: 1, stepType: "process" },
        { name: "Identity Verification", stepOrder: 2, stepType: "process" },
        { name: "Record Retrieval", stepOrder: 3, stepType: "process" },
        { name: "Data Reconciliation", stepOrder: 4, stepType: "decision" },
        { name: "Manual Merge Queue", stepOrder: 5, stepType: "wait" },
        { name: "Clinical Review", stepOrder: 6, stepType: "decision" },
        { name: "Record Publication", stepOrder: 7, stepType: "process" },
      ],
      vsm: { processTime: 3.5, leadTime: 48.0, waitTime: 44.5, flowEfficiency: 7.29, mermaidSource: `graph LR
    A[Patient Registration]:::value --> B[Identity Verification]:::value
    B --> C[Record Retrieval]:::bottleneck
    C --> D{Data Reconciliation}:::bottleneck
    D -->|Match| E[Unified Record Created]:::value
    D -->|Conflict| F[Manual Merge Queue]:::waste
    F --> G[Clinical Review]:::waste
    G --> E
    E --> H[Access Audit Log]:::value

    classDef value fill:#22c55e,stroke:#16a34a,color:#fff
    classDef bottleneck fill:#f59e0b,stroke:#d97706,color:#fff
    classDef waste fill:#ef4444,stroke:#dc2626,color:#fff` },
    },
    {
      name: "ClinicalAI Assistant",
      description: "AI-powered clinical decision support providing real-time alerts and evidence-based care recommendations",
      currentState: "Static rule-based alerts with high alert fatigue and limited diagnostic coverage",
      futureState: "Context-aware AI clinical assistant with predictive analytics, drug interaction AI, and personalized care pathways",
      businessSegment: "Health Data Analytics",
      capabilities: [
        { name: "AI Clinical Insights", description: "Evidence-based clinical alerting with NLP-powered analysis", category: "Clinical AI", functionalities: [
          { name: "Evidence Retrieval", description: "Real-time clinical evidence retrieval from medical knowledge bases", sourceFiles: ["src/ClinicalAI/Insights/EvidenceRetrieval.cs"] },
          { name: "Clinical NLP", description: "Natural language processing for clinical text analysis", sourceFiles: ["src/ClinicalAI/Insights/ClinicalNlp.cs"] },
          { name: "Alert Generation", description: "Context-aware clinical alert generation with severity classification", sourceFiles: ["src/ClinicalAI/Insights/AlertGenerator.cs"] },
        ]},
        { name: "Drug Safety Engine", description: "Comprehensive drug safety checking with interaction and dosage validation", category: "Clinical AI", functionalities: [
          { name: "Interaction Checker", description: "Multi-drug interaction checking with severity grading", sourceFiles: ["src/ClinicalAI/DrugSafety/InteractionChecker.cs"] },
          { name: "Dosage Validator", description: "Weight and renal-function adjusted dosage validation", sourceFiles: ["src/ClinicalAI/DrugSafety/DosageValidator.cs"] },
          { name: "Allergy Cross-Reference", description: "Medication allergy and cross-sensitivity detection", sourceFiles: ["src/ClinicalAI/DrugSafety/AllergyChecker.cs"] },
          { name: "Pregnancy Safety Check", description: "FDA pregnancy category checking for prescribed medications", sourceFiles: ["src/ClinicalAI/DrugSafety/PregnancySafety.cs"] },
        ]},
        { name: "Diagnostic Support", description: "AI-assisted diagnostic reasoning with differential generation", category: "Clinical AI", functionalities: [
          { name: "Symptom Analyzer", description: "Structured symptom capture with probabilistic analysis", sourceFiles: ["src/ClinicalAI/Diagnostics/SymptomAnalyzer.cs"] },
          { name: "Differential Diagnosis", description: "AI-generated differential diagnosis with evidence ranking", sourceFiles: ["src/ClinicalAI/Diagnostics/DifferentialDx.cs"] },
          { name: "Lab Interpretation", description: "Automated lab result interpretation with clinical context", sourceFiles: ["src/ClinicalAI/Diagnostics/LabInterpreter.cs"] },
        ]},
        { name: "Predictive Analytics", description: "Clinical predictive models for readmission, sepsis, and mortality", category: "Analytics", functionalities: [
          { name: "Readmission Predictor", description: "30-day hospital readmission risk prediction model", sourceFiles: ["src/ClinicalAI/Predictive/ReadmissionPredictor.cs"] },
          { name: "Sepsis Early Warning", description: "Real-time sepsis risk scoring with early intervention alerts", sourceFiles: ["src/ClinicalAI/Predictive/SepsisWarning.cs"] },
          { name: "Mortality Risk Scoring", description: "ICU mortality risk scoring with APACHE/SOFA integration", sourceFiles: ["src/ClinicalAI/Predictive/MortalityScorer.cs"] },
        ]},
        { name: "Clinical Workflow AI", description: "AI-powered clinical workflow optimization and assistance", category: "Clinical AI", functionalities: [
          { name: "Order Set Suggestions", description: "Context-aware order set recommendations based on diagnosis", sourceFiles: ["src/ClinicalAI/Workflow/OrderSetSuggester.cs"] },
          { name: "Documentation Assistant", description: "AI-assisted clinical documentation with auto-completion", sourceFiles: ["src/ClinicalAI/Workflow/DocAssistant.cs"] },
          { name: "Smart Scheduling", description: "ML-optimized appointment and procedure scheduling", sourceFiles: ["src/ClinicalAI/Workflow/SmartScheduler.cs"] },
        ]},
        { name: "Population Health", description: "Population-level health analytics and disease surveillance", category: "Analytics", functionalities: [
          { name: "Cohort Analysis", description: "Dynamic patient cohort analysis with risk stratification", sourceFiles: ["src/ClinicalAI/PopHealth/CohortAnalysis.cs"] },
          { name: "Disease Surveillance", description: "Real-time disease outbreak detection and reporting", sourceFiles: ["src/ClinicalAI/PopHealth/Surveillance.cs"] },
          { name: "Health Equity Metrics", description: "Health equity and disparity analysis across demographics", sourceFiles: ["src/ClinicalAI/PopHealth/EquityMetrics.cs"] },
        ]},
        { name: "Natural Language Processing", description: "Clinical NLP infrastructure for text analysis and entity extraction", category: "AI Infrastructure", functionalities: [
          { name: "Clinical Entity Extraction", description: "Named entity recognition for medications, diagnoses, and procedures", sourceFiles: ["src/ClinicalAI/NLP/EntityExtractor.cs"] },
          { name: "Report Summarization", description: "Automated clinical report summarization with key finding extraction", sourceFiles: ["src/ClinicalAI/NLP/ReportSummarizer.cs"] },
          { name: "Medical Coding NLP", description: "NLP-assisted medical coding from free-text clinical notes", sourceFiles: ["src/ClinicalAI/NLP/CodingNlp.cs"] },
        ]},
        { name: "Research Data Platform", description: "De-identified research data platform with cohort building", category: "Analytics", functionalities: [
          { name: "De-Identification Engine", description: "HIPAA Safe Harbor and Expert Determination de-identification", sourceFiles: ["src/ClinicalAI/Research/DeIdentifier.cs"] },
          { name: "Cohort Builder", description: "Visual cohort builder with inclusion/exclusion criteria", sourceFiles: ["src/ClinicalAI/Research/CohortBuilder.cs"] },
          { name: "Data Export Pipeline", description: "Configurable research data export with format transformation", sourceFiles: ["src/ClinicalAI/Research/DataExporter.cs"] },
        ]},
      ],
      group: { name: "Clinical Intelligence", description: "Clinical alert generation, diagnostic support, and care pathway workflow" },
      steps: [
        { name: "Clinical Data Intake", stepOrder: 1, stepType: "process" },
        { name: "Data Normalization", stepOrder: 2, stepType: "process" },
        { name: "AI Model Inference", stepOrder: 3, stepType: "process" },
        { name: "Alert Classification", stepOrder: 4, stepType: "decision" },
        { name: "Clinician Review Queue", stepOrder: 5, stepType: "wait" },
        { name: "Action Recording", stepOrder: 6, stepType: "process" },
      ],
      vsm: { processTime: 1.2, leadTime: 8.0, waitTime: 6.8, flowEfficiency: 15.0, mermaidSource: `graph LR
    A[Clinical Data Intake]:::value --> B[Data Normalization]:::value
    B --> C[AI Analysis Engine]:::value
    C --> D{Clinical Alert}:::bottleneck
    D -->|Critical| E[Immediate Notification]:::value
    D -->|Advisory| F[Decision Queue]:::value
    D -->|Informational| G[Dashboard Update]:::value
    E --> H[Clinician Acknowledgment]:::waste
    H --> I[Action Recorded]:::value

    classDef value fill:#22c55e,stroke:#16a34a,color:#fff
    classDef bottleneck fill:#f59e0b,stroke:#d97706,color:#fff
    classDef waste fill:#ef4444,stroke:#dc2626,color:#fff` },
    },
    {
      name: "TeleCare Suite",
      description: "Integrated virtual care platform combining telehealth, remote monitoring, and digital prescriptions",
      currentState: "Standalone video consultation tool with manual scheduling and no EHR integration",
      futureState: "AI-triaged virtual care platform with automated scheduling, integrated EHR notes, and remote monitoring dashboards",
      businessSegment: "Telehealth",
      capabilities: [
        { name: "Virtual Care Platform", description: "WebRTC-based video consultation with waiting room management", category: "Telehealth", functionalities: [
          { name: "Video Consultation Engine", description: "HD video consultation with screen sharing and recording", sourceFiles: ["src/Telehealth/VirtualCare/VideoEngine.cs"] },
          { name: "Waiting Room Manager", description: "Virtual waiting room with queue management and estimated wait times", sourceFiles: ["src/Telehealth/VirtualCare/WaitingRoom.cs"] },
          { name: "Screen Share Module", description: "Secure screen sharing for clinical image review during consultation", sourceFiles: ["src/Telehealth/VirtualCare/ScreenShare.cs"] },
        ]},
        { name: "Appointment Scheduling", description: "Multi-provider appointment scheduling with automated reminders", category: "Telehealth", functionalities: [
          { name: "Calendar Integration", description: "Provider calendar integration with availability management", sourceFiles: ["src/Telehealth/Scheduling/CalendarIntegration.cs"] },
          { name: "Auto-Scheduling", description: "AI-optimized appointment scheduling considering provider preferences", sourceFiles: ["src/Telehealth/Scheduling/AutoScheduler.cs"] },
          { name: "Reminder System", description: "Multi-channel appointment reminder with confirmation tracking", sourceFiles: ["src/Telehealth/Scheduling/ReminderSystem.cs"] },
          { name: "Waitlist Management", description: "Automated waitlist management with cancellation backfill", sourceFiles: ["src/Telehealth/Scheduling/WaitlistManager.cs"] },
        ]},
        { name: "Remote Monitoring", description: "IoT device integration for remote patient monitoring", category: "Telehealth", functionalities: [
          { name: "Device Data Ingestion", description: "Multi-device health data ingestion from wearables and home devices", sourceFiles: ["src/Telehealth/Monitoring/DeviceIngestion.cs"] },
          { name: "Alert Thresholds", description: "Configurable vital sign alert thresholds with trend analysis", sourceFiles: ["src/Telehealth/Monitoring/AlertThresholds.cs"] },
          { name: "Patient Dashboard", description: "Patient-facing health metrics dashboard with trend visualization", sourceFiles: ["src/Telehealth/Monitoring/PatientDashboard.cs"] },
        ]},
        { name: "Digital Prescriptions", description: "Electronic prescribing and pharmacy integration for telehealth", category: "Pharmacy", functionalities: [
          { name: "ePrescribing", description: "Electronic prescription generation during telehealth consultations", sourceFiles: ["src/Telehealth/Prescriptions/EPrescriber.cs"] },
          { name: "Script Tracking", description: "Prescription status tracking from generation to pharmacy pickup", sourceFiles: ["src/Telehealth/Prescriptions/ScriptTracker.cs"] },
          { name: "Pharmacy Integration", description: "Direct pharmacy integration for electronic script transmission", sourceFiles: ["src/Telehealth/Prescriptions/PharmacyIntegration.cs"] },
        ]},
        { name: "Triage Engine", description: "AI-powered patient triage with urgency classification", category: "Clinical Workflow", functionalities: [
          { name: "Symptom Assessment", description: "Structured symptom capture with guided questioning", sourceFiles: ["src/Telehealth/Triage/SymptomAssessment.cs"] },
          { name: "Urgency Classification", description: "AI-based urgency classification with ESI level assignment", sourceFiles: ["src/Telehealth/Triage/UrgencyClassifier.cs"] },
          { name: "Routing Logic", description: "Patient routing to appropriate care level based on triage result", sourceFiles: ["src/Telehealth/Triage/RoutingLogic.cs"] },
        ]},
        { name: "Patient Intake", description: "Digital patient intake for pre-visit data collection", category: "Patient Engagement", functionalities: [
          { name: "Pre-Visit Forms", description: "Digital pre-visit questionnaires with conditional logic", sourceFiles: ["src/Telehealth/Intake/PreVisitForms.cs"] },
          { name: "Insurance Verification", description: "Real-time insurance eligibility verification", sourceFiles: ["src/Telehealth/Intake/InsuranceVerifier.cs"] },
          { name: "Consent Collection", description: "Digital consent form collection with e-signature", sourceFiles: ["src/Telehealth/Intake/ConsentCollector.cs"] },
        ]},
        { name: "Provider Management", description: "Telehealth provider credentialing and performance management", category: "Operations", functionalities: [
          { name: "Credentialing", description: "Provider credentialing and privilege management", sourceFiles: ["src/Telehealth/Provider/Credentialing.cs"] },
          { name: "Availability Calendar", description: "Provider availability management with timezone support", sourceFiles: ["src/Telehealth/Provider/AvailabilityCalendar.cs"] },
          { name: "Performance Metrics", description: "Provider performance metrics with patient satisfaction tracking", sourceFiles: ["src/Telehealth/Provider/PerformanceMetrics.cs"] },
        ]},
        { name: "Billing Integration", description: "Telehealth billing and claim submission integration", category: "Revenue Cycle", functionalities: [
          { name: "Telehealth Billing Codes", description: "Automated telehealth CPT/HCPCS code assignment", sourceFiles: ["src/Telehealth/Billing/BillingCodes.cs"] },
          { name: "Claim Submission", description: "Electronic claim submission with payer-specific rules", sourceFiles: ["src/Telehealth/Billing/ClaimSubmitter.cs"] },
          { name: "Payment Processing", description: "Patient payment processing with copay collection", sourceFiles: ["src/Telehealth/Billing/PaymentProcessor.cs"] },
        ]},
        { name: "Analytics Dashboard", description: "Telehealth utilization and outcome analytics", category: "Analytics", functionalities: [
          { name: "Utilization Metrics", description: "Telehealth utilization tracking with trend analysis", sourceFiles: ["src/Telehealth/Analytics/UtilizationMetrics.cs"] },
          { name: "Patient Satisfaction", description: "Post-visit patient satisfaction surveys and NPS tracking", sourceFiles: ["src/Telehealth/Analytics/PatientSatisfaction.cs"] },
          { name: "Outcome Tracking", description: "Clinical outcome tracking for telehealth vs in-person comparisons", sourceFiles: ["src/Telehealth/Analytics/OutcomeTracker.cs"] },
        ]},
      ],
      group: { name: "Virtual Care Operations", description: "Telehealth scheduling, consultation, and follow-up workflow" },
      steps: [
        { name: "Appointment Scheduling", stepOrder: 1, stepType: "process" },
        { name: "Patient Prep Check", stepOrder: 2, stepType: "process" },
        { name: "Eligibility Verification", stepOrder: 3, stepType: "decision" },
        { name: "Virtual Room Setup", stepOrder: 4, stepType: "process" },
        { name: "Consultation", stepOrder: 5, stepType: "process" },
        { name: "Clinical Notes Generation", stepOrder: 6, stepType: "process" },
        { name: "Prescription Processing", stepOrder: 7, stepType: "decision" },
        { name: "Follow-up Scheduling", stepOrder: 8, stepType: "process" },
      ],
      vsm: { processTime: 2.5, leadTime: 36.0, waitTime: 33.5, flowEfficiency: 6.94, mermaidSource: `graph LR
    A[Appointment Scheduling]:::value --> B[Patient Prep Check]:::value
    B --> C{Eligibility Verification}:::bottleneck
    C -->|Eligible| D[Virtual Room Setup]:::value
    C -->|Ineligible| E[Redirect to In-Person]:::waste
    D --> F[Consultation]:::value
    F --> G[Clinical Notes Generation]:::value
    G --> H[Prescription Processing]:::bottleneck
    H --> I[Follow-up Scheduling]:::value

    classDef value fill:#22c55e,stroke:#16a34a,color:#fff
    classDef bottleneck fill:#f59e0b,stroke:#d97706,color:#fff
    classDef waste fill:#ef4444,stroke:#dc2626,color:#fff` },
    },
  ],
  risks: [
    { productIndex: 0, riskCategory: "REGULATORY", riskScore: 9.2, severity: "CRITICAL", description: "HIPAA PHI handling in unified patient hub — cross-facility data sharing creates expanded breach surface requiring BAA updates and encryption at rest/in-transit", mitigationPlan: "Implement end-to-end encryption for all PHI; update BAAs with all facility partners; deploy DLP monitoring; quarterly HIPAA security risk assessments", transitionBlocked: true },
    { productIndex: 1, riskCategory: "DATA_PRIVACY", riskScore: 7.8, severity: "HIGH", description: "AI clinical decision support system requires TGA regulatory approval as a Class IIa medical device under Australian therapeutic goods framework", mitigationPlan: "Engage TGA pre-submission consultation; prepare clinical evidence dossier; implement post-market surveillance plan; maintain human-in-the-loop for all critical alerts", transitionBlocked: false },
    { productIndex: 2, riskCategory: "OPERATIONAL", riskScore: 5.5, severity: "MEDIUM", description: "Telehealth platform availability is critical for remote/rural patients — downtime directly impacts patient care continuity", mitigationPlan: "Deploy multi-region active-active architecture; implement automated failover; establish 99.95% SLA with monitoring dashboards; offline-capable mobile app for basic triage", transitionBlocked: false },
    { productIndex: 0, riskCategory: "TECHNOLOGY", riskScore: 3.0, severity: "LOW", description: "FHIR R4 migration from legacy HL7v2 interfaces is well-documented with established migration patterns", mitigationPlan: "Phase HL7v2→FHIR migration over 6 months; maintain dual-protocol gateway during transition; automated conformance testing suite", transitionBlocked: false },
  ],
  compliance: [
    { productIndex: 0, framework: "HIPAA", requirement: "45 CFR §164.312 — Technical Safeguards", description: "PHI access controls, audit logging, and encryption requirements for unified patient record system", status: "REMEDIATION", evidenceLinks: ["https://www.hhs.gov/hipaa/for-professionals/security/laws-regulations/index.html"] },
    { productIndex: 0, framework: "My Health Records Act", requirement: "Section 59 — Unauthorised Access", description: "Controls preventing unauthorised access to My Health Record data in cross-facility sharing", status: "COMPLIANT", evidenceLinks: ["https://www.legislation.gov.au/Details/C2020C00348"] },
    { productIndex: 1, framework: "HL7 FHIR", requirement: "FHIR R4 Clinical Decision Support", description: "CDS Hooks integration standard for clinical decision support interoperability", status: "PENDING", evidenceLinks: [] },
    { productIndex: 1, framework: "NIST", requirement: "NIST AI RMF 1.0 — AI Risk Management", description: "Risk management framework for AI-based clinical decision support systems", status: "REMEDIATION", evidenceLinks: ["https://www.nist.gov/artificial-intelligence/ai-risk-management-framework"] },
    { productIndex: 2, framework: "Australian Privacy Act", requirement: "APP 11 — Security of Personal Information", description: "Security measures for patient data collected during telehealth consultations", status: "COMPLIANT", evidenceLinks: ["https://www.oaic.gov.au/privacy/australian-privacy-principles"] },
    { productIndex: 2, framework: "HIPAA", requirement: "45 CFR §164.312(e) — Transmission Security", description: "Encryption requirements for telehealth video and audio transmission of PHI", status: "COMPLIANT", evidenceLinks: ["https://www.hhs.gov/hipaa/for-professionals/security/guidance/index.html"] },
  ],
  productReadiness: [
    { readinessScore: 6.0, factors: [{ name: "Technical Debt", score: 5.0 }, { name: "Team Readiness", score: 7.0 }, { name: "Data Quality", score: 5.5 }, { name: "Infrastructure", score: 6.5 }], migrationSteps: [{ phase: "Assessment", description: "Audit existing patient record schemas across 12 facility systems", status: "completed", estimatedDuration: "4 weeks" }, { phase: "Data Modeling", description: "Design FHIR R4-compliant unified patient resource model", status: "completed", estimatedDuration: "3 weeks" }, { phase: "Data Migration", description: "Migrate legacy HL7v2 records to FHIR data store with reconciliation", status: "in-progress", estimatedDuration: "12 weeks" }, { phase: "Integration Testing", description: "Cross-facility interoperability testing with all connected systems", status: "pending", estimatedDuration: "6 weeks" }], gateApproved: false, blockers: ["HIPAA PHI risk assessment pending completion", "3 of 12 facility data migration mappings incomplete"] },
    { readinessScore: 7.5, factors: [{ name: "Technical Debt", score: 7.0 }, { name: "Team Readiness", score: 8.5 }, { name: "Data Quality", score: 7.0 }, { name: "Infrastructure", score: 7.5 }], migrationSteps: [{ phase: "Assessment", description: "Evaluate clinical evidence base and alert rule inventory", status: "completed", estimatedDuration: "2 weeks" }, { phase: "Model Training", description: "Train clinical NLP and diagnostic models on de-identified datasets", status: "completed", estimatedDuration: "8 weeks" }, { phase: "Validation", description: "Clinical validation study with partner hospitals", status: "in-progress", estimatedDuration: "6 weeks" }, { phase: "TGA Submission", description: "Prepare and submit TGA Class IIa medical device application", status: "pending", estimatedDuration: "8 weeks" }], gateApproved: true, blockers: [] },
    { readinessScore: 8.3, factors: [{ name: "Technical Debt", score: 8.0 }, { name: "Team Readiness", score: 8.5 }, { name: "Data Quality", score: 8.0 }, { name: "Infrastructure", score: 8.5 }], migrationSteps: [{ phase: "Assessment", description: "Evaluate existing telehealth tools and patient satisfaction data", status: "completed", estimatedDuration: "2 weeks" }, { phase: "Platform Build", description: "Build integrated virtual care platform with EHR connectivity", status: "completed", estimatedDuration: "10 weeks" }, { phase: "Pilot", description: "Pilot deployment with 3 rural health facilities", status: "in-progress", estimatedDuration: "4 weeks" }, { phase: "Rollout", description: "Phased national rollout to all connected facilities", status: "pending", estimatedDuration: "6 weeks" }], gateApproved: true, blockers: [] },
  ],
  futureState: {
    automationMix: [
      { productName: "HealthConnect EHR", rpa: 25, aiMl: 25, agentBased: 20, conversational: 10, analytics: 20 },
      { productName: "ClinicalAI Assistant", rpa: 10, aiMl: 40, agentBased: 15, conversational: 20, analytics: 15 },
      { productName: "TeleCare Suite", rpa: 20, aiMl: 20, agentBased: 25, conversational: 25, analytics: 10 },
    ],
    currentSteps: [
      { name: "Patient Registration", type: "manual", duration: 5 },
      { name: "Record Retrieval", type: "manual", duration: 4 },
      { name: "Data Reconciliation", type: "manual", duration: 6 },
      { name: "Clinical Review", type: "manual", duration: 3 },
      { name: "Record Update", type: "manual", duration: 2 },
    ],
    futureSteps: [
      { name: "Auto Registration", type: "agent", duration: 0.5 },
      { name: "Smart Record Fetch", type: "automated", duration: 0.1 },
      { name: "AI Reconciliation", type: "ai", duration: 0.3 },
      { name: "AI-Assisted Review", type: "ai", duration: 0.5 },
      { name: "Auto Record Sync", type: "automated", duration: 0.1 },
    ],
    capabilities: [
      { name: "Intelligent Patient Matching", category: "AI_ML_INTEGRATION", businessImpact: "HIGH", complexity: "HIGH", techStack: ["TensorFlow", "FHIR R4", "Azure ML"], description: "AI-powered patient identity matching across facilities using probabilistic linkage and NLP", reach: 9, impact: 10, confidence: 0.5, effort: 9, riceScore: 5.0 },
      { name: "Autonomous Clinical Alerting", category: "AGENT_BASED", businessImpact: "HIGH", complexity: "HIGH", techStack: ["LangGraph", "Python", "HL7 FHIR"], description: "Multi-agent clinical monitoring system with context-aware alert prioritization", reach: 7, impact: 9, confidence: 0.6, effort: 7, riceScore: 5.4 },
      { name: "Virtual Health Assistant", category: "CONVERSATIONAL_AI", businessImpact: "MEDIUM", complexity: "MEDIUM", techStack: ["GPT-4", "LangChain", "React"], description: "Conversational AI for patient intake, symptom triage, and appointment scheduling", reach: 8, impact: 6, confidence: 0.7, effort: 4, riceScore: 8.4 },
      { name: "Population Health Analytics", category: "ADVANCED_ANALYTICS", businessImpact: "HIGH", complexity: "MEDIUM", techStack: ["Apache Spark", "Power BI", "FHIR Analytics"], description: "Real-time population health dashboards with predictive disease outbreak modeling", reach: 9, impact: 8, confidence: 0.7, effort: 5, riceScore: 10.08 },
      { name: "Clinical Document Automation", category: "RPA_AUTOMATION", businessImpact: "MEDIUM", complexity: "LOW", techStack: ["UiPath", "Azure Form Recognizer", "C#"], description: "Automated extraction and filing of clinical documents, referrals, and discharge summaries", reach: 7, impact: 5, confidence: 0.9, effort: 2, riceScore: 15.75 },
    ],
    productStreams: {
      "HealthConnect EHR": {
        currentSteps: [
          { name: "Patient Registration", type: "manual", duration: 5 },
          { name: "Record Retrieval", type: "manual", duration: 4 },
          { name: "Data Reconciliation", type: "manual", duration: 6 },
          { name: "Clinical Review", type: "manual", duration: 3 },
          { name: "Record Update", type: "manual", duration: 2 },
        ],
        futureSteps: [
          { name: "Auto Registration", type: "agent", duration: 0.5 },
          { name: "Smart Record Fetch", type: "automated", duration: 0.1 },
          { name: "AI Reconciliation", type: "ai", duration: 0.3 },
          { name: "AI-Assisted Review", type: "ai", duration: 0.5 },
          { name: "Auto Record Sync", type: "automated", duration: 0.1 },
        ],
      },
      "ClinicalAI Assistant": {
        currentSteps: [
          { name: "Clinical Query Entry", type: "manual", duration: 3 },
          { name: "Evidence Lookup", type: "manual", duration: 6 },
          { name: "Drug Interaction Check", type: "manual", duration: 4 },
          { name: "Diagnosis Formulation", type: "manual", duration: 5 },
          { name: "Alert Documentation", type: "manual", duration: 2 },
        ],
        futureSteps: [
          { name: "NLP Query Processing", type: "ai", duration: 0.2 },
          { name: "AI Evidence Retrieval", type: "ai", duration: 0.3 },
          { name: "Auto Drug Safety Check", type: "automated", duration: 0.1 },
          { name: "AI Diagnostic Support", type: "ai", duration: 0.5 },
          { name: "Auto Alert Generation", type: "agent", duration: 0.2 },
        ],
      },
      "TeleCare Suite": {
        currentSteps: [
          { name: "Appointment Request", type: "manual", duration: 3 },
          { name: "Triage Assessment", type: "manual", duration: 5 },
          { name: "Provider Matching", type: "manual", duration: 2 },
          { name: "Consultation Setup", type: "manual", duration: 4 },
          { name: "Post-Visit Notes", type: "manual", duration: 3 },
        ],
        futureSteps: [
          { name: "AI Triage Bot", type: "agent", duration: 0.3 },
          { name: "Auto Priority Scoring", type: "ai", duration: 0.2 },
          { name: "Smart Scheduling", type: "automated", duration: 0.1 },
          { name: "Video Consultation", type: "automated", duration: 0.1 },
          { name: "AI Clinical Notes", type: "ai", duration: 0.3 },
        ],
      },
    },
  },
  architecture: {
    current_architecture: "Monolithic C# application on IIS with SQL Server backend. Tightly coupled modules for EHR, clinical decision support, and telehealth. Legacy HL7v2 interfaces for hospital integrations. On-premises deployment across multiple hospital data centers.",
    target_architecture: "Cloud-native microservices on Azure AKS with FHIR R4-native data layer. Event-driven architecture using Azure Service Bus. Separate domains for clinical records, AI/ML, and virtual care with FHIR-based interoperability.",
    migration_plan: "Phase 1: FHIR R4 data model migration and API gateway deployment (Q1-Q2). Phase 2: Clinical AI microservices extraction to Azure ML (Q2-Q3). Phase 3: Telehealth platform modernization with WebRTC (Q3-Q4). Phase 4: Legacy HL7v2 deprecation and full cloud migration (Q1 next year).",
    architecture_diagrams: {
      functional: "graph TD\n  A[Clinical Users] --> B[FHIR API Gateway]\n  B --> C[EHR Service]\n  B --> D[Clinical AI Service]\n  B --> E[Telehealth Service]\n  C --> F[Patient Records]\n  C --> G[Lab Integration]\n  D --> H[NLP Engine]\n  D --> I[Diagnostic Models]\n  E --> J[Video Platform]\n  E --> K[Remote Monitoring]\n  F --> L[(FHIR Data Store)]\n  H --> M[(ML Model Registry)]",
      technical: "graph TD\n  A[Azure AKS Cluster] --> B[Istio Service Mesh]\n  B --> C[.NET 8 Services]\n  C --> D[Azure Service Bus]\n  D --> E[Event Processors]\n  C --> F[Azure SQL - FHIR]\n  C --> G[Azure Cache for Redis]\n  E --> H[Azure ML]\n  C --> I[Azure Blob Storage]\n  A --> J[Azure Front Door]\n  J --> K[Azure CDN]",
      solution: "graph TD\n  A[Clinical Portal/Mobile] --> B[Azure API Management]\n  B --> C{FHIR Router}\n  C --> D[EHR Microservice]\n  C --> E[Clinical AI Microservice]\n  C --> F[Telehealth Microservice]\n  D --> G[Azure SQL - Clinical]\n  E --> H[Azure SQL - Analytics]\n  F --> I[Azure SQL - Telehealth]\n  D & E & F --> J[Service Bus]\n  J --> K[Analytics Pipeline]\n  K --> L[Azure Synapse]",
      products: {
        "HealthConnect EHR": {
          solution: "graph LR\n  subgraph Personas\n    P1[Clinician]\n    P2[Patient]\n    P3[Admin]\n  end\n  subgraph Agentic Workstreams\n    A1[Patient Hub Agent]\n    A2[Clinical Coding Agent]\n    A3[Referral Agent]\n  end\n  subgraph Integrations\n    S1[FHIR Data Store]\n    S2[Lab Systems]\n    S3[Pharmacy Network]\n  end\n  P1 --> A1\n  P2 --> A1\n  P3 --> A3\n  A1 --> S1\n  A2 --> S2\n  A3 --> S3\n  A1 --> A2\n  A2 --> A3",
          technical: "graph TD\n  subgraph Infrastructure\n    I1[Azure AKS]\n    I2[SQL Server]\n    I3[Azure Blob]\n  end\n  subgraph Platform\n    P1[FHIR R4 Server]\n    P2[Azure Service Bus]\n    P3[Redis Cache]\n  end\n  subgraph Application\n    AP1[EHR Services]\n    AP2[Integration Engine]\n    AP3[Clinical Portal]\n  end\n  I1 --> P1\n  I2 --> P1\n  P1 --> AP1\n  P2 --> AP2\n  P3 --> AP3\n  AP1 --> P2\n  AP2 --> AP3",
          sequence: "sequenceDiagram\n  participant C as Clinician\n  participant PH as Patient Hub\n  participant LO as Lab Order\n  participant RP as Result Processing\n  participant CD as Clinical Documentation\n  C->>PH: Open Patient Record\n  PH->>LO: Place Lab Order\n  LO->>RP: Process Results\n  RP-->>PH: Update Patient Record\n  PH->>CD: Generate Clinical Notes\n  CD-->>C: Notes Ready for Review",
        },
        "ClinicalAI Assistant": {
          solution: "graph LR\n  subgraph Personas\n    P1[Doctor]\n    P2[Nurse]\n    P3[Pharmacist]\n  end\n  subgraph Agentic Workstreams\n    A1[Diagnostic AI Agent]\n    A2[Drug Safety Agent]\n    A3[Predictive Agent]\n  end\n  subgraph Systems\n    S1[Evidence Base]\n    S2[Alert System]\n    S3[Clinical Registry]\n  end\n  P1 --> A1\n  P2 --> A3\n  P3 --> A2\n  A1 --> S1\n  A2 --> S2\n  A3 --> S3\n  A1 --> A2\n  A2 --> A3",
          technical: "graph TD\n  subgraph Infrastructure\n    I1[Azure ML]\n    I2[GPU Nodes]\n    I3[Azure Data Lake]\n  end\n  subgraph Platform\n    P1[NLP Engine]\n    P2[Model Registry]\n    P3[Feature Pipeline]\n  end\n  subgraph Application\n    AP1[Clinical Insights API]\n    AP2[Alert Generator]\n    AP3[Evidence Search]\n  end\n  I1 --> P1\n  I2 --> P2\n  P1 --> AP1\n  P2 --> AP1\n  P3 --> AP2\n  AP1 --> AP2\n  AP2 --> AP3",
          sequence: "sequenceDiagram\n  participant D as Doctor\n  participant CQ as Clinical Query\n  participant NLP as NLP Engine\n  participant ER as Evidence Retrieval\n  participant DS as Diagnostic Support\n  participant AG as Alert Generation\n  D->>CQ: Submit Clinical Query\n  CQ->>NLP: Process Natural Language\n  NLP->>ER: Search Evidence Base\n  ER-->>DS: Return Matches\n  DS->>AG: Generate Alerts\n  AG-->>D: Display Recommendations",
        },
        "TeleCare Suite": {
          solution: "graph LR\n  subgraph Personas\n    P1[Patient]\n    P2[Provider]\n    P3[Care Admin]\n  end\n  subgraph Agentic Workstreams\n    A1[Triage Agent]\n    A2[Scheduling Agent]\n    A3[Monitoring Agent]\n  end\n  subgraph Integrations\n    S1[Video Platform]\n    S2[ePrescribing]\n    S3[RPM Devices]\n  end\n  P1 --> A1\n  P2 --> A2\n  P3 --> A3\n  A1 --> S1\n  A2 --> S1\n  A3 --> S3\n  A1 --> A2\n  A2 --> A3",
          technical: "graph TD\n  subgraph Infrastructure\n    I1[Azure AKS]\n    I2[WebRTC Gateway]\n    I3[IoT Hub]\n  end\n  subgraph Platform\n    P1[Azure Service Bus]\n    P2[FHIR R4]\n    P3[SignalR]\n  end\n  subgraph Application\n    AP1[Telehealth Services]\n    AP2[Monitoring Dashboard]\n    AP3[ePrescription API]\n  end\n  I1 --> P1\n  I2 --> AP1\n  P1 --> AP1\n  P2 --> AP2\n  P3 --> AP1\n  AP1 --> AP2\n  AP2 --> AP3",
          sequence: "sequenceDiagram\n  participant P as Patient\n  participant TE as Triage Engine\n  participant AS as Auto-Scheduling\n  participant VC as Video Consultation\n  participant CN as Clinical Notes\n  participant EP as ePrescription\n  P->>TE: Request Consultation\n  TE->>AS: Determine Priority\n  AS-->>P: Appointment Confirmed\n  P->>VC: Join Video Call\n  VC->>CN: Generate Clinical Notes\n  CN->>EP: Issue ePrescription\n  EP-->>P: Prescription Sent",
        },
      },
    },
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// Organization 3: ING Bank
// ═══════════════════════════════════════════════════════════════════════════════

const ING_BANK: OrgSeedData = {
  org: {
    name: "ING Bank",
    slug: "ing-bank",
    industryType: "Banking / Financial Services (European)",
    description: "Dutch multinational banking and financial services corporation offering retail, wholesale, and direct banking across 40+ countries with a focus on digital-first banking.",
    competitors: ["ABN AMRO", "Rabobank", "Deutsche Bank"],
    businessSegments: ["Retail Banking", "Wholesale Banking", "Direct Banking Platform"],
    regulatoryFrameworks: ["PSD2", "MiFID II", "GDPR", "EBA", "DORA", "Basel III"],
    personas: [
      { type: "FRONT_OFFICE", name: "Relationship Manager", responsibilities: ["Client advisory services", "Portfolio recommendation delivery", "Cross-sell opportunity identification"] },
      { type: "MIDDLE_OFFICE", name: "Risk & Compliance Analyst", responsibilities: ["Regulatory reporting oversight", "Risk model validation", "Compliance framework monitoring"] },
      { type: "BACK_OFFICE", name: "Platform Engineer", responsibilities: ["API gateway operations", "Infrastructure reliability", "Deployment pipeline management"] },
    ],
  },
  repo: {
    name: "ing-digital-platform",
    url: "https://github.com/ing-bank/digital-platform",
    description: "ING digital banking platform powering accounts, investments, and regulatory reporting",
    language: "Kotlin",
  },
  products: [
    {
      name: "ING Direct App",
      description: "Mobile-first direct banking application with open banking integrations and real-time account aggregation",
      currentState: "Monolithic mobile app with limited API exposure and manual TPP onboarding process",
      futureState: "API-first mobile platform with real-time account aggregation, PSD2 consent dashboard, and embedded finance capabilities",
      businessSegment: "Retail Banking",
      capabilities: [
        { name: "Open Banking API Gateway", description: "PSD2-compliant open banking API gateway with consent management", category: "Open Banking", functionalities: [
          { name: "API Request Handler", description: "RESTful API endpoint management with rate limiting and throttling", sourceFiles: ["src/main/kotlin/com/ing/accounts/api/RequestHandler.kt"] },
          { name: "OAuth Provider", description: "OAuth 2.0 authorization server with PKCE support", sourceFiles: ["src/main/kotlin/com/ing/accounts/api/OAuthProvider.kt"] },
          { name: "Consent Manager", description: "PSD2 granular consent lifecycle management", sourceFiles: ["src/main/kotlin/com/ing/accounts/api/ConsentManager.kt"] },
          { name: "TPP Onboarding", description: "Third-party provider registration and certification", sourceFiles: ["src/main/kotlin/com/ing/accounts/api/TppOnboarding.kt"] },
        ]},
        { name: "Account Lifecycle", description: "End-to-end account lifecycle management", category: "Retail Banking", functionalities: [
          { name: "Account Opening", description: "Digital account opening with eKYC verification", sourceFiles: ["src/main/kotlin/com/ing/accounts/lifecycle/AccountOpening.kt"] },
          { name: "Account Closure", description: "Account closure workflow with fund transfer handling", sourceFiles: ["src/main/kotlin/com/ing/accounts/lifecycle/AccountClosure.kt"] },
          { name: "KYC Refresh", description: "Periodic KYC refresh with risk-based scheduling", sourceFiles: ["src/main/kotlin/com/ing/accounts/lifecycle/KycRefresh.kt"] },
          { name: "Account Migration", description: "Inter-bank account migration per EU switching regulation", sourceFiles: ["src/main/kotlin/com/ing/accounts/lifecycle/AccountMigration.kt"] },
        ]},
        { name: "Multi-Currency Support", description: "Multi-currency account management with FX services", category: "Retail Banking", functionalities: [
          { name: "Currency Engine", description: "Multi-currency account balance management and display", sourceFiles: ["src/main/kotlin/com/ing/accounts/currency/CurrencyEngine.kt"] },
          { name: "FX Rate Service", description: "Real-time FX rate provisioning with margin management", sourceFiles: ["src/main/kotlin/com/ing/accounts/currency/FxRateService.kt"] },
          { name: "Cross-Border Transfers", description: "SEPA and SWIFT cross-border transfer processing", sourceFiles: ["src/main/kotlin/com/ing/accounts/currency/CrossBorderTransfer.kt"] },
        ]},
        { name: "Digital Identity", description: "Digital identity and authentication services", category: "Security", functionalities: [
          { name: "Biometric Auth", description: "Fingerprint and Face ID authentication integration", sourceFiles: ["src/main/kotlin/com/ing/accounts/identity/BiometricAuth.kt"] },
          { name: "Digital ID Verification", description: "NFC passport and ID document verification", sourceFiles: ["src/main/kotlin/com/ing/accounts/identity/DigitalIdVerifier.kt"] },
          { name: "Session Manager", description: "Secure session management with device binding", sourceFiles: ["src/main/kotlin/com/ing/accounts/identity/SessionManager.kt"] },
        ]},
        { name: "Card Management", description: "Physical and virtual card management", category: "Retail Banking", functionalities: [
          { name: "Card Issuance", description: "Physical and virtual card issuance with instant activation", sourceFiles: ["src/main/kotlin/com/ing/accounts/cards/CardIssuance.kt"] },
          { name: "PIN Management", description: "Secure PIN setting and change via mobile app", sourceFiles: ["src/main/kotlin/com/ing/accounts/cards/PinManager.kt"] },
          { name: "Contactless Config", description: "Contactless payment limit and preference configuration", sourceFiles: ["src/main/kotlin/com/ing/accounts/cards/ContactlessConfig.kt"] },
          { name: "Dispute Handling", description: "Card transaction dispute initiation and tracking", sourceFiles: ["src/main/kotlin/com/ing/accounts/cards/DisputeHandler.kt"] },
        ]},
        { name: "Push Notifications", description: "Real-time push notification service", category: "Platform", functionalities: [
          { name: "Notification Engine", description: "Multi-channel notification dispatch with priority routing", sourceFiles: ["src/main/kotlin/com/ing/accounts/notifications/NotificationEngine.kt"] },
          { name: "Preference Manager", description: "User notification preference management", sourceFiles: ["src/main/kotlin/com/ing/accounts/notifications/PreferenceManager.kt"] },
          { name: "Delivery Tracker", description: "Notification delivery tracking and retry management", sourceFiles: ["src/main/kotlin/com/ing/accounts/notifications/DeliveryTracker.kt"] },
        ]},
        { name: "Personal Finance Manager", description: "AI-powered personal finance management tools", category: "Retail Banking", functionalities: [
          { name: "Spending Categorization", description: "ML-based transaction categorization with merchant mapping", sourceFiles: ["src/main/kotlin/com/ing/accounts/pfm/SpendingCategorizer.kt"] },
          { name: "Budget Tracking", description: "Category-based budget setting and tracking with alerts", sourceFiles: ["src/main/kotlin/com/ing/accounts/pfm/BudgetTracker.kt"] },
          { name: "Savings Goals", description: "Automated savings goal management with round-up rules", sourceFiles: ["src/main/kotlin/com/ing/accounts/pfm/SavingsGoals.kt"] },
        ]},
        { name: "Customer Support AI", description: "AI-powered customer support chatbot", category: "Customer Service", functionalities: [
          { name: "Chatbot Engine", description: "NLU-powered conversational chatbot for banking queries", sourceFiles: ["src/main/kotlin/com/ing/accounts/support/ChatbotEngine.kt"] },
          { name: "Ticket Routing", description: "Intelligent support ticket routing based on intent", sourceFiles: ["src/main/kotlin/com/ing/accounts/support/TicketRouter.kt"] },
          { name: "Knowledge Base Integration", description: "Dynamic knowledge base retrieval for FAQ resolution", sourceFiles: ["src/main/kotlin/com/ing/accounts/support/KnowledgeBase.kt"] },
        ]},
        { name: "Loyalty Program", description: "Customer loyalty and rewards management", category: "Customer Engagement", functionalities: [
          { name: "Points Engine", description: "Points accrual and redemption engine with tier management", sourceFiles: ["src/main/kotlin/com/ing/accounts/loyalty/PointsEngine.kt"] },
          { name: "Reward Catalog", description: "Rewards catalog management with partner offers", sourceFiles: ["src/main/kotlin/com/ing/accounts/loyalty/RewardCatalog.kt"] },
          { name: "Partner Integration", description: "Loyalty partner integration and offer syndication", sourceFiles: ["src/main/kotlin/com/ing/accounts/loyalty/PartnerIntegration.kt"] },
        ]},
      ],
      group: { name: "Account Services", description: "Account opening, servicing, and open banking API management" },
      steps: [
        { name: "API Request Reception", stepOrder: 1, stepType: "process" },
        { name: "OAuth/Token Validation", stepOrder: 2, stepType: "process" },
        { name: "Consent Verification", stepOrder: 3, stepType: "decision" },
        { name: "Account Data Retrieval", stepOrder: 4, stepType: "process" },
        { name: "PSD2 Compliance Check", stepOrder: 5, stepType: "decision" },
        { name: "API Response Delivery", stepOrder: 6, stepType: "process" },
      ],
      vsm: { processTime: 2.0, leadTime: 12.0, waitTime: 10.0, flowEfficiency: 16.67, mermaidSource: `graph LR
    A[API Request Received]:::value --> B[OAuth Validation]:::value
    B --> C{Consent Verification}:::bottleneck
    C -->|Valid| D[Account Data Retrieval]:::value
    C -->|Expired| E[Re-consent Flow]:::waste
    C -->|Denied| F[Access Denied Response]:::value
    D --> G[Data Transformation]:::value
    G --> H[PSD2 Compliance Check]:::bottleneck
    H --> I[API Response]:::value

    classDef value fill:#22c55e,stroke:#16a34a,color:#fff
    classDef bottleneck fill:#f59e0b,stroke:#d97706,color:#fff
    classDef waste fill:#ef4444,stroke:#dc2626,color:#fff` },
    },
    {
      name: "Smart Invest",
      businessSegment: "Wholesale Banking",
      description: "Robo-advisory investment platform with AI-powered portfolio management and MiFID II compliance",
      currentState: "Advisor-led investment process with manual suitability assessments and quarterly portfolio reviews",
      futureState: "Fully automated robo-advisory with real-time portfolio optimization, AI risk profiling, and continuous MiFID II compliance monitoring",
      capabilities: [
        { name: "Robo-Advisory Engine", description: "AI-driven investment advisory with automated portfolio optimization", category: "Wealth Management", functionalities: [
          { name: "Risk Profiler", description: "Multi-factor client risk profiling with behavioral analysis", sourceFiles: ["src/main/kotlin/com/ing/invest/robo/RiskProfiler.kt"] },
          { name: "Portfolio Optimizer", description: "Mean-variance portfolio optimization with constraints", sourceFiles: ["src/main/kotlin/com/ing/invest/robo/PortfolioOptimizer.kt"] },
          { name: "Rebalancing Engine", description: "Tax-aware automated portfolio rebalancing", sourceFiles: ["src/main/kotlin/com/ing/invest/robo/RebalancingEngine.kt"] },
        ]},
        { name: "MiFID Compliance", description: "MiFID II regulatory compliance for investment services", category: "Compliance", functionalities: [
          { name: "Suitability Checker", description: "Real-time MiFID II suitability assessment", sourceFiles: ["src/main/kotlin/com/ing/invest/mifid/SuitabilityChecker.kt"] },
          { name: "Cost Disclosure Generator", description: "Automated ex-ante and ex-post cost disclosure", sourceFiles: ["src/main/kotlin/com/ing/invest/mifid/CostDisclosure.kt"] },
          { name: "Record Keeper", description: "MiFID II record keeping with 5-year retention", sourceFiles: ["src/main/kotlin/com/ing/invest/mifid/RecordKeeper.kt"] },
          { name: "Reporting Module", description: "MiFID II transaction and position reporting", sourceFiles: ["src/main/kotlin/com/ing/invest/mifid/ReportingModule.kt"] },
        ]},
        { name: "Market Data Service", description: "Real-time and historical market data provision", category: "Market Data", functionalities: [
          { name: "Real-Time Feed", description: "Low-latency market data feed with websocket streaming", sourceFiles: ["src/main/kotlin/com/ing/invest/market/RealTimeFeed.kt"] },
          { name: "Historical Data Store", description: "Historical price and volume data with adjustments", sourceFiles: ["src/main/kotlin/com/ing/invest/market/HistoricalStore.kt"] },
          { name: "Index Calculator", description: "Custom index and benchmark calculation engine", sourceFiles: ["src/main/kotlin/com/ing/invest/market/IndexCalculator.kt"] },
        ]},
        { name: "Order Management", description: "Investment order lifecycle management", category: "Trading", functionalities: [
          { name: "Order Router", description: "Smart order routing across execution venues", sourceFiles: ["src/main/kotlin/com/ing/invest/orders/OrderRouter.kt"] },
          { name: "Execution Engine", description: "Order execution with best execution compliance", sourceFiles: ["src/main/kotlin/com/ing/invest/orders/ExecutionEngine.kt"] },
          { name: "Settlement Handler", description: "T+2 settlement processing with CSDs", sourceFiles: ["src/main/kotlin/com/ing/invest/orders/SettlementHandler.kt"] },
        ]},
        { name: "Portfolio Analytics", description: "Advanced portfolio performance and risk analytics", category: "Analytics", functionalities: [
          { name: "Performance Attribution", description: "Multi-factor performance attribution analysis", sourceFiles: ["src/main/kotlin/com/ing/invest/analytics/PerformanceAttribution.kt"] },
          { name: "Risk Decomposition", description: "Portfolio risk decomposition with VaR and CVaR", sourceFiles: ["src/main/kotlin/com/ing/invest/analytics/RiskDecomposition.kt"] },
          { name: "Benchmark Comparison", description: "Portfolio vs benchmark comparison reporting", sourceFiles: ["src/main/kotlin/com/ing/invest/analytics/BenchmarkComparison.kt"] },
        ]},
        { name: "Client Reporting", description: "Automated client reporting and statement generation", category: "Reporting", functionalities: [
          { name: "Statement Generator", description: "Periodic portfolio statement generation in multiple formats", sourceFiles: ["src/main/kotlin/com/ing/invest/reporting/StatementGenerator.kt"] },
          { name: "Tax Report Builder", description: "Tax-optimized reporting for multiple jurisdictions", sourceFiles: ["src/main/kotlin/com/ing/invest/reporting/TaxReportBuilder.kt"] },
          { name: "Custom Dashboard", description: "Client-configurable investment dashboard", sourceFiles: ["src/main/kotlin/com/ing/invest/reporting/CustomDashboard.kt"] },
        ]},
        { name: "ESG Integration", description: "ESG scoring and sustainable investment tools", category: "Wealth Management", functionalities: [
          { name: "ESG Scoring", description: "Multi-provider ESG scoring aggregation and normalization", sourceFiles: ["src/main/kotlin/com/ing/invest/esg/EsgScoring.kt"] },
          { name: "Impact Reporting", description: "ESG impact reporting with carbon footprint tracking", sourceFiles: ["src/main/kotlin/com/ing/invest/esg/ImpactReporting.kt"] },
          { name: "Sustainable Fund Screening", description: "Sustainable fund screening with exclusion criteria", sourceFiles: ["src/main/kotlin/com/ing/invest/esg/FundScreening.kt"] },
        ]},
        { name: "Research & Insights", description: "Investment research and market insights platform", category: "Wealth Management", functionalities: [
          { name: "Market Commentary", description: "AI-generated daily market commentary and analysis", sourceFiles: ["src/main/kotlin/com/ing/invest/research/MarketCommentary.kt"] },
          { name: "AI Stock Screener", description: "ML-powered stock screening with custom criteria", sourceFiles: ["src/main/kotlin/com/ing/invest/research/StockScreener.kt"] },
          { name: "Sector Analysis", description: "Automated sector rotation analysis and recommendations", sourceFiles: ["src/main/kotlin/com/ing/invest/research/SectorAnalysis.kt"] },
        ]},
      ],
      group: { name: "Investment Operations", description: "Risk profiling, portfolio construction, and investment execution workflow" },
      steps: [
        { name: "Client Risk Profiling", stepOrder: 1, stepType: "process" },
        { name: "Portfolio Analysis", stepOrder: 2, stepType: "process" },
        { name: "AI Recommendation", stepOrder: 3, stepType: "process" },
        { name: "MiFID Suitability Check", stepOrder: 4, stepType: "decision" },
        { name: "Client Presentation", stepOrder: 5, stepType: "process" },
        { name: "Client Decision Wait", stepOrder: 6, stepType: "wait" },
        { name: "Order Execution", stepOrder: 7, stepType: "process" },
        { name: "Settlement & Reporting", stepOrder: 8, stepType: "process" },
      ],
      vsm: { processTime: 3.0, leadTime: 72.0, waitTime: 69.0, flowEfficiency: 4.17, mermaidSource: `graph LR
    A[Client Risk Profiling]:::value --> B[Portfolio Analysis]:::value
    B --> C[AI Recommendation Engine]:::value
    C --> D{MiFID Suitability Check}:::bottleneck
    D -->|Suitable| E[Client Presentation]:::value
    D -->|Unsuitable| F[Alternative Generation]:::waste
    F --> C
    E --> G{Client Decision}:::bottleneck
    G -->|Accept| H[Order Execution]:::value
    G -->|Modify| I[Advisor Review]:::waste
    I --> C
    H --> J[Settlement & Reporting]:::value

    classDef value fill:#22c55e,stroke:#16a34a,color:#fff
    classDef bottleneck fill:#f59e0b,stroke:#d97706,color:#fff
    classDef waste fill:#ef4444,stroke:#dc2626,color:#fff` },
    },
    {
      name: "RegReporter Pro",
      description: "Automated regulatory reporting platform for European banking compliance submissions",
      currentState: "Semi-manual report generation with Excel-based data preparation and manual regulator portal submissions",
      futureState: "Fully automated reporting pipeline with AI data quality checks, multi-format generation, and direct API submission to regulators",
      businessSegment: "Direct Banking Platform",
      capabilities: [
        { name: "RegTech Automation", description: "Core regulatory technology automation engine", category: "Regulatory Technology", functionalities: [
          { name: "Data Extraction Pipeline", description: "Automated data extraction from source systems with mapping rules", sourceFiles: ["src/main/kotlin/com/ing/regtech/automation/DataExtractor.kt"] },
          { name: "Validation Rules Engine", description: "EBA validation rules implementation with cross-report checks", sourceFiles: ["src/main/kotlin/com/ing/regtech/automation/ValidationEngine.kt"] },
          { name: "Multi-Format Generator", description: "Report generation supporting XBRL, XML, CSV, and PDF", sourceFiles: ["src/main/kotlin/com/ing/regtech/automation/FormatGenerator.kt"] },
        ]},
        { name: "COREP Reporting", description: "Common Reporting framework for capital adequacy reporting", category: "Regulatory Technology", functionalities: [
          { name: "Capital Adequacy Module", description: "CET1, AT1, T2 capital calculation with RWA computation", sourceFiles: ["src/main/kotlin/com/ing/regtech/corep/CapitalAdequacy.kt"] },
          { name: "Large Exposure Calculator", description: "Large exposure limit monitoring with counterparty aggregation", sourceFiles: ["src/main/kotlin/com/ing/regtech/corep/LargeExposure.kt"] },
          { name: "Leverage Ratio Engine", description: "Leverage ratio calculation with exposure measure computation", sourceFiles: ["src/main/kotlin/com/ing/regtech/corep/LeverageRatio.kt"] },
        ]},
        { name: "FINREP Reporting", description: "Financial Reporting for IFRS-based financial statements", category: "Regulatory Technology", functionalities: [
          { name: "Financial Statement Mapper", description: "GL to FINREP template mapping with account classification", sourceFiles: ["src/main/kotlin/com/ing/regtech/finrep/StatementMapper.kt"] },
          { name: "IFRS Converter", description: "IFRS 9 classification and measurement conversion", sourceFiles: ["src/main/kotlin/com/ing/regtech/finrep/IfrsConverter.kt"] },
          { name: "Balance Sheet Validator", description: "Automated balance sheet validation with variance analysis", sourceFiles: ["src/main/kotlin/com/ing/regtech/finrep/BalanceSheetValidator.kt"] },
        ]},
        { name: "AnaCredit", description: "ECB granular loan-level credit data reporting", category: "Regulatory Technology", functionalities: [
          { name: "Loan-Level Data Collector", description: "Granular loan-level data collection with attribute mapping", sourceFiles: ["src/main/kotlin/com/ing/regtech/anacredit/LoanDataCollector.kt"] },
          { name: "Counterparty Enrichment", description: "Counterparty reference data enrichment with LEI lookup", sourceFiles: ["src/main/kotlin/com/ing/regtech/anacredit/CounterpartyEnrichment.kt"] },
          { name: "ECB Submission Handler", description: "Automated AnaCredit submission to ECB via RIAD portal", sourceFiles: ["src/main/kotlin/com/ing/regtech/anacredit/EcbSubmission.kt"] },
        ]},
        { name: "Data Quality Engine", description: "Comprehensive data quality management with lineage tracking", category: "Data Management", functionalities: [
          { name: "Schema Validator", description: "Regulatory taxonomy schema validation with version management", sourceFiles: ["src/main/kotlin/com/ing/regtech/quality/SchemaValidator.kt"] },
          { name: "Anomaly Detector", description: "Statistical anomaly detection with trend analysis", sourceFiles: ["src/main/kotlin/com/ing/regtech/quality/AnomalyDetector.kt"] },
          { name: "Reconciliation Engine", description: "Multi-source data reconciliation with break resolution", sourceFiles: ["src/main/kotlin/com/ing/regtech/quality/ReconciliationEngine.kt"] },
          { name: "Data Lineage Tracker", description: "End-to-end data lineage from source to regulatory submission", sourceFiles: ["src/main/kotlin/com/ing/regtech/quality/DataLineage.kt"] },
        ]},
        { name: "Regulatory Calendar", description: "Regulatory reporting deadline and submission calendar", category: "Operations", functionalities: [
          { name: "Deadline Manager", description: "Multi-jurisdiction regulatory deadline management", sourceFiles: ["src/main/kotlin/com/ing/regtech/calendar/DeadlineManager.kt"] },
          { name: "Submission Scheduler", description: "Automated report submission scheduling with dependencies", sourceFiles: ["src/main/kotlin/com/ing/regtech/calendar/SubmissionScheduler.kt"] },
          { name: "Reminder System", description: "Multi-channel reminder with escalation for approaching deadlines", sourceFiles: ["src/main/kotlin/com/ing/regtech/calendar/ReminderSystem.kt"] },
        ]},
        { name: "Audit & Compliance", description: "Audit trail and compliance monitoring for regulatory reporting", category: "Compliance", functionalities: [
          { name: "Audit Trail Logger", description: "Immutable audit trail for all data transformations and submissions", sourceFiles: ["src/main/kotlin/com/ing/regtech/audit/AuditLogger.kt"] },
          { name: "Evidence Collector", description: "Automated evidence collection for regulatory examinations", sourceFiles: ["src/main/kotlin/com/ing/regtech/audit/EvidenceCollector.kt"] },
          { name: "Compliance Dashboard", description: "Real-time compliance monitoring with KRI visualization", sourceFiles: ["src/main/kotlin/com/ing/regtech/audit/ComplianceDashboard.kt"] },
        ]},
        { name: "Submission Gateway", description: "Multi-regulator submission gateway for EU regulators", category: "Regulatory Technology", functionalities: [
          { name: "EBA Portal Integration", description: "EBA reporting portal integration for XBRL submission", sourceFiles: ["src/main/kotlin/com/ing/regtech/gateway/EbaPortal.kt"] },
          { name: "ECB Direct Reporting", description: "ECB direct reporting for AnaCredit and statistical data", sourceFiles: ["src/main/kotlin/com/ing/regtech/gateway/EcbReporting.kt"] },
          { name: "DNB Connector", description: "DNB regulatory reporting connector for Dutch national requirements", sourceFiles: ["src/main/kotlin/com/ing/regtech/gateway/DnbConnector.kt"] },
        ]},
        { name: "Change Management", description: "Regulatory change tracking and impact analysis", category: "Operations", functionalities: [
          { name: "Regulatory Change Tracker", description: "Automated monitoring of regulatory publications and taxonomy updates", sourceFiles: ["src/main/kotlin/com/ing/regtech/change/ChangeTracker.kt"] },
          { name: "Impact Analyzer", description: "Regulatory change impact analysis across data models and reports", sourceFiles: ["src/main/kotlin/com/ing/regtech/change/ImpactAnalyzer.kt"] },
          { name: "Implementation Planner", description: "Change implementation planning with resource allocation", sourceFiles: ["src/main/kotlin/com/ing/regtech/change/ImplementationPlanner.kt"] },
        ]},
      ],
      group: { name: "Regulatory Operations", description: "Data extraction, report generation, and regulatory submission workflow" },
      steps: [
        { name: "Data Extraction", stepOrder: 1, stepType: "process" },
        { name: "Validation Rules Engine", stepOrder: 2, stepType: "process" },
        { name: "Data Quality Gate", stepOrder: 3, stepType: "decision" },
        { name: "Data Remediation Queue", stepOrder: 4, stepType: "wait" },
        { name: "Report Generation", stepOrder: 5, stepType: "process" },
        { name: "Regulatory Format Transform", stepOrder: 6, stepType: "process" },
        { name: "Supervisor Review", stepOrder: 7, stepType: "decision" },
        { name: "Submission to Regulator", stepOrder: 8, stepType: "process" },
      ],
      vsm: { processTime: 5.0, leadTime: 168.0, waitTime: 163.0, flowEfficiency: 2.98, mermaidSource: `graph LR
    A[Data Extraction]:::value --> B[Validation Rules Engine]:::value
    B --> C{Data Quality Gate}:::bottleneck
    C -->|Pass| D[Report Generation]:::value
    C -->|Fail| E[Data Remediation Queue]:::waste
    E --> F[Manual Data Fix]:::waste
    F --> B
    D --> G[Regulatory Format Transform]:::value
    G --> H{Supervisor Review}:::bottleneck
    H -->|Approved| I[Submission to Regulator]:::value
    H -->|Rejected| J[Revision Required]:::waste
    J --> D

    classDef value fill:#22c55e,stroke:#16a34a,color:#fff
    classDef bottleneck fill:#f59e0b,stroke:#d97706,color:#fff
    classDef waste fill:#ef4444,stroke:#dc2626,color:#fff` },
    },
  ],
  risks: [
    { productIndex: 0, riskCategory: "DATA_PRIVACY", riskScore: 9.0, severity: "CRITICAL", description: "GDPR data sovereignty requirements for open banking — customer financial data must remain within EU jurisdiction and consent must be granular per PSD2/GDPR alignment", mitigationPlan: "Deploy EU-only data residency controls; implement granular consent management per GDPR Article 7; automated data subject request handling; quarterly DPO reviews", transitionBlocked: true },
    { productIndex: 1, riskCategory: "REGULATORY", riskScore: 7.0, severity: "HIGH", description: "MiFID II suitability requirements for AI-driven investment recommendations — robo-advisory must demonstrate equivalent or better client protection than human advisors", mitigationPlan: "Implement explainable AI for all investment recommendations; maintain full audit trail per MiFID II Article 25; annual algorithm validation by compliance team", transitionBlocked: false },
    { productIndex: 2, riskCategory: "OPERATIONAL", riskScore: 5.5, severity: "MEDIUM", description: "DORA operational resilience requirements for automated regulatory reporting — system outage during reporting deadline creates regulatory filing risk", mitigationPlan: "Implement DORA-compliant ICT risk framework; automated failover for reporting pipeline; maintain manual fallback procedures; report submission T-3 buffer policy", transitionBlocked: false },
    { productIndex: 0, riskCategory: "TECHNOLOGY", riskScore: 3.5, severity: "LOW", description: "API gateway technology migration from legacy REST to GraphQL federation is well-planned with proven patterns", mitigationPlan: "Phase API migration using strangler fig pattern; maintain backwards-compatible REST endpoints during transition; automated API contract testing", transitionBlocked: false },
  ],
  compliance: [
    { productIndex: 0, framework: "PSD2", requirement: "RTS on SCA — Strong Customer Authentication", description: "Open banking APIs must enforce SCA for all payment initiation and account access per PSD2 delegated regulation", status: "COMPLIANT", evidenceLinks: ["https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A32018R0389"] },
    { productIndex: 0, framework: "GDPR", requirement: "Article 44-49 — International Data Transfers", description: "Customer financial data accessed via open banking APIs must comply with EU data transfer restrictions", status: "REMEDIATION", evidenceLinks: ["https://gdpr-info.eu/art-44-gdpr/"] },
    { productIndex: 1, framework: "MiFID II", requirement: "Article 25 — Suitability Assessment", description: "Robo-advisory recommendations must pass MiFID II suitability assessment with full audit trail", status: "COMPLIANT", evidenceLinks: ["https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A32014L0065"] },
    { productIndex: 1, framework: "EBA", requirement: "Guidelines on ICT and Security Risk Management", description: "AI-driven investment platform must comply with EBA ICT risk management guidelines", status: "PENDING", evidenceLinks: [] },
    { productIndex: 2, framework: "DORA", requirement: "Article 11 — ICT Response and Recovery", description: "Regulatory reporting systems must have documented ICT incident response and recovery procedures", status: "REMEDIATION", evidenceLinks: ["https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A32022R2554"] },
    { productIndex: 2, framework: "Basel III", requirement: "Pillar 3 — Market Discipline Disclosures", description: "Automated reporting must accurately generate Basel III Pillar 3 disclosure reports", status: "COMPLIANT", evidenceLinks: ["https://www.bis.org/bcbs/publ/d424.htm"] },
  ],
  productReadiness: [
    { readinessScore: 8.5, factors: [{ name: "Technical Debt", score: 8.0 }, { name: "Team Readiness", score: 9.0 }, { name: "Data Quality", score: 8.5 }, { name: "Infrastructure", score: 8.5 }], migrationSteps: [{ phase: "Assessment", description: "Audit existing API landscape and TPP integration contracts", status: "completed", estimatedDuration: "2 weeks" }, { phase: "API Redesign", description: "Design PSD2-compliant API gateway with consent management", status: "completed", estimatedDuration: "4 weeks" }, { phase: "Migration", description: "Migrate TPP integrations to new API gateway with canary releases", status: "in-progress", estimatedDuration: "6 weeks" }, { phase: "Certification", description: "PSD2 conformance testing and DNB certification", status: "pending", estimatedDuration: "3 weeks" }], gateApproved: true, blockers: [] },
    { readinessScore: 6.5, factors: [{ name: "Technical Debt", score: 6.0 }, { name: "Team Readiness", score: 7.5 }, { name: "Data Quality", score: 6.0 }, { name: "Infrastructure", score: 6.5 }], migrationSteps: [{ phase: "Assessment", description: "Evaluate current advisory process and MiFID II compliance gaps", status: "completed", estimatedDuration: "3 weeks" }, { phase: "Model Development", description: "Build and validate robo-advisory ML models on historical data", status: "in-progress", estimatedDuration: "8 weeks" }, { phase: "Compliance Integration", description: "Integrate real-time MiFID II suitability checking into advisory flow", status: "pending", estimatedDuration: "5 weeks" }, { phase: "Pilot Launch", description: "Controlled pilot with select client segment and compliance monitoring", status: "pending", estimatedDuration: "4 weeks" }], gateApproved: false, blockers: ["MiFID II explainability requirements for AI recommendations not yet met", "Risk model validation pending compliance team sign-off"] },
    { readinessScore: 7.8, factors: [{ name: "Technical Debt", score: 7.5 }, { name: "Team Readiness", score: 8.0 }, { name: "Data Quality", score: 7.5 }, { name: "Infrastructure", score: 8.0 }], migrationSteps: [{ phase: "Assessment", description: "Map all regulatory reporting requirements across EU jurisdictions", status: "completed", estimatedDuration: "3 weeks" }, { phase: "Pipeline Build", description: "Build automated data extraction and validation pipeline", status: "completed", estimatedDuration: "6 weeks" }, { phase: "Format Engine", description: "Implement multi-format report generation (XBRL, XML, CSV)", status: "in-progress", estimatedDuration: "4 weeks" }, { phase: "Submission Integration", description: "Direct API integration with EBA, ECB, and DNB submission portals", status: "pending", estimatedDuration: "3 weeks" }], gateApproved: true, blockers: [] },
  ],
  futureState: {
    automationMix: [
      { productName: "ING Direct App", rpa: 15, aiMl: 20, agentBased: 30, conversational: 20, analytics: 15 },
      { productName: "Smart Invest", rpa: 10, aiMl: 35, agentBased: 20, conversational: 20, analytics: 15 },
      { productName: "RegReporter Pro", rpa: 35, aiMl: 25, agentBased: 15, conversational: 5, analytics: 20 },
    ],
    currentSteps: [
      { name: "Data Extraction", type: "manual", duration: 6 },
      { name: "Data Validation", type: "manual", duration: 4 },
      { name: "Report Preparation", type: "manual", duration: 8 },
      { name: "Supervisor Review", type: "manual", duration: 3 },
      { name: "Portal Submission", type: "manual", duration: 2 },
    ],
    futureSteps: [
      { name: "Auto Data Extraction", type: "automated", duration: 0.5 },
      { name: "AI Data Validation", type: "ai", duration: 0.3 },
      { name: "Smart Report Generation", type: "ai", duration: 0.5 },
      { name: "AI-Assisted Review", type: "agent", duration: 0.5 },
      { name: "API Submission", type: "automated", duration: 0.1 },
    ],
    capabilities: [
      { name: "Intelligent Consent Management", category: "AI_ML_INTEGRATION", businessImpact: "HIGH", complexity: "MEDIUM", techStack: ["Kotlin", "Spring WebFlux", "Redis"], description: "AI-powered consent lifecycle management with predictive consent renewal and GDPR compliance automation", reach: 8, impact: 7, confidence: 0.8, effort: 4, riceScore: 11.2 },
      { name: "Autonomous Portfolio Manager", category: "AGENT_BASED", businessImpact: "HIGH", complexity: "HIGH", techStack: ["LangGraph", "Kotlin", "Apache Kafka"], description: "Multi-agent portfolio management system with real-time market analysis and automated rebalancing", reach: 7, impact: 10, confidence: 0.5, effort: 9, riceScore: 3.89 },
      { name: "Conversational Investment Advisor", category: "CONVERSATIONAL_AI", businessImpact: "MEDIUM", complexity: "MEDIUM", techStack: ["GPT-4", "LangChain", "Kotlin"], description: "Natural language investment advisory interface with MiFID II-compliant recommendation explanations", reach: 6, impact: 6, confidence: 0.7, effort: 5, riceScore: 5.04 },
      { name: "Regulatory Intelligence Analytics", category: "ADVANCED_ANALYTICS", businessImpact: "HIGH", complexity: "HIGH", techStack: ["Apache Spark", "Elasticsearch", "Grafana"], description: "Predictive regulatory change detection and automated impact assessment across compliance frameworks", reach: 9, impact: 8, confidence: 0.6, effort: 7, riceScore: 6.17 },
      { name: "Report Generation Bot", category: "RPA_AUTOMATION", businessImpact: "MEDIUM", complexity: "LOW", techStack: ["UiPath", "Kotlin", "XBRL"], description: "Automated multi-format regulatory report generation with intelligent data quality validation", reach: 7, impact: 5, confidence: 0.9, effort: 2, riceScore: 15.75 },
    ],
    productStreams: {
      "ING Direct App": {
        currentSteps: [
          { name: "Account Login", type: "manual", duration: 1 },
          { name: "Balance Inquiry", type: "manual", duration: 2 },
          { name: "Transaction Review", type: "manual", duration: 3 },
          { name: "Payment Setup", type: "manual", duration: 4 },
          { name: "Confirmation", type: "manual", duration: 1 },
        ],
        futureSteps: [
          { name: "Biometric Auth", type: "automated", duration: 0.1 },
          { name: "AI Account Overview", type: "ai", duration: 0.2 },
          { name: "Smart Insights", type: "agent", duration: 0.3 },
          { name: "Voice Payment", type: "agent", duration: 0.3 },
          { name: "Instant Confirmation", type: "automated", duration: 0.05 },
        ],
      },
      "Smart Invest": {
        currentSteps: [
          { name: "Risk Profiling", type: "manual", duration: 5 },
          { name: "Portfolio Selection", type: "manual", duration: 6 },
          { name: "Order Placement", type: "manual", duration: 3 },
          { name: "Execution", type: "automated", duration: 1 },
          { name: "Settlement", type: "manual", duration: 4 },
        ],
        futureSteps: [
          { name: "AI Risk Assessment", type: "ai", duration: 0.3 },
          { name: "Robo-Advisory", type: "agent", duration: 0.5 },
          { name: "Auto Order Routing", type: "automated", duration: 0.1 },
          { name: "Smart Execution", type: "ai", duration: 0.2 },
          { name: "Instant Settlement", type: "automated", duration: 0.1 },
        ],
      },
      "RegReporter Pro": {
        currentSteps: [
          { name: "Data Extraction", type: "manual", duration: 6 },
          { name: "Data Validation", type: "manual", duration: 4 },
          { name: "Report Preparation", type: "manual", duration: 8 },
          { name: "Supervisor Review", type: "manual", duration: 3 },
          { name: "Portal Submission", type: "manual", duration: 2 },
        ],
        futureSteps: [
          { name: "Auto Data Extraction", type: "automated", duration: 0.5 },
          { name: "AI Data Validation", type: "ai", duration: 0.3 },
          { name: "Smart Report Generation", type: "ai", duration: 0.5 },
          { name: "AI-Assisted Review", type: "agent", duration: 0.5 },
          { name: "API Submission", type: "automated", duration: 0.1 },
        ],
      },
    },
  },
  architecture: {
    current_architecture: "Kotlin-based modular monolith on Kubernetes with PostgreSQL. Separate modules for accounts, investments, and regulatory reporting sharing a common data layer. REST APIs for external integrations with manual TPP onboarding.",
    target_architecture: "Event-driven microservices on Google Cloud GKE with GraphQL federation API layer. Domain-driven design with separate bounded contexts. Real-time event streaming via Apache Kafka. CQRS pattern for investment and regulatory reporting domains.",
    migration_plan: "Phase 1: GraphQL API gateway and PSD2 consent service extraction (Q1). Phase 2: Investment robo-advisory microservice with ML pipeline on Vertex AI (Q2-Q3). Phase 3: Regulatory reporting automation pipeline with direct API submission (Q3-Q4). Phase 4: Legacy monolith decomposition and data migration (Q1 next year).",
    architecture_diagrams: {
      functional: "graph TD\n  A[Client Channels] --> B[GraphQL Federation]\n  B --> C[Account Service]\n  B --> D[Investment Service]\n  B --> E[RegTech Service]\n  C --> F[Open Banking APIs]\n  C --> G[Identity Service]\n  D --> H[Robo-Advisory]\n  D --> I[Order Management]\n  E --> J[Report Generator]\n  E --> K[Submission Gateway]\n  F --> L[(Account DB)]\n  H --> M[(Investment DB)]\n  J --> N[(Regulatory DB)]",
      technical: "graph TD\n  A[GKE Cluster] --> B[Istio Service Mesh]\n  B --> C[Kotlin Services]\n  C --> D[Apache Kafka]\n  D --> E[Stream Processors]\n  C --> F[Cloud SQL PostgreSQL]\n  C --> G[Memorystore Redis]\n  E --> H[Vertex AI]\n  C --> I[Cloud Storage]\n  A --> J[Cloud Load Balancer]\n  J --> K[Cloud CDN]",
      solution: "graph TD\n  A[Mobile/Web/TPP] --> B[Apollo GraphQL Gateway]\n  B --> C{Service Router}\n  C --> D[Account Microservice]\n  C --> E[Investment Microservice]\n  C --> F[RegTech Microservice]\n  D --> G[Cloud SQL - Accounts]\n  E --> H[Cloud SQL - Investments]\n  F --> I[Cloud SQL - Regulatory]\n  D & E & F --> J[Kafka Event Bus]\n  J --> K[Analytics Pipeline]\n  K --> L[BigQuery]",
      products: {
        "ING Direct App": {
          solution: "graph LR\n  subgraph Personas\n    P1[Customer]\n    P2[TPP Partner]\n    P3[Support Agent]\n  end\n  subgraph Agentic Workstreams\n    A1[Open Banking Agent]\n    A2[Identity Agent]\n    A3[PFM Agent]\n  end\n  subgraph Integrations\n    S1[API Gateway]\n    S2[Account Services]\n    S3[PSD2 Consent]\n  end\n  P1 --> A1\n  P2 --> A1\n  P3 --> A2\n  A1 --> S1\n  A2 --> S3\n  A3 --> S2\n  A1 --> A2\n  A2 --> A3",
          technical: "graph TD\n  subgraph Infrastructure\n    I1[GKE Cluster]\n    I2[Cloud SQL]\n    I3[Cloud KMS]\n  end\n  subgraph Platform\n    P1[GraphQL Federation]\n    P2[Apache Kafka]\n    P3[Memorystore]\n  end\n  subgraph Application\n    AP1[Banking Services]\n    AP2[PSD2 API]\n    AP3[PFM Engine]\n  end\n  I1 --> P1\n  I2 --> AP1\n  P1 --> AP1\n  P2 --> AP2\n  P3 --> AP3\n  AP1 --> P2\n  AP2 --> AP3",
          sequence: "sequenceDiagram\n  participant C as Customer\n  participant MA as Mobile App\n  participant BA as Biometric Auth\n  participant AA as Account Aggregation\n  participant PFM as PFM Dashboard\n  C->>MA: Open App\n  MA->>BA: Biometric Verification\n  BA-->>MA: Auth Confirmed\n  MA->>AA: Fetch All Accounts\n  AA-->>MA: Aggregated Data\n  MA->>PFM: Render Dashboard\n  PFM-->>C: Financial Overview",
        },
        "Smart Invest": {
          solution: "graph LR\n  subgraph Personas\n    P1[Investor]\n    P2[Financial Advisor]\n    P3[Compliance Officer]\n  end\n  subgraph Agentic Workstreams\n    A1[Robo-Advisory Agent]\n    A2[ESG Scoring Agent]\n    A3[MiFID Agent]\n  end\n  subgraph Systems\n    S1[Portfolio Engine]\n    S2[Market Data Feed]\n    S3[Order Management]\n  end\n  P1 --> A1\n  P2 --> A2\n  P3 --> A3\n  A1 --> S1\n  A2 --> S2\n  A3 --> S3\n  A1 --> A2\n  A2 --> A3",
          technical: "graph TD\n  subgraph Infrastructure\n    I1[GKE Cluster]\n    I2[Vertex AI]\n    I3[BigQuery]\n  end\n  subgraph Platform\n    P1[Apache Kafka]\n    P2[CQRS Event Store]\n    P3[Redis Cache]\n  end\n  subgraph Application\n    AP1[Advisory Engine]\n    AP2[Order Management]\n    AP3[Portfolio Service]\n  end\n  I1 --> P1\n  I2 --> AP1\n  P1 --> AP1\n  P2 --> AP2\n  P3 --> AP3\n  AP1 --> P1\n  AP2 --> AP3",
          sequence: "sequenceDiagram\n  participant I as Investor\n  participant RP as Risk Profiler\n  participant PO as Portfolio Optimizer\n  participant OR as Order Router\n  participant EX as Execution\n  participant ST as Settlement\n  I->>RP: Complete Risk Profile\n  RP->>PO: Generate Portfolio\n  PO->>OR: Submit Orders\n  OR->>EX: Execute Trades\n  EX->>ST: Settle Transactions\n  ST-->>I: Confirmation Sent",
        },
        "RegReporter Pro": {
          solution: "graph LR\n  subgraph Personas\n    P1[Compliance Officer]\n    P2[Auditor]\n    P3[Regulator]\n  end\n  subgraph Agentic Workstreams\n    A1[Data Quality Agent]\n    A2[Report Generator Agent]\n    A3[Submission Agent]\n  end\n  subgraph Regulatory Frameworks\n    S1[COREP]\n    S2[FINREP]\n    S3[AnaCredit]\n  end\n  P1 --> A1\n  P2 --> A2\n  P3 --> A3\n  A1 --> S1\n  A2 --> S2\n  A3 --> S3\n  A1 --> A2\n  A2 --> A3",
          technical: "graph TD\n  subgraph Infrastructure\n    I1[GKE Cluster]\n    I2[BigQuery]\n    I3[Cloud Storage]\n  end\n  subgraph Platform\n    P1[Data Pipeline]\n    P2[Validation Engine]\n    P3[Scheduler]\n  end\n  subgraph Application\n    AP1[Report Generator]\n    AP2[Submission Gateway]\n    AP3[Audit Trail]\n  end\n  I1 --> P1\n  I2 --> P1\n  P1 --> AP1\n  P2 --> AP1\n  P3 --> AP2\n  AP1 --> AP2\n  AP2 --> AP3",
          sequence: "sequenceDiagram\n  participant ST as Schedule Trigger\n  participant DE as Data Extraction\n  participant VL as Validation\n  participant RG as Report Generation\n  participant RS as Regulator Submission\n  participant AL as Audit Log\n  ST->>DE: Trigger Extraction\n  DE->>VL: Validate Data Quality\n  VL->>RG: Generate Reports\n  RG->>RS: Submit to Regulator\n  RS-->>AL: Log Submission\n  AL-->>ST: Cycle Complete",
        },
      },
    },
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// Main
// ═══════════════════════════════════════════════════════════════════════════════

async function main() {
  console.log("Cleaning existing data...");

  await prisma.roadmapItem.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.complianceMapping.deleteMany();
  await prisma.riskAssessment.deleteMany();
  await prisma.vsmMetrics.deleteMany();
  await prisma.personaMapping.deleteMany();
  await prisma.agentFeedback.deleteMany();
  await prisma.approvalRequest.deleteMany();
  await prisma.valueStreamStep.deleteMany();
  await prisma.productGroup.deleteMany();
  await prisma.functionality.deleteMany();
  await prisma.digitalCapability.deleteMany();
  await prisma.digitalProduct.deleteMany();
  await prisma.agentExecution.deleteMany();
  await prisma.codeEmbedding.deleteMany();
  await prisma.repository.deleteMany();
  await prisma.pipelineExecution.deleteMany();
  await prisma.notificationConfig.deleteMany();
  await prisma.agentMemory.deleteMany();
  await prisma.chatMessage.deleteMany();
  await prisma.chatConversation.deleteMany();
  await prisma.contextEmbedding.deleteMany();
  await prisma.contextDocument.deleteMany();
  await prisma.contextApplication.deleteMany();
  await prisma.roadmapItem.deleteMany();
  await prisma.techTrend.deleteMany();
  await prisma.organization.deleteMany();

  console.log("Seeding organizations...");

  await seedOrganization(US_BANK);
  await seedOrganization(TELSTRA_HEALTH);
  await seedOrganization(ING_BANK);

  console.log("\nSeed data created successfully!");
  console.log("  3 organizations, 3 repositories, 9 digital products");
  console.log("  ~78 capabilities, ~300+ functionalities");
  console.log("  9 VSM metrics with Mermaid diagrams");
  console.log("  12 risk assessments, 18 compliance mappings");
  console.log("  21 agent executions (incl. architecture + roadmap), 12 audit log entries");
  console.log("  ~57 roadmap items with RICE scores across 3 orgs");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });