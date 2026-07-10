// Internal Audit Engagement Feedback Survey (QAIP) — structure shared by the
// editor page and the PDF export.

export interface SurveyQuestion {
  key: string;
  text: string;
}

export interface SurveySection {
  key: string; // A..F
  title: string;
  questions: SurveyQuestion[];
}

export const RATING_OPTIONS = ["5", "4", "3", "2", "1", "NA"] as const;
export type RatingValue = (typeof RATING_OPTIONS)[number];

export const FEEDBACK_SURVEY_SECTIONS: SurveySection[] = [
  {
    key: "A",
    title: "Engagement Planning",
    questions: [
      { key: "a1", text: "The audit objectives and scope were clearly communicated." },
      { key: "a2", text: "The audit team adequately explained the audit approach and methodology." },
      { key: "a3", text: "Audit timelines and milestones were communicated in advance." },
      { key: "a4", text: "Information requests were reasonable and relevant to the audit scope." },
      { key: "a5", text: "The opening meeting effectively explained the audit process." },
    ],
  },
  {
    key: "B",
    title: "Professionalism and Communication",
    questions: [
      { key: "b1", text: "The audit team demonstrated professionalism throughout the engagement." },
      { key: "b2", text: "The audit team maintained independence and objectivity." },
      { key: "b3", text: "Communication with the audit team was timely and effective." },
      { key: "b4", text: "The audit team demonstrated appropriate technical competence." },
    ],
  },
  {
    key: "C",
    title: "Audit Execution",
    questions: [
      { key: "c1", text: "The audit was conducted efficiently." },
      { key: "c2", text: "Audit observations were discussed during the engagement." },
      { key: "c3", text: "Audit conclusions were supported by sufficient facts and evidence." },
    ],
  },
  {
    key: "D",
    title: "Findings and Recommendations",
    questions: [
      { key: "d1", text: "Audit findings were clearly communicated." },
      { key: "d2", text: "Recommendations were practical and actionable." },
      { key: "d3", text: "The priority ratings assigned to findings were appropriate." },
    ],
  },
  {
    key: "E",
    title: "Reporting",
    questions: [
      { key: "e1", text: "The report was logically structured and professionally presented." },
      { key: "e2", text: "Management responses were fairly reflected." },
      { key: "e3", text: "The final report was issued within an acceptable timeframe." },
    ],
  },
  {
    key: "F",
    title: "Value Provided",
    questions: [
      { key: "f1", text: "The audit added value to the department." },
      { key: "f2", text: "The audit contributed to strengthening governance and internal controls." },
      { key: "f3", text: "Overall, the audit engagement met my expectations." },
    ],
  },
];

export const SECTION_LABEL: Record<string, string> = {
  A: "SECTION A – ENGAGEMENT PLANNING",
  B: "SECTION B – PROFESSIONALISM AND COMMUNICATION",
  C: "SECTION C – AUDIT EXECUTION",
  D: "SECTION D – FINDINGS AND RECOMMENDATIONS",
  E: "SECTION E – REPORTING",
  F: "SECTION F – VALUE PROVIDED",
};
