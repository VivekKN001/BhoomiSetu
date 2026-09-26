// Every listing must include an Encumbrance Certificate (see EC_DOC). Each type also has
// one type-specific proof doc: E-Khata (optional) for site/commercial, RTC
// (required) for agri.
export const EC_DOC = { docType: "ec", label: "Encumbrance Certificate" };

export const PROPERTY_TYPES = [
  { id: "site", label: "Residential Site", category: "Residential / Commercial", unit: "sqft", typeDocType: "khata", typeDocLabel: "E-Khata", typeDocRequired: false },
  { id: "agri", label: "Agricultural Land", category: "Agricultural", unit: "acres", typeDocType: "rtc", typeDocLabel: "RTC (Record of Rights, Tenancy & Crops)", typeDocRequired: true },
  { id: "commercial", label: "Commercial Plot", category: "Residential / Commercial", unit: "sqft", typeDocType: "khata", typeDocLabel: "E-Khata", typeDocRequired: false },
];

// Documents the seller must upload for this type, in display order.
export function requiredDocLabels(typeInfo) {
  return typeInfo.typeDocRequired ? [EC_DOC.label, typeInfo.typeDocLabel] : [EC_DOC.label];
}
