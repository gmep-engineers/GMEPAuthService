var express = require("express");
var router = express.Router();
const { v1: uuidv1 } = require("uuid");

const getSqlConnection = require("../../lib/getSqlConnection");
const parsePhoneNumber = require("../../lib/parsePhoneNumber");
var d = {
  contract_metadata: {
    format_version: "1.2.0",
    generated_at: "2026-02-13T00:46:00.320Z",
    jurisdiction: "Orange County, California",
    document_type: "Independent Contractor Agreement",
    status: "Approved", // proposals - status_id
    contract_id: "f2a3bd23-53cf-4583-ab1c-3316fe8b8d7e", // proposals - id
  },
  parties: {
    client: {
      business_name: "", // companies - name
      contact_name: "", // contacts - first_name, last_name
      email: "", // email_addresses - email_address
      phone: "", // phone_numbers - phone_number
      address: {
        street: "", // companies - street_address
        city: "", // companies - city
        state: "", // companies - state
        zip_code: "", // companies - postal_code
      },
      loyalty_tier: "New", // clients - loyalty_type_id
    },
    architect: {
      name: "GMEP Architects", // companies - name
    },
  },
  project_details: {
    name: "", // projects - gmep_project_name
    address: "", // projects - street_address, city, state, postal_code
    project_category: "Commercial", // proposals - type_id
    project_type: "New Construction", // proposals - data (NewConstruction)
    features: {
      initial_recommendations_meeting: false, // proposals - data (HasInitialRecommendationsMeeting)
      indoor_common_area: false, // proposals - data (HasIndoorCommonArea)
      commercial_shell_connection: false, // proposals - data (HasCommercialShellConnection)
      garage_exhaust: false, // proposals - data (HasGarageExhaust)
      emergency_power: false, // proposals - data (HasEmergencyPower)
      site_lighting: false, // proposals - data (HasSiteLighting)
      site_visit: false, // proposals - data (HasSiteVisit)
    },
    structural_descriptions: {
      geotechnical_foundation_type: false, // proposals - data (StructuralScope.StructuralGeoReport)
      structural_framing_depths: false, // proposals - data (StructuralScope.StructuralFramingDepths)
      structural_analysis_design: false, // proposals - data (StructuralScope.StructuralAnalysis)
      structural_plans: false, // proposals - data (StructuralScope.StructuralPlans)
      details_and_calculations: false, // proposals - data (StructuralScope.StructuralDetailsCalculations)
      code_compliance: false, // proposals - data (StructuralScope.StructuralCodeCompliance)
    },
    mechanical_descriptions: {
      exhaust_and_supply: false, // proposals - data (MechanicalScope.MechanicalExhaustAndSupply)
      hvac_equipment_specifications: false, // proposals - data (MechanicalScope.MechanicalHvacEquipSpec)
      title_24: false, // proposals - data (MechanicalScope.MechanicalTitle24)
    },
    electrical_descriptions: {
      electrical_power_design: false, // proposals - data (ElectricalScope.ElectricalPowerDesign)
      service_load_calculation: false, // proposals - data (ElectricalScope.ElectricalServiceLoadCalc)
      single_line_diagram: false, // proposals - data (ElectricalScope.ElectricalSingleLineDiagram)
      electrical_lighting_design: false, // proposals - data (ElectricalScope.ElectricalLightingDesign)
      electrical_photometric: false, // proposals - data (ElectricalScope.ElectricalPhotometric)
    },
    plumbing_descriptions: {
      hot_and_cold_water_piping: false, // proposals - data (PlumbingScope.PlumbingHotColdWater)
      sewer_and_vent_piping: false, // proposals - data (PlumbingScope.PlumbingWasteVent)
    },
    description: "", // projects - descriptions
    timeline: {
      date_drawings_received: "", // projects - data (DateDrawingsReceived)
      date_sent: "", // projects - data (DateSent)
    },
  },
  financial_provisions: {
    total_fee: {
      amount: 0, // projects - data (TotalPrice)
      currency: "USD",
    },
    retainer_percentage: 0,
    payment_terms: "100% due upon signing contract",
  },
  administration_details: {
    ca_hours: 3333, // proposals - data (MaxAdminHours)
    coordination_hours: 0, // proposals - data (BudgetedAdminHours)
  },
  legal_terms_and_conditions: [
    {
      id: 1,
      provision:
        "GMEP will perform its Services under this Agreement in a timely manner consistent with similar engineers providing similar services for similar projects, in accordance with generally and currently accepted engineering principles and practices, and without any warranties either express or implied.",
    },
  ],
};

