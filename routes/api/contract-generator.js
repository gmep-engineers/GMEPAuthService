var express = require("express");
var router = express.Router();
const { v1: uuidv1 } = require("uuid");

const getSqlConnection = require("../../lib/getSqlConnection");
const parsePhoneNumber = require("../../lib/parsePhoneNumber");

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

const getProject = async function (conn, projectId) {
  const query = `
  select * from projects where id = ?
  `;
  const [result] = await conn.query(query, [projectId]);
  if (result.length > 0) {
    return result[0];
  }
  return null;
};

const getCompany = async function (conn, companyId) {
  const query = `
  select 
  companies.name,
  companies.street_address,
  companies.street_address_2,
  companies.city,
  companies.postal_code,
  companies.primary_contact_id,
  emails_addresses.email_address,
  phone_numbers.phone_number,
  clients.loyaly_type_id
  from companies
  left join
  email_addr_entity_rel eaer on eaer.entity_id = companies.entity_id
  left join
  email_addresses on email_addresses.id = eaer.email_address_id
  left join
  phone_number_entity_rel pner on pner.entity_id = companies.entity_id
  left join
  phone_numbers on phone_numbers.id = pner.phone_number_id
  left join
  clients on clients.company_id = companies.id
  where companies.id = ?
  `;
  const [result] = await conn.query(query, [companyId]);
  if (result.length > 0) {
    return result[0];
  }
  return null;
};

const getContact = async function (conn, contactId) {
  const query = `
  select 
  contacts.first_name,
  contacts.last_name,  
  emails_addresses.email_address,
  phone_numbers.phone_number
  from contacts
  left join
  email_addr_entity_rel eaer on eaer.entity_id = contacts.entity_id
  left join
  email_addresses on email_addresses.id = eaer.email_address_id
  left join
  phone_number_entity_rel pner on pner.entity_id = contacts.entity_id
  left join
  phone_numbers on phone_numbers.id = pner.phone_number_id
  where contacts.id = ?
  `;
  const [result] = await conn.query(query, [contactId]);
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
    LegalTermsAndConditions: data.legal_terms_and_conditions,
  };
  return proposalData;
};

