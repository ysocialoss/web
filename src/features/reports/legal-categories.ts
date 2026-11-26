import type { LegalCategory } from "@/lib/api";

export const legalCategoryLabels: Record<LegalCategory, string> = {
  child_sexual_abuse: "Child sexual abuse material (§ 184b StGB)",
  terrorism: "Terrorist content (§§ 89a, 129a StGB)",
  threats: "Threats or calls for crimes (§§ 111, 241 StGB)",
  incitement: "Incitement to hatred (§ 130 StGB)",
  insult_defamation: "Insult or defamation (§§ 185 to 187 StGB)",
  unconstitutional_symbols: "Symbols of unconstitutional organisations (§ 86a StGB)",
  privacy_violation: "Violation of privacy or personal images (§ 201a StGB, GDPR)",
  intellectual_property: "Copyright or trademark infringement",
  fraud: "Fraud or scams (§ 263 StGB)",
  youth_protection: "Content harmful to minors (JMStV)",
  other: "Another law",
};