const getProposal = async function (conn, proposalId) {
  const query = `
  select * from proposals where id = ?
  `;
  const [result] = await conn.query(query, [proposalId]);
  if (result.length > 0) {
    return result[0];
  }
  return null;
};

const getCompanyId = async function (conn, name, email, phone) {
  var query = "";
  var companyId = "";
  var result = [];
  if (!companyId && email) {
    var query = `
    select
    companies.id
    from companies
    left join
    entities on entites.id = companies.entity_id
    left join
    email_addr_entity_rel on email_addr_entity_rel.entity_id = entities.id
    left join
    email_addresses on email_addresses.id = email_addr_entity_rel.email_address_id
    where lower(email_address) = ?
    `;
    [result] = await conn.query(query, [email.toLowerCase()]);
    if (result.length > 0) {
      companyId = result[0].id;
    }
  }
  if (!companyId && email) {
    query = `
    select
    companies.id
    from companies
    left join
    contacts on contacts.company_id = companies.id
    left join
    entities on entites.id = contacts.entity_id
    left join
    email_addr_entity_rel on email_addr_entity_rel.entity_id = entities.id
    left join
    email_addresses on email_addresses.id = email_addr_entity_rel.email_address_id
    where lower(email_address) = ?
    `;
    [result] = await conn.query(query, [email.toLowerCase()]);
    if (result.length > 0) {
      companyId = result[0].id;
    }
  }
  const phoneNumber = parsePhoneNumber(phone);
  if (!companyId && phoneNumber) {
    query = `
    select
    companies.id
    from companies
    left join
    entities on entites.id = companies.entity_id
    left join
    phone_number_entity_rel on phone_number_entity_rel.entity_id = entities.id
    left join
    phone_numbers on phone_numbers.id = phone_number_entity_rel.phone_number_id
    where phone_numbers.phone_number = ?
    `;
    [result] = await conn.query(query, [phone]);
    if (result.length > 0) {
      companyId = result[0].id;
    }
  }
  if (!companyId && phoneNumber) {
    query = `
    select
    companies.id
    from companies
    left join
    contacts on contacts.company_id = companies.id
    left join
    entities on entites.id = contacts.entity_id    
    left join
    phone_number_entity_rel on phone_number_entity_rel.entity_id = entities.id
    left join
    phone_numbers on phone_numbers.id = phone_number_entity_rel.phone_number_id
    where phone_numbers.phone_number = ?
    `;
    [result] = await conn.query(query, [phone]);
    if (result.length > 0) {
      companyId = result[0].id;
    }
  }
  if (!companyId && name) {
    query = `
    select companies.id
    from companies
    where lower(name) like %?%
    `;
    [result] = await conn.query(query, [name]);
    if (result.length > 0) {
      companyId = result[0].id;
    }
  }
  return companyId;
};