const updateProposal = async function (conn, proposal, data) {
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

router.get("/load", async function (req, res, next) {
  const conn = await getSqlConnection();
  try {
    const b = req.body;
    var proposal = await getProposal(conn, b.contract_metadata.contract_id);
    if (!proposal) {
      return res.status(400).send({ error: "proposal not found" });
    }
    var project = await getProject(conn, proposal.project_id);
    if (!project) {
      return res.status(400).send({ error: "proposal not found" });
    }
    var client = await getCompany(conn, project.client_company_id);
    if (!client) {
      return res.status(400).send({ error: "client not found" });
    }
    var contact = await getContact(conn, proposal.contact_id);

    var status = "Pending";
    switch (project.status_id) {
      case 2:
        status = "Executed";
        break;
      case 3:
        status = "Dead";
        break;
      case 4:
        status = "Denied";
        break;
      default:
        status = "Pending";
    }

    var loyaltyType = "Loyal";
    switch (company.loyalty_type_id) {
      case 2:
        loyaltyType = "Returning";
      case 3:
        loyaltyType = "New";
      default:
        loyaltyType = "Loyal";
    }

    var proposalType = "Commercial";
    if (proposal.type_id) {
      proposalType = "Residential";
    }

    var proposalData = JSON.parse(proposal.data);

    var payload = {
      contract_metadata: {
        format_version: "1.2.0",
        generated_at: "2026-02-13T00:46:00.320Z",
        jurisdiction: "Orange County, California",
        document_type: "Independent Contractor Agreement",
        status: status, // proposals - status_id
        contract_id: proposal.id, // proposals - id
      },
      parties: {
        client: {
          business_name: company.name, // companies - name
          contact_name: `${contact.first_name} ${contact.last_name}`, // contacts - first_name, last_name
          email: `${contact.email_address || client.email_address}`, // email_addresses - email_address
          phone: `${contact.phone_number || client.phone_number}`, // phone_numbers - phone_number
          address: {
            street: `${client.street_address} ${client.street_address_2 || ""}`, // companies - street_address
            city: client.city, // companies - city
            state: client.state, // companies - state
            zip_code: client.postal_code, // companies - postal_code
          },
          loyalty_tier: loyaltyType, // clients - loyalty_type_id
        },
        architect: {
          name: "GMEP Architects", // companies - name
        },
      },
      project_details: {
        name: project.gmep_project_name, // projects - gmep_project_name
        address: `${project.street_address}, ${project.city}, ${project.state} ${project.postal_code}`, // projects - street_address, city, state, postal_code
        project_category: proposalType, // proposals - type_id
        project_type: proposalData.NewConstruction
          ? "New Construction"
          : "Tenant Improvement", // proposals - data (NewConstruction)
        features: {
          initial_recommendations_meeting:
            proposalData.HasInitialRecommendationsMeeting, // proposals - data (HasInitialRecommendationsMeeting)
          indoor_common_area: proposalData.HasIndoorCommonArea, // proposals - data (HasIndoorCommonArea)
          commercial_shell_connection:
            proposalData.HasCommercialShellConnection, // proposals - data (HasCommercialShellConnection)
          garage_exhaust: proposalData.HasGarageExhaust, // proposals - data (HasGarageExhaust)
          emergency_power: proposalData.HasEmergencyPower, // proposals - data (HasEmergencyPower)
          site_lighting: proposalData.HasSiteLighting, // proposals - data (HasSiteLighting)
          site_visit: proposalData.HasSiteVisit, // proposals - data (HasSiteVisit)
        },
        structural_descriptions: {
          geotechnical_foundation_type:
            proposalData.StructuralScope.StructuralGeoReport, // proposals - data (StructuralScope.StructuralGeoReport)
          structural_framing_depths:
            proposalData.StructuralScope.StructuralFramingDepths, // proposals - data (StructuralScope.StructuralFramingDepths)
          structural_analysis_design:
            proposalData.StructuralScope.StructuralAnalysis, // proposals - data (StructuralScope.StructuralAnalysis)
          structural_plans: proposalData.StructuralScope.StructuralPlans, // proposals - data (StructuralScope.StructuralPlans)
          details_and_calculations:
            proposalData.StructuralScope.StructuralDetailsCalculations, // proposals - data (StructuralScope.StructuralDetailsCalculations)
          code_compliance:
            proposalData.StructuralScope.StructuralCodeCompliance, // proposals - data (StructuralScope.StructuralCodeCompliance)
        },
        mechanical_descriptions: {
          exhaust_and_supply:
            proposalData.MechanicalScope.MechanicalExhaustAndSupply, // proposals - data (MechanicalScope.MechanicalExhaustAndSupply)
          hvac_equipment_specifications:
            proposalData.MechanicalScope.MechanicalHvacEquipSpec, // proposals - data (MechanicalScope.MechanicalHvacEquipSpec)
          title_24: proposalData.MechanicalScope.MechanicalTitle24, // proposals - data (MechanicalScope.MechanicalTitle24)
        },
        electrical_descriptions: {
          electrical_power_design:
            proposalData.ElectricalScope.ElectricalPowerDesign, // proposals - data (ElectricalScope.ElectricalPowerDesign)
          service_load_calculation:
            proposalData.ElectricalScope.ElectricalServiceLoadCalc, // proposals - data (ElectricalScope.ElectricalServiceLoadCalc)
          single_line_diagram:
            proposalData.ElectricalScope.ElectricalSingleLineDiagram, // proposals - data (ElectricalScope.ElectricalSingleLineDiagram)
          electrical_lighting_design:
            proposalData.ElectricalScope.ElectricalLightingDesign, // proposals - data (ElectricalScope.ElectricalLightingDesign)
          electrical_photometric:
            proposalData.ElectricalScope.ElectricalPhotometric, // proposals - data (ElectricalScope.ElectricalPhotometric)
        },
        plumbing_descriptions: {
          hot_and_cold_water_piping:
            proposalData.PlumbingScope.PlumbingHotColdWater, // proposals - data (PlumbingScope.PlumbingHotColdWater)
          sewer_and_vent_piping: proposalData.PlumbingScope.PlumbingWasteVent, // proposals - data (PlumbingScope.PlumbingWasteVent)
        },
        description: project.description, // projects - descriptions
        timeline: {
          date_drawings_received: proposalData.DateDrawingsReceived, // proposals - data (DateDrawingsReceived)
          date_sent: proposalData.DateSent, // proposals - data (DateSent)
        },
      },
      financial_provisions: {
        total_fee: {
          amount: proposalData.TotalPrice, // proposals - data (TotalPrice)
          currency: "USD",
        },
        retainer_percentage: 0,
        payment_terms: "100% due upon signing contract",
      },
      administration_details: {
        ca_hours: proposalData.MaxAdminHours, // proposals - data (MaxAdminHours)
        coordination_hours: proposalData.BudgetedAdminHours, // proposals - data (BudgetedAdminHours)
      },
      legal_terms_and_conditions: proposalData.LegalTermsAndConditions, // proposals - data (LegalTermsAndConditions)
    };
    res.status(200).send(payload);
  } catch (err) {
    console.error(err);
  }
});
router.post("/save", async function (req, res, next) {
  const conn = await getSqlConnection();
  try {
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
  } catch (err) {
    console.error(err);
  }
  conn.destroy();
  res.status(201).send();
});
