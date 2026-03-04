export interface IndustryConfig {
  label: string;
  regulatoryFrameworks: string[];
  personas: { type: string; name: string; responsibilities: string[] }[];
}

export const INDUSTRY_CONFIGS: Record<string, IndustryConfig> = {
  financial_services: {
    label: "Financial Services",
    regulatoryFrameworks: ["FINRA", "SEC", "GDPR", "SOX", "PCI-DSS"],
    personas: [
      { type: "FRONT_OFFICE", name: "Wealth Advisor", responsibilities: ["Client relationship management", "Portfolio recommendations", "Performance reporting"] },
      { type: "MIDDLE_OFFICE", name: "Compliance Officer", responsibilities: ["KYC verification", "Regulatory reporting", "Risk monitoring"] },
      { type: "BACK_OFFICE", name: "Operations Analyst", responsibilities: ["Trade settlement", "Reconciliation", "System maintenance"] },
    ],
  },
  healthcare: {
    label: "Healthcare",
    regulatoryFrameworks: ["HIPAA", "HITECH", "FDA", "GDPR", "HL7/FHIR"],
    personas: [
      { type: "FRONT_OFFICE", name: "Clinician", responsibilities: ["Patient care", "Clinical documentation", "Treatment planning"] },
      { type: "MIDDLE_OFFICE", name: "Compliance Officer", responsibilities: ["HIPAA compliance", "Audit management", "Policy enforcement"] },
      { type: "BACK_OFFICE", name: "Health IT Analyst", responsibilities: ["EHR management", "System integration", "Data migration"] },
    ],
  },
  insurance: {
    label: "Insurance",
    regulatoryFrameworks: ["NAIC", "Solvency II", "GDPR", "IFRS 17", "SOX"],
    personas: [
      { type: "FRONT_OFFICE", name: "Underwriter", responsibilities: ["Risk assessment", "Policy pricing", "Client advisory"] },
      { type: "MIDDLE_OFFICE", name: "Claims Manager", responsibilities: ["Claims adjudication", "Fraud detection", "Compliance monitoring"] },
      { type: "BACK_OFFICE", name: "Actuarial Analyst", responsibilities: ["Loss modeling", "Reserve calculations", "Regulatory reporting"] },
    ],
  },
  retail: {
    label: "Retail",
    regulatoryFrameworks: ["PCI-DSS", "GDPR", "CCPA", "FTC", "ADA"],
    personas: [
      { type: "FRONT_OFFICE", name: "Merchandiser", responsibilities: ["Product assortment", "Pricing strategy", "Promotions"] },
      { type: "MIDDLE_OFFICE", name: "Supply Chain Manager", responsibilities: ["Inventory optimization", "Vendor management", "Logistics"] },
      { type: "BACK_OFFICE", name: "E-Commerce Analyst", responsibilities: ["Platform management", "Analytics", "System integration"] },
    ],
  },
  manufacturing: {
    label: "Manufacturing",
    regulatoryFrameworks: ["ISO 9001", "OSHA", "EPA", "REACH", "GDPR"],
    personas: [
      { type: "FRONT_OFFICE", name: "Product Engineer", responsibilities: ["Product design", "Quality specifications", "Customer requirements"] },
      { type: "MIDDLE_OFFICE", name: "Quality Manager", responsibilities: ["QA/QC processes", "Compliance audits", "Defect tracking"] },
      { type: "BACK_OFFICE", name: "Plant Operations Analyst", responsibilities: ["MES management", "Production scheduling", "Equipment maintenance"] },
    ],
  },
  technology: {
    label: "Technology",
    regulatoryFrameworks: ["SOC 2", "GDPR", "CCPA", "ISO 27001", "FedRAMP"],
    personas: [
      { type: "FRONT_OFFICE", name: "Product Manager", responsibilities: ["Product strategy", "Customer feedback", "Feature prioritization"] },
      { type: "MIDDLE_OFFICE", name: "Security Engineer", responsibilities: ["Threat modeling", "Compliance monitoring", "Incident response"] },
      { type: "BACK_OFFICE", name: "Platform Engineer", responsibilities: ["Infrastructure management", "CI/CD pipelines", "System reliability"] },
    ],
  },
  energy: {
    label: "Energy",
    regulatoryFrameworks: ["NERC CIP", "FERC", "EPA", "OSHA", "ISO 50001"],
    personas: [
      { type: "FRONT_OFFICE", name: "Energy Trader", responsibilities: ["Market analysis", "Contract negotiation", "Portfolio optimization"] },
      { type: "MIDDLE_OFFICE", name: "Regulatory Compliance Analyst", responsibilities: ["NERC compliance", "Environmental reporting", "Safety standards"] },
      { type: "BACK_OFFICE", name: "Grid Operations Analyst", responsibilities: ["SCADA management", "Grid monitoring", "Outage management"] },
    ],
  },
};

export function getIndustryConfig(industryType: string): IndustryConfig | undefined {
  return INDUSTRY_CONFIGS[industryType];
}

export function getIndustryOptions() {
  return Object.entries(INDUSTRY_CONFIGS).map(([value, config]) => ({
    value,
    label: config.label,
  }));
}