const getProposalDataFromRequest = function (data) {
  var f = data.project_details.features;
  var s = data.project_details.structural_descriptions;
  var m = data.project_details.mechanical_descriptions;
  var e = data.project_details.electrical_descriptions;
  var p = data.project_details.plumbing_descriptions;

  // proposals table data
  var proposalData = {
    HasInitialRecommendationsMeeting: f.initial_recommendations_meeting,
    HasIndoorCommonArea: f.indoor_common_area,
    HasCommercialShellConnection: f.commercial_shell_connection,
    HasGarageExhaust: f.garage_exhaust,
    HasEmergencyPower: f.emergency_power,
    HasSiteLighting: f.site_lighting,
    HasSiteVisit: f.site_visit,
    StructuralScope: {
      StructuralGeoReport: s.geotechnical_foundation_type,
      StructuralFramingDepths: s.structural_framing_depths,
      StructuralAnalysis: s.structural_analysis_design,
      StructuralPlans: s.structural_plans,
      StructuralDetailsCalculations: s.details_and_calculations,
      StructuralCodeCompliance: s.code_compliance,
    },
    MechanicalScope: {
      MechanicalExhaustAndSupply: m.exhaust_and_supply,
      MechanicalHvacEquipSpec: m.hvac_equipment_specifications,
      MechanicalTitle24: m.title_24,
    },
    ElectricalScope: {
      ElectricalPowerDesign: e.electrical_power_design,
      ElectricalServiceLoadCalc: e.service_load_calculation,
      ElectricalSingleLineDiagram: e.single_line_diagram,
      ElectricalLightingDesign: e.electrical_lighting_design,
      ElectricalPhotometric: e.electrical_photometric,
    },
    PlumbingScope: {
      PlumbingHotColdWater: p.hot_and_cold_water_piping,
      PlumbingWasteVent: p.sewer_and_vent_piping,
    },
    DateDrawingsReceived: data.project_details.date_drawings_received,
    DateSent: data.project_details.date_sent,
    TotalPrice: data.financial_provisions.total_fee.amount,
    MaxAdminHours: data.administration_details.ca_hours,
    BudgetedAdminHours: data.administration_details.coordination_hours,
    NewConstruction: data.project_details.project_type === "New Construction",
  };
  return proposalData;
};

const updateProposal = async function (conn, proposal, data) {
  var type_id = 1;
  if (data.project_category === "Residential") {
    type_id = 2;
  }

  var proposalData = getCompanyIdFromProposalData(data);
  var status_id = 1;

  var status = data.contract_metadata.status;
  if (status === "Pending") {
    status_id = 1;
  }
  if (status === "Executed") {
    status_id = 2;
  }
  if (status === "Dead") {
    status_id = 3;
  }
  if (status === "Denied") {
    status_id = 4;
  }
  if (status === "Approved") {
    status_id = 5;
  }

  var query = `
  update proposals set
  status_id = ?,
  type_id = ?,
  data = ?,
  fees = ?
  where id = ?
  `;

  await conn.query(query, [
    status_id,
    type_id,
    JSON.stringify(proposalData),
    data.financial_provisions.total_fee.amount,
    proposal.id,
  ]);

  // projects table data

  var gmep_project_name = data.project_details.name;
  var addrArr = data.project_details.address.replaceAll("  ", " ").split(",");
  var address = {};
  if (addrArr.length === 3) {
    address.street_address = addrArr[0];
    address.city = addrArr[1];
    var stateZip = addrArr[2];
    if (stateZip.length === 2) {
      address.state = stateZip.split(" ")[0];
      address.postal_code = stateZip.split(" ")[1];
    }
  }
  var descriptions = data.project_details.descriptions;

  query = `
  update projects set
  gmep_project_name = ?,
  street_address = ?,
  city = ?, 
  state = ?,
  postal_code = ?,
  descriptions = ?
  where id = ?
  `;
  await conn.query(query, [
    gmep_project_name,
    address.street_address,
    address.city,
    address.state,
    address.postal_code,
    descriptions,
    proposal.project_id,
  ]);
};

