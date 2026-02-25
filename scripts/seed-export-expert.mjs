import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE;

if (!url || !serviceRole) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
}

const supabase = createClient(url, serviceRole, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const mkUuid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

async function upsert(table, rows, onConflict) {
  if (!rows.length) return;
  const { error } = await supabase.from(table).upsert(rows, { onConflict });
  if (error) throw new Error(`${table}: ${error.message}`);
  console.log(`${table}: ${rows.length}`);
}

async function main() {
  const countries = [
    ["FR", "FRA", "France", "France", "Europe", "EU"],
    ["DE", "DEU", "Allemagne", "Germany", "Europe", "EU"],
    ["ES", "ESP", "Espagne", "Spain", "Europe", "EU"],
    ["IT", "ITA", "Italie", "Italy", "Europe", "EU"],
    ["CL", "CHL", "Chili", "Chile", "Americas", "LATAM"],
    ["US", "USA", "Etats-Unis", "United States", "Americas", "NA"],
    ["GB", "GBR", "Royaume-Uni", "United Kingdom", "Europe", "UK"],
    ["MA", "MAR", "Maroc", "Morocco", "Africa", "MENA"],
    ["CN", "CHN", "Chine", "China", "Asia", "APAC"],
    ["AE", "ARE", "Emirats arabes unis", "United Arab Emirates", "MENA", "GCC"],
    ["JP", "JPN", "Japon", "Japan", "Asia", "APAC"],
    ["CA", "CAN", "Canada", "Canada", "Americas", "NA"],
  ].map(([iso2, iso3, name_fr, name_en, region, zone]) => ({
    iso2,
    iso3,
    name_fr,
    name_en,
    region,
    zone,
  }));

  const currencies = [
    ["EUR", "Euro", "Euro", "EUR", 2],
    ["USD", "Dollar americain", "US Dollar", "$", 2],
    ["GBP", "Livre sterling", "Pound sterling", "£", 2],
    ["CHF", "Franc suisse", "Swiss franc", "CHF", 2],
    ["CNY", "Yuan renminbi", "Chinese yuan", "¥", 2],
    ["JPY", "Yen japonais", "Japanese yen", "¥", 0],
    ["MAD", "Dirham marocain", "Moroccan dirham", "MAD", 2],
    ["CLP", "Peso chilien", "Chilean peso", "CLP", 0],
  ].map(([code, name_fr, name_en, symbol, minor_units]) => ({
    code,
    name_fr,
    name_en,
    symbol,
    minor_units,
  }));

  const hsRows = [
    ["081010", "Fraises fraiches", "Fresh strawberries"],
    ["081110", "Fraises congelees", "Frozen strawberries"],
    ["080810", "Pommes fraiches", "Fresh apples"],
    ["090111", "Cafe non torrefie", "Coffee not roasted"],
    ["220421", "Vins en recipients <= 2L", "Wine in containers <= 2L"],
    ["300490", "Medicaments en doses", "Medicaments in measured doses"],
    ["610910", "T-shirts coton", "Cotton t-shirts"],
    ["847130", "Ordinateurs portables", "Portable computers"],
    ["854231", "Processeurs et controles integres", "Processors and controllers"],
    ["940360", "Autres meubles en bois", "Other wooden furniture"],
    ["070310", "Oignons et echalotes", "Onions and shallots"],
    ["160414", "Thon prepare ou conserve", "Prepared or preserved tuna"],
    ["200799", "Confitures et purees de fruits", "Jams and fruit purees"],
    ["392330", "Bouteilles et flacons en plastique", "Plastic bottles and flasks"],
    ["850440", "Convertisseurs statiques", "Static converters"],
  ].map(([hs6, description_fr, description_en]) => ({ hs6, description_fr, description_en }));

  const incoterms = [
    ["EXW", "E", "Mise a disposition usine", "Ex works"],
    ["FCA", "F", "Remise au transporteur", "Free carrier"],
    ["CPT", "C", "Port paye jusqu'au lieu convenu", "Carriage paid to"],
    ["CIP", "C", "Transport et assurance payes", "Carriage and insurance paid"],
    ["DAP", "D", "Livre au lieu convenu", "Delivered at place"],
    ["DPU", "D", "Livre decharge au lieu convenu", "Delivered at place unloaded"],
    ["DDP", "D", "Livre droits acquittes", "Delivered duty paid"],
    ["FOB", "F", "Franco bord", "Free on board"],
    ["CFR", "C", "Cout et fret", "Cost and freight"],
    ["CIF", "C", "Cout assurance fret", "Cost insurance freight"],
  ].map(([code, group_letter, notes_fr, notes_en]) => ({
    code,
    group_letter,
    notes_fr,
    notes_en,
    responsibilities: {
      seller: ["export_clearance", "commercial_invoice"],
      buyer: ["import_clearance", "import_taxes"],
      risk_transfer: code,
    },
  }));

  const paymentTerms = [
    ["LC", "Credit documentaire", "Letter of Credit", 2, ["commercial_invoice", "bill_of_lading", "certificate_of_origin"]],
    ["CAD", "Remise documentaire", "Cash Against Documents", 3, ["commercial_invoice", "transport_document"]],
    ["OA", "Compte ouvert", "Open Account", 5, ["commercial_invoice"]],
    ["TT", "Virement telegraphique", "Telegraphic Transfer", 4, ["commercial_invoice", "proforma_invoice"]],
  ].map(([code, label_fr, label_en, risk_level, typical_docs]) => ({
    code,
    label_fr,
    label_en,
    risk_level,
    typical_docs,
  }));

  const transportModes = [
    ["air", "Aerien", "Air", "Rapide, cout eleve", "Fast, higher cost"],
    ["sea", "Maritime", "Sea", "Volume eleve, transit long", "High volume, longer transit"],
    ["road", "Routier", "Road", "Flexible intra-region", "Flexible regional transport"],
    ["rail", "Ferroviaire", "Rail", "Compromis cout/CO2", "Balanced cost and CO2"],
    ["courier", "Express", "Courier", "Petits envois urgents", "Urgent small parcels"],
  ].map(([code, name_fr, name_en, notes_fr, notes_en]) => ({ code, name_fr, name_en, notes_fr, notes_en }));

  const contractTypes = [
    ["sales", "Contrat de vente internationale", "International sales agreement", "Vente ponctuelle B2B", "Cross-border B2B sale", "Risque de non-conformite et paiement", "Risk on conformity and payment"],
    ["distribution", "Contrat de distribution", "Distribution agreement", "Reseau local exclusif/non exclusif", "Local market distribution", "Risque concurrence et territoire", "Territory and competition risks"],
    ["agency", "Contrat d'agent commercial", "Commercial agency agreement", "Prospection/vente via agent", "Sales via independent agent", "Risque indemnites fin de contrat", "Termination indemnity risk"],
    ["franchise", "Contrat de franchise", "Franchise agreement", "Replication de concept", "Replication of business model", "Risque propriete intellectuelle", "IP and brand risk"],
    ["licensing", "Contrat de licence", "Licensing agreement", "Concession de droits IP", "IP rights licensing", "Risque usages hors perimetre", "Out-of-scope IP use risk"],
    ["oem", "Contrat OEM/Sous-traitance", "OEM/Subcontracting agreement", "Fabrication pour marque tierce", "Manufacturing for third-party brand", "Risque qualite et confidentialite", "Quality and confidentiality risk"],
  ].map(([code, name_fr, name_en, when_to_use_fr, when_to_use_en, risk_notes_fr, risk_notes_en]) => ({
    code,
    name_fr,
    name_en,
    when_to_use_fr,
    when_to_use_en,
    risk_notes_fr,
    risk_notes_en,
  }));

  const contractClauses = [
    ["parties_scope", "core", "Parties et objet", "Parties and scope", "Identifier les parties, produits et territoires couverts.", "Define parties, products and covered territories."],
    ["goods_specs", "core", "Specifications produit", "Product specifications", "Decrire qualite, normes et methode de controle.", "Describe quality specs, standards and control method."],
    ["price_currency", "pricing", "Prix et devise", "Price and currency", "Fixer devise, indexation et revision de prix.", "Set currency, indexation and price review."],
    ["incoterm_allocation", "logistics", "Incoterm et repartition des couts", "Incoterm and cost allocation", "Preciser Incoterm, lieu exact et couts inclus.", "Specify Incoterm, named place and included costs."],
    ["transfer_risk", "logistics", "Transfert des risques", "Transfer of risk", "Definir le point de transfert des risques.", "Define exact point of risk transfer."],
    ["payment_terms_clause", "payment", "Modalites de paiement", "Payment terms", "Echeances, garanties et documents declencheurs.", "Milestones, guarantees and documentary triggers."],
    ["penalties_delay", "remedy", "Penalites de retard", "Delay penalties", "Fixer penalites plafonnees et seuils de retard.", "Set capped delay penalties and thresholds."],
    ["compliance_warranty", "compliance", "Conformite reglementaire", "Regulatory compliance", "Garantie de conformite export/sanctions/dual-use.", "Warranty for export controls, sanctions and dual-use compliance."],
    ["governing_law", "legal", "Droit applicable", "Governing law", "Choix du droit applicable et langue contractuelle.", "Choose governing law and contract language."],
    ["dispute_resolution", "legal", "Reglement des litiges", "Dispute resolution", "Mediation puis arbitrage/juridiction definie.", "Mediation then arbitration/court venue."],
    ["force_majeure", "legal", "Force majeure", "Force majeure", "Evenements exonerees et procedure de notification.", "Excused events and notification process."],
    ["termination", "legal", "Resiliation", "Termination", "Causes de resiliation et obligations de sortie.", "Termination causes and exit obligations."],
  ].map(([code, category, title_fr, title_en, body_fr, body_en]) => ({ code, category, title_fr, title_en, body_fr, body_en }));

  const customsConcepts = [
    ["vat_gst", "TVA/GST", "VAT/GST", "Taxe a la consommation appliquee sur base taxable import/export.", "Consumption tax applied on import/export taxable base."],
    ["customs_duty", "Droits de douane", "Customs duty", "Droit ad valorem/specifique selon classification HS et origine.", "Duty rate based on HS classification and origin."],
    ["excise", "Accises", "Excise", "Taxe specifique sur produits sensibles (alcool, tabac, energie).", "Specific tax on selected goods (alcohol, tobacco, energy)."],
    ["withholding_tax", "Retenue a la source", "Withholding tax", "Prelevement fiscal potentiel sur certains flux transfrontaliers.", "Potential withholding on selected cross-border payments."],
    ["incoterm_impact", "Impact Incoterm", "Incoterm impact", "L'Incoterm modifie la base de cout, risque et obligations fiscales.", "Incoterm choice changes cost base, risk and tax obligations."],
  ].map(([code, name_fr, name_en, description_fr, description_en]) => ({ code, name_fr, name_en, description_fr, description_en }));

  const customsProcedures = [
    ["release_for_free_circulation", "Mise en libre pratique", "Release for free circulation", "Dedomagement definitif avec paiement droits/taxes.", "Definitive clearance with duties/taxes payment."],
    ["transit", "Transit douanier", "Customs transit", "Circulation sous controle douanier jusqu'au bureau final.", "Goods movement under customs control to final office."],
    ["temporary_admission", "Admission temporaire", "Temporary admission", "Entree temporaire avec exonération conditionnelle.", "Temporary import with conditional duty relief."],
    ["inward_processing", "Perfectionnement actif", "Inward processing", "Transformation sous suspension de droits.", "Processing under duty suspension."],
    ["outward_processing", "Perfectionnement passif", "Outward processing", "Export temporaire pour transformation puis reimport.", "Temporary export for processing then re-import."],
    ["bonded_warehouse", "Entrepot sous douane", "Bonded warehouse", "Stockage sous controle douanier avant mise en libre pratique.", "Storage under customs control before release."],
  ].map(([code, name_fr, name_en, description_fr, description_en]) => ({ code, name_fr, name_en, description_fr, description_en }));

  const documents = [
    ["commercial_invoice", "commercial", "Facture commerciale", "Commercial invoice"],
    ["proforma_invoice", "commercial", "Facture proforma", "Proforma invoice"],
    ["packing_list", "commercial", "Liste de colisage", "Packing list"],
    ["bill_of_lading", "transport", "Connaissement maritime", "Bill of lading"],
    ["airway_bill", "transport", "Lettre de transport aerien", "Air waybill"],
    ["cmr", "transport", "Lettre de voiture CMR", "CMR consignment note"],
    ["rail_consignment", "transport", "Lettre de voiture ferroviaire", "Rail consignment note"],
    ["certificate_of_origin", "customs", "Certificat d'origine", "Certificate of origin"],
    ["eur1", "customs", "Certificat EUR.1", "EUR.1 certificate"],
    ["insurance_certificate", "insurance", "Certificat d'assurance", "Insurance certificate"],
    ["export_declaration", "customs", "Declaration export", "Export declaration"],
    ["import_declaration", "customs", "Declaration import", "Import declaration"],
    ["export_license", "compliance", "Licence d'exportation", "Export license"],
    ["dual_use_license", "compliance", "Licence biens a double usage", "Dual-use export license"],
    ["sanitary_certificate", "compliance", "Certificat sanitaire", "Sanitary certificate"],
    ["phytosanitary_certificate", "compliance", "Certificat phytosanitaire", "Phytosanitary certificate"],
    ["veterinary_certificate", "compliance", "Certificat veterinaire", "Veterinary certificate"],
    ["msds", "compliance", "Fiche de securite (MSDS)", "Material safety data sheet"],
    ["inspection_certificate", "compliance", "Certificat d'inspection", "Inspection certificate"],
    ["fumigation_certificate", "compliance", "Certificat de fumigation", "Fumigation certificate"],
    ["analysis_certificate", "compliance", "Certificat d'analyse", "Certificate of analysis"],
    ["beneficiary_certificate", "payment", "Certificat beneficiaire", "Beneficiary certificate"],
    ["draft_bill_of_exchange", "payment", "Traite", "Bill of exchange"],
    ["standby_lc", "payment", "Standby LC", "Standby letter of credit"],
    ["certificate_of_conformity", "compliance", "Certificat de conformite", "Certificate of conformity"],
    ["preferential_origin_statement", "customs", "Attestation d'origine pref.", "Preferential origin statement"],
    ["delivery_note", "transport", "Bon de livraison", "Delivery note"],
    ["export_contract", "contract", "Contrat de vente export", "Export sales agreement"],
    ["distribution_contract", "contract", "Contrat de distribution", "Distribution agreement"],
    ["agency_contract", "contract", "Contrat d'agent commercial", "Agency agreement"],
  ].map(([code, category, name_fr, name_en]) => ({
    code,
    category,
    name_fr,
    name_en,
    description_fr: `${name_fr} - document de reference export`,
    description_en: `${name_en} - export reference document`,
    required_fields: { minimum: ["document_date", "issuer"] },
  }));

  await upsert("ref_countries", countries, "iso2");
  await upsert("ref_currencies", currencies, "code");
  await upsert("ref_hs", hsRows, "hs6");
  await upsert("ref_incoterms", incoterms, "code");
  await upsert("ref_payment_terms", paymentTerms, "code");
  await upsert("ref_transport_modes", transportModes, "code");
  await upsert("ref_contract_types", contractTypes, "code");
  await upsert("ref_contract_clauses", contractClauses, "code");
  await upsert("customs_tax_concepts", customsConcepts, "code");
  await upsert("customs_procedures", customsProcedures, "code");
  await upsert("ref_documents", documents, "code");

  const taxVatRules = [
    ["FR", 20, [5.5, 10], true, true, "TVA standard FR", "Standard FR VAT", "https://www.impots.gouv.fr"],
    ["DE", 19, [7], true, true, "TVA standard DE", "Standard DE VAT", "https://www.bzst.de"],
    ["CL", 19, [], true, true, "IVA Chili", "Chile VAT", "https://www.sii.cl"],
    ["US", null, [], true, true, "Pas de TVA federale", "No federal VAT", "https://www.cbp.gov"],
    ["GB", 20, [5], true, true, "VAT UK", "UK VAT", "https://www.gov.uk"],
    ["MA", 20, [10, 14], true, true, "TVA Maroc", "Morocco VAT", "https://www.tax.gov.ma"],
    ["CN", 13, [9, 6], true, true, "VAT Chine", "China VAT", "https://www.chinatax.gov.cn"],
  ].map(([country_iso2, standard_rate, reduced_rates, export_zero_rated, import_vat_applicable, notes_fr, notes_en, source]) => ({
    country_iso2,
    standard_rate,
    reduced_rates,
    export_zero_rated,
    import_vat_applicable,
    notes_fr,
    notes_en,
    source,
  }));
  await upsert("tax_vat_rules", taxVatRules, "country_iso2");

  const sanctionsLists = [
    { id: mkUuid(1001), authority: "EU", list_name: "EU Restrictive Measures", updated_at: new Date().toISOString() },
    { id: mkUuid(1002), authority: "US", list_name: "OFAC SDN", updated_at: new Date().toISOString() },
  ];
  await upsert("sanctions_lists", sanctionsLists, "id");

  const sanctionsEntities = [
    { id: mkUuid(2001), list_id: mkUuid(1001), name: "Sample Restricted Shipping Co", alt_names: ["SRS Co"], country_iso2: null, identifiers: { type: "imo", value: "IMO1234567" }, status: "active" },
    { id: mkUuid(2002), list_id: mkUuid(1002), name: "Example Dual-Use Broker", alt_names: ["EDB"], country_iso2: null, identifiers: { type: "tax_id", value: "XX-99887" }, status: "active" },
  ];
  await upsert("sanctions_entities", sanctionsEntities, "id");

  const tradeMeasures = [
    {
      id: mkUuid(3001),
      country_iso2: "CL",
      hs6: "081010",
      measure_type: "phytosanitary",
      summary_fr: "Certificat phytosanitaire requis pour fruits frais.",
      summary_en: "Phytosanitary certificate required for fresh fruits.",
      legal_ref: "SAG Chile fresh produce controls",
      source: "https://www.sag.gob.cl",
    },
    {
      id: mkUuid(3002),
      country_iso2: "US",
      hs6: "854231",
      measure_type: "export_control",
      summary_fr: "Verifier obligations controle export pour composants electroniques sensibles.",
      summary_en: "Check export control obligations for sensitive electronic components.",
      legal_ref: "EAR/ITAR screening required",
      source: "https://www.bis.doc.gov",
    },
    {
      id: mkUuid(3003),
      country_iso2: "DE",
      hs6: null,
      measure_type: "conformity",
      summary_fr: "Conformite technique et marquage selon categorie produit.",
      summary_en: "Technical conformity and marking depend on product category.",
      legal_ref: "EU product compliance framework",
      source: "https://eur-lex.europa.eu",
    },
  ];
  await upsert("trade_measures", tradeMeasures, "id");

  const docRequirements = [
    [4001, null, null, null, null, null, null, "commercial_invoice", true, "Toujours requis", "Always required", 1],
    [4002, null, null, null, null, null, null, "packing_list", true, "Toujours requis", "Always required", 1],
    [4003, null, null, null, null, "sea", null, "bill_of_lading", true, "Preuve transport maritime", "Sea transport proof", 2],
    [4004, null, null, null, null, "air", null, "airway_bill", true, "Preuve transport aerien", "Air transport proof", 2],
    [4005, null, null, null, null, "road", null, "cmr", true, "Preuve transport routier", "Road transport proof", 2],
    [4006, null, null, null, "CIF", null, null, "insurance_certificate", true, "Assurance requise en CIF", "Insurance required under CIF", 2],
    [4007, null, "CL", "081010", null, null, null, "phytosanitary_certificate", true, "Fruits frais vers Chili", "Fresh produce to Chile", 1],
    [4008, null, "US", "854231", null, null, null, "dual_use_license", false, "Verifier classement dual-use", "Verify dual-use classification", 1],
    [4009, null, null, null, null, null, "LC", "certificate_of_origin", true, "Souvent exige en LC", "Often requested with LC", 3],
    [4010, null, null, null, null, null, "LC", "inspection_certificate", false, "Selon banque et contrat", "Depending on bank and contract", 3],
  ].map(([idn, origin_iso2, destination_iso2, hs6, incoterm, transport_mode, payment_term, doc_code, required, notes_fr, notes_en, priority]) => ({
    id: mkUuid(idn),
    origin_iso2,
    destination_iso2,
    hs6,
    incoterm,
    transport_mode,
    payment_term,
    doc_code,
    required,
    notes_fr,
    notes_en,
    priority,
  }));
  await upsert("doc_requirements", docRequirements, "id");

  const contractPlaybooks = [
    [5001, "sales", null, null, ["parties_scope", "goods_specs", "price_currency", "incoterm_allocation", "transfer_risk", "payment_terms_clause", "compliance_warranty", "governing_law", "dispute_resolution"]],
    [5002, "distribution", null, null, ["parties_scope", "goods_specs", "price_currency", "compliance_warranty", "termination", "dispute_resolution"]],
    [5003, "agency", null, null, ["parties_scope", "payment_terms_clause", "governing_law", "termination"]],
    [5004, "franchise", null, null, ["parties_scope", "price_currency", "compliance_warranty", "governing_law", "dispute_resolution"]],
    [5005, "licensing", null, null, ["parties_scope", "price_currency", "compliance_warranty", "governing_law", "termination"]],
    [5006, "oem", null, null, ["parties_scope", "goods_specs", "price_currency", "compliance_warranty", "penalties_delay", "termination"]],
  ].map(([idn, contract_type_code, country_iso2, hs6, clauses]) => ({
    id: mkUuid(idn),
    contract_type_code,
    country_iso2,
    hs6,
    clauses,
    notes_fr: "Playbook seed v1",
    notes_en: "Seed playbook v1",
  }));
  await upsert("contract_playbooks", contractPlaybooks, "id");

  const compliancePlaybooks = [
    [6001, "CL", "081010", ["cold_chain_required", "phytosanitary_certificate", "temperature_log"], "Perissables: chaine du froid + controle phyto", "Perishables: cold chain + phytosanitary controls"],
    [6002, "US", "854231", ["dual_use_review", "end_user_screening", "license_check"], "Electronique sensible: screening dual-use", "Sensitive electronics: dual-use screening"],
    [6003, null, null, ["sanctions_screening", "counterparty_kyc", "beneficial_owner_check"], "Toujours verifier les contreparties et sanctions", "Always screen counterparties and sanctions"],
    [6004, "GB", null, ["uk_border_requirements", "import_vat_setup"], "Verifier formalites post-Brexit", "Check post-Brexit border requirements"],
    [6005, "MA", null, ["import_license_review", "arabic_labeling_check"], "Verifier etiquetage et exigences locales", "Check labeling and local requirements"],
  ].map(([idn, destination_iso2, hs6, red_flags, notes_fr, notes_en]) => ({
    id: mkUuid(idn),
    destination_iso2,
    hs6,
    red_flags,
    notes_fr,
    notes_en,
  }));
  await upsert("compliance_playbooks", compliancePlaybooks, "id");

  console.log("Export expert seed completed.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

