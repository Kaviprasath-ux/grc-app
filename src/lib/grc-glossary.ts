/**
 * GRC Glossary
 *
 * Acronyms and domain terms that should be preserved during translation.
 * Since we use GPT LLM via our Python backend, the model naturally handles
 * most acronyms well. This file serves as a reference and for post-processing.
 */

/**
 * Acronyms that should NEVER be translated — kept as-is in all languages.
 * GPT models generally preserve these, but we check post-translation.
 */
export const PRESERVED_ACRONYMS = [
  'CAPA', 'KPI', 'BIA', 'SOA', 'CIA', 'RTO', 'RPO', 'GRC',
  'NIST', 'ISO', 'COBIT', 'SOC', 'SOX', 'HIPAA', 'GDPR', 'PCI',
  'DSS', 'ISMS', 'ERM', 'BCMS', 'BCP', 'DRP', 'SLA', 'MTPD',
  'MBCO', 'WRT', 'ITIL', 'CMDB', 'RACI', 'CSF', 'NESA', 'UAE',
  'ADHICS', 'PDCA', 'NCA', 'ECC', 'SAMA', 'CMA', 'SDAIA',
] as const;

/**
 * Domain-specific terms with preferred translations per locale.
 * These can be used for validation or UI glossary display.
 */
export const DOMAIN_TERMS: Record<string, { ar: string; lv: string }> = {
  // Risk Management
  'Inherent Risk': { ar: 'المخاطر الكامنة', lv: 'Iedzimtais risks' },
  'Residual Risk': { ar: 'المخاطر المتبقية', lv: 'Atlikušais risks' },
  'Risk Appetite': { ar: 'الرغبة في المخاطرة', lv: 'Riska apetīte' },
  'Risk Tolerance': { ar: 'تحمل المخاطر', lv: 'Riska tolerance' },
  'Risk Register': { ar: 'سجل المخاطر', lv: 'Risku reģistrs' },
  'Risk Assessment': { ar: 'تقييم المخاطر', lv: 'Riska novērtējums' },
  'Risk Response': { ar: 'الاستجابة للمخاطر', lv: 'Riska atbilde' },
  'Risk Treatment': { ar: 'معالجة المخاطر', lv: 'Riska apstrāde' },
  'Control Effectiveness': { ar: 'فعالية الضوابط', lv: 'Kontroles efektivitāte' },
  'Likelihood': { ar: 'الاحتمالية', lv: 'Iespējamība' },
  'Impact': { ar: 'الأثر', lv: 'Ietekme' },

  // Compliance
  'Compliance Framework': { ar: 'إطار الامتثال', lv: 'Atbilstības ietvars' },
  'Control Objective': { ar: 'هدف الرقابة', lv: 'Kontroles mērķis' },
  'Evidence': { ar: 'الأدلة', lv: 'Pierādījumi' },
  'Exception': { ar: 'استثناء', lv: 'Izņēmums' },
  'Governance': { ar: 'الحوكمة', lv: 'Pārvaldība' },

  // Audit
  'Audit Finding': { ar: 'نتائج التدقيق', lv: 'Audita konstatējums' },
  'Corrective Action': { ar: 'الإجراء التصحيحي', lv: 'Korektīvā darbība' },
  'Preventive Action': { ar: 'الإجراء الوقائي', lv: 'Preventīvā darbība' },
  'Audit Engagement': { ar: 'مهمة التدقيق', lv: 'Audita uzdevums' },
  'Fieldwork': { ar: 'العمل الميداني', lv: 'Lauka darbs' },

  // Asset Management
  'Asset Classification': { ar: 'تصنيف الأصول', lv: 'Aktīvu klasifikācija' },
  'Confidentiality': { ar: 'السرية', lv: 'Konfidencialitāte' },
  'Integrity': { ar: 'النزاهة', lv: 'Integritāte' },
  'Availability': { ar: 'التوفر', lv: 'Pieejamība' },

  // Business Continuity
  'Business Impact Analysis': { ar: 'تحليل أثر الأعمال', lv: 'Biznesa ietekmes analīze' },
  'Business Continuity': { ar: 'استمرارية الأعمال', lv: 'Uzņēmējdarbības nepārtrauktība' },
  'Disaster Recovery': { ar: 'التعافي من الكوارث', lv: 'Katastrofu atjaunošana' },
};