const createProposal = async function (
  conn,
  clientCompanyId,
  architectCompanyId,
  data
) {
  const projectDetails = data.project_details;
  const structuralDescriptions = projectDetails.structural_descriptions;
  const mechanicalDescriptions = projectDetails.mechanical_descriptions;
  const electricalDescriptions = projectDetails.electrical_descriptions;
  const plumbingDescriptions = projectDetails.plumbing_descriptions;

  var includeStructural = false;
  var includeMechanical = false;
  var includeElectrical = false;
  var includePlumbing = false;

  var structuralKeys = Object.keys(structuralDescriptions);
  for (let i of structuralKeys) {
    if (structuralDescriptions[i]) {
      includeStructural = true;
    }
  }
  var mechanicalKeys = Object.keys(mechanicalDescriptions);
  for (let i of mechanicalKeys) {
    if (mechanicalDescriptions[i]) {
      includeMechanical = true;
    }
  }
  var electricalKeys = Object.keys(electricalDescriptions);
  for (let i of electricalKeys) {
    if (electricalDescriptions[i]) {
      includeElectrical = true;
    }
  }
  var plumbingKeys = Object.keys(plumbingDescriptions);
  for (let i of plumbingKeys) {
    if (plumbingDescriptions[i]) {
      includePlumbing = true;
    }
  }
  // create project
  var query = `
  insert into projects
  (id, gmep_project_no, gmep_project_name, s, m, e, p, street_address, city, state, postal_code, client_company_id, architect_company_id, descriptions) values
  ( ?,               ?,                 ?, ?, ?, ?, ?,              ?,    ?,     ?,           ?,                 ?,                    ?,            ?)
  `;

  var projectId = uuidv1();

  var projectNumber = `n${uuidv1().slice(0, 6)}`;

  var gmep_project_name = data.project_details.name;
  var addrArr = data.project_details.address.replaceAll("  ", " ").split(",");
  var address = {};
  if (addrArr.length === 3) {
    address.street_address = addrArr[0];
    address.city = addrArr[1];
    var stateZip = addrArr[2];
    if (stateZip.length === 2) {
      address.state = stateZip.split(" ")[0];
      address.postal_code = stateZip.split(" ")[1];
    }
  }
  var descriptions = data.project_details.descriptions;

  await conn.query(query, [
    projectId,
    projectNumber,
    gmep_project_name,
    includeStructural,
    includeMechanical,
    includeElectrical,
    includePlumbing,
    street_address,
    city,
    state,
    postal_code,
    clientCompanyId,
    architectCompanyId,
    descriptions,
  ]);

  // create proposal
  var type_id = 1;
  if (data.project_category === "Residential") {
    type_id = 2;
  }

  var proposalData = getProposalDataFromRequest(data);
  var status_id = 1;

  var status = data.contract_metadata.status;
  if (status === "Pending") {
    status_id = 1;
  }
  if (status === "Executed") {
    status_id = 2;
  }
  if (status === "Dead") {
    status_id = 3;
  }
  if (status === "Denied") {
    status_id = 4;
  }
  if (status === "Approved") {
    status_id = 5;
  }

  var query = `
  insert into proposals 
  (status_id, type_id, data, fees, id) values
  (        ?,       ?,    ?,    ?,  ?)
  `;

  var proposalId = uuidv1();
  await conn.query(query, [
    status_id,
    type_id,
    proposalData,
    proposalData.TotalPrice,
    proposalId,
  ]);
};

router.get("/load", async function (req, res, next) {});
router.post("/save", async function (req, res, next) {
  const conn = await getSqlConnection();
  const b = req.body;
  var proposal = await getProposal(conn, b.contract_metadata.contract_id);
  if (proposal) {
    // update proposal
    await updateProposal(conn, proposal, b);
    return res.status(201).send({});
  }
  var clientCompanyId = await getCompanyId(
    conn,
    b.parties.client.business_name,
    b.parties.client.email,
    b.parties.client.phone
  );

  var architectCompanyId = await getCompanyId(conn, b.parties.architect.name);
  if (clientCompanyId) {
    // create new proposal for company
    await createProposal(conn, clientCompanyId, architectCompanyId, b);
  } else {
    // save the proposal in local storage until the user imports the company from netsuite
  }

  conn.destroy();
  res.status(201).send();
});
