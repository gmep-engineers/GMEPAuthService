const { exec } = require("child_process");
var express = require("express");
var router = express.Router();
var fs = require("fs");
var path = require("path");
const { v4: uuidv4 } = require("uuid");
const ejs = require("ejs");
const paymentScheduleTable = require("../../components/paymentScheduleTable");

const finalize = async function (req, res, filename, params) {
  const templateId = uuidv4();

  await new Promise((resolve, reject) => {
    ejs.renderFile(
      path.join(__dirname, "pdf_templates", filename),
      params,
      (err, str) => {
        if (!err) {
          fs.writeFileSync(
            path.join(__dirname, "input", filename + templateId + ".html"),
            str
          );
          filename = filename + templateId + ".html";
          resolve();
        } else {
          console.log(err);
          reject();
        }
      }
    );
  });

  var footerTemplate = fs.readFileSync(
    path.join(__dirname, "pdf_templates", "footer.html"),
    "utf8"
  );
  footerTemplate = footerTemplate.replace("$ProjectName", req.body.ProjectName);
  fs.writeFileSync(
    path.join(__dirname, "input", `formatted-footer-${templateId}.html`),
    footerTemplate
  );
  exec(
    `wkhtmltopdf --enable-local-file-access --header-html "file://${path.join(
      __dirname,
      "pdf_templates",
      "header.html"
    )}" --footer-html "file://${path.join(
      __dirname,
      "input",
      `formatted-footer-${templateId}.html`
    )}" --page-size Letter -B 25.4mm "${path.join(
      __dirname,
      "input",
      filename
    )}" routes/api/output/${filename}.pdf`,
    (err, stdout, stderr) => {
      fs.unlinkSync(
        path.join(__dirname, "input", `formatted-footer-${templateId}.html`)
      );
      fs.unlinkSync(path.join(__dirname, "input", filename));
      if (err) {
        console.log("wkhtmltopdf err");
        console.error(err);
        return res.status(500).send(err);
      } else if (stderr && stderr.code) {
        console.log("wkhtmltopdf stderr");
        console.log(stderr.code);
        console.error(stderr);
        return res.status(500).send(stderr);
      }
      res.sendFile(path.join(__dirname, "output", filename + ".pdf"), (err) => {
        if (err) {
          console.log("sendFile stderr");
          console.error(err);
          return res.status(500).send(err);
        }
        fs.unlinkSync(`routes/api/output/${filename}.pdf`);
      });
    }
  );
};

const getNextLetter = function (letter) {
  var letters = "ABCDEFGabcdefg";
  var index = letters.indexOf(letter);
  return letters[index + 1];
};

const getNextRomanNumeral = function (romanNumeral) {
  var romanNumerals = ["i", "ii", "iii", "iv", "v", "vi", "vii"];
  var index = romanNumerals.indexOf(romanNumeral);
  return romanNumerals[index + 1];
};

const feeToHours = function (fee) {
  if (fee <= 2000) {
    return 1;
  }
  if (fee <= 5000) {
    return 1.5;
  }
  if (fee <= 10000) {
    return 4;
  }
  if (fee <= 20000) {
    return 10;
  }
  if (fee <= 50000) {
    return 20;
  }
  return -1;
};

const formatPhone = function (phone) {
  if (!phone) {
    return "";
  }
  if (phone.length === 10) {
    const areaCode = phone.slice(0, 3);
    const prefix = phone.slice(3, 6);
    const suffix = phone.slice(6, 10);
    return `${areaCode}-${prefix}-${suffix}`;
  } else {
    return phone;
  }
};

const getGeminiParams = function (b) {
  const params = {
    NewConstruction: b.project_details.project_type === "New Construction",
    ProjectName: b.project_details.name,
    ProjectAddress: b.project_details.address,
    Client: b.parties.client.business_name,
    Architect: b.parties.architect.name,
    DateSent: b.project_details.timeline.date_sent,
    DateDrawingsReceived: b.project_details.timeline.date_drawings_received,
    ProjectDescriptions: b.project_details.description,
    TotalPrice: b.financial_provisions.total_fee.amount,
    BudgetedAdminHours: b.administration_details.coordination_hours,
    MaxAdminHours: b.administration_details.ca_hours,
    ClientType: b.parties.client.loyalty_tier.toLowerCase(),
    HasSiteVisit: b.project_details.features.site_visit,
    RetainerPercent: b.financial_provisions.retainer_percentage,
    ClientContactName: b.parties.client.contact_name,
    ClientBusinessName: b.parties.client.business_name,
    ClientStreetAddress: b.parties.client.address.street,
    ClientCityStateZip: `${b.parties.client.address.city}, ${b.parties.client.address.state} ${b.parties.client.address.zip_code}`,
    ClientEmail: b.parties.client.email,
    ClientPhone: b.parties.client.phone,
    NumMeetings: 0,
    HasInitialRecommendationsMeeting: false,
  };
  return params;
};

const setDescriptionParams = function (projectDetails, params) {
  console.log(projectDetails);
  const structuralDescriptions = projectDetails.structuralDescriptions;
  const mechanicalDescriptions = projectDetails.mechanicalDescriptions;
  const electricalDescriptions = projectDetails.electricalDescriptions;
  const plumbingDescriptions = projectDetails.plumbingDescriptions;
  var structuralDescriptionsStr = "";
  var mechanicalDescriptionsStr = "";
  var electricalDescriptionsStr = "";
  var plumbingDescriptionsStr = "";

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

  if (includeStructural) {
    if (params.NewConstruction) {
      structuralDescriptionsStr =
        "New Construction: engineering for Structural design";
    } else {
      structuralDescriptionsStr =
        "Tenant Improvement: engineering for Structural design";
    }

    if (structuralDescriptions.geotechnical_foundation_type) {
      structuralDescriptionsStr +=
        ", Review geotechnical report and define foundation type";
    }
    if (structuralDescriptions.structural_framing_depths) {
      structuralDescriptionsStr +=
        ", Perform structural analysis and design for all gravity and lateral load resisting elements";
    }
    if (structuralDescriptions.structural_analysis_design) {
      structuralDescriptionsStr += ", Title 24";
    }
    if (structuralDescriptions.structural_plans) {
      structuralDescriptionsStr += ", Structural Plans";
    }
    if (structuralDescriptions.details_and_calculations) {
      structuralDescriptionsStr += ", Details and calculations";
    }
    if (structuralDescriptions.code_compliance) {
      structuralDescriptionsStr += ", Building structural to comply with code";
    }
  }
  if (includeMechanical) {
    if (params.NewConstruction) {
      mechanicalDescriptionsStr +=
        "New Construction: engineering for Mechanical design";
    } else {
      mechanicalDescriptionsStr +=
        "Tenant Improvement: engineering for HVAC design";
    }
    if (mechanicalDescriptions.exhaust_and_supply) {
      mechanicalDescriptionsStr += ", exhaust and supply";
    }
    if (mechanicalDescriptions.hvac_equipment_specifications) {
      mechanicalDescriptionsStr += ", HVAC equipment specifications";
    }
    if (mechanicalDescriptions.title_24) {
      mechanicalDescriptionsStr += ", Title 24";
    }
  }

  if (includeElectrical) {
    if (params.NewConstruction) {
      electricalDescriptionsStr +=
        "New Construction: engineering for Electrical design";
    } else {
      electricalDescriptionsStr +=
        "Tenant Improvement: engineering for Electrical design";
    }
    if (electricalDescriptions.electrical_power_design) {
      electricalDescriptionsStr += ", Electrical power design";
    }
    if (electricalDescriptions.service_load_calculation) {
      electricalDescriptionsStr += ", Service load calculation";
    }
    if (electricalDescriptions.single_line_diagram) {
      electricalDescriptionsStr += ", Single line diagrams";
    }
    if (electricalDescriptions.electrical_lighting_design) {
      electricalDescriptionsStr += ", Electrical lighting design";
    }
    if (electricalDescriptions.electrical_photometric) {
      electricalDescriptionsStr += ", Electrical photometric";
    }
  }

  if (includePlumbing) {
    if (params.NewConstruction) {
      plumbingDescriptionsStr +=
        "New Construction: engineering for Plumbing design";
    } else {
      plumbingDescriptionsStr +=
        "Tenant Improvement: engineering for Plumbing design";
    }
    if (plumbingDescriptions.hot_and_cold_water_piping) {
      plumbingDescriptionsStr += ", Hot and cold water piping design";
    }
    if (plumbingDescriptions.sewer_and_vent_piping) {
      plumbingDescriptionsStr += ", Sewer and vent piping design";
    }
  }

  params.StructuralDescriptions = structuralDescriptionsStr;
  params.MechanicalDescriptions = mechanicalDescriptionsStr;
  params.ElectricalDescriptions = electricalDescriptionsStr;
  params.PlumbingDescriptions = plumbingDescriptionsStr;
};

const setFunctionParams = function (params) {
  params.getNextLetter = getNextLetter;

  params.letter = "";
  params.romanNumeral = "";
  params.number = 1;

  params.getNextRomanNumeral = getNextRomanNumeral;
};

const setScopeDepartmentListParams = function (params) {
  var ScopeDepartmentList = [];

  if (params.StructuralDescriptions) {
    ScopeDepartmentList.push("structural");
  }
  if (params.MechanicalDescriptions) {
    ScopeDepartmentList.push("mechanical");
  }
  if (params.ElectricalDescriptions) {
    ScopeDepartmentList.push("electrical");
  }
  if (params.PlumbingDescriptions) {
    ScopeDepartmentList.push("plumbing");
  }

  if (ScopeDepartmentList.length === 1) {
    params.ScopeDepartmentList = ScopeDepartmentList[0];
  } else if (ScopeDepartmentList.length === 2) {
    params.ScopeDepartmentList = `${ScopeDepartmentList[0]} and ${ScopeDepartmentList[1]}`;
  } else if (ScopeDepartmentList.length === 3) {
    params.ScopeDepartmentList = `${ScopeDepartmentList[0]}, ${ScopeDepartmentList[1]}, and ${ScopeDepartmentList[2]}`;
  } else if (ScopeDepartmentList.length === 4) {
    params.ScopeDepartmentList = `${ScopeDepartmentList[0]}, ${ScopeDepartmentList[1]}, ${ScopeDepartmentList[2]}, and ${ScopeDepartmentList[3]}`;
  }
};

router.post("/commercial2", async function (req, res, next) {
  // accept the json from the gemini app
  // port all the values over to ours
  // save client information in the database if it isn't in the database yet
  // generate pdf

  const b = req.body;
  console.log(b);
  const params = getGeminiParams(b);
  console.log(params);
  setDescriptionParams(params);
  setFunctionParams(params);
  setScopeDepartmentListParams(params);
  if (params.ScopeDepartmentList.length === 0) {
    return res.status(400).send({ error: "scope department list empty" });
  }
  params.htmlPaymentScheduleTable = await paymentScheduleTable(params);

  await finalize(req, res, filename, params);
});

router.post("/commercial", async function (req, res, next) {
  var filename = "commercial-proposal-template.ejs";

  var params = {};

  params.NewConstruction = req.body.NewConstruction;

  params.ProjectName = req.body.ProjectName;
  params.ProjectAddress = req.body.ProjectAddress;
  params.Client = req.body.Client;
  params.Architect = req.body.Architect;
  params.DateSent = req.body.DateSent;

  params.ProjectDescriptions = req.body.ProjectDescriptions;

  params.MechanicalDescriptions = req.body.MechanicalDescriptions;
  params.PlumbingDescriptions = req.body.PlumbingDescriptions;
  params.ElectricalDescriptions = req.body.ElectricalDescriptions;
  params.StructuralDescriptions = req.body.StructuralDescriptions;

  params.TotalPrice = req.body.TotalPrice;
  if (!req.body.BudgetedAdminHours) {
    params.BudgetedAdminHours = feeToHours(parseInt(params.TotalPrice));
  } else {
    params.BudgetedAdminHours = parseInt(req.body.BudgetedAdminHours);
  }

  if (!req.body.MaxAdminHours) {
    params.MaxAdminHours = 10;
  } else {
    params.MaxAdminHours = parseInt(req.body.MaxAdminHours);
  }

  params.ClientType = req.body.ClientType;

  params.HasSiteVisit = req.body.HasSiteVisit;

  params.RetainerPercent = req.body.RetainerPercent;

  params.ClientContactName = req.body.ClientContactName;
  params.ClientBusinessName = req.body.ClientBusinessName;
  params.ClientStreetAddress = req.body.ClientStreetAddress;
  params.ClientCityStateZip = req.body.ClientCityStateZip;

  params.ClientEmail = req.body.ClientEmail;
  params.ClientPhone = formatPhone(req.body.ClientPhone);

  params.DateDrawingsReceived = req.body.DateDrawingsReceived;

  var ScopeDepartmentList = [];

  if (params.StructuralDescriptions) {
    ScopeDepartmentList.push("structural");
  }
  if (params.MechanicalDescriptions) {
    ScopeDepartmentList.push("mechanical");
  }
  if (params.ElectricalDescriptions) {
    ScopeDepartmentList.push("electrical");
  }
  if (params.PlumbingDescriptions) {
    ScopeDepartmentList.push("plumbing");
  }

  if (ScopeDepartmentList.length === 1) {
    params.ScopeDepartmentList = ScopeDepartmentList[0];
  } else if (ScopeDepartmentList.length === 2) {
    params.ScopeDepartmentList = `${ScopeDepartmentList[0]} and ${ScopeDepartmentList[1]}`;
  } else if (ScopeDepartmentList.length === 3) {
    params.ScopeDepartmentList = `${ScopeDepartmentList[0]}, ${ScopeDepartmentList[1]}, and ${ScopeDepartmentList[2]}`;
  } else if (ScopeDepartmentList.length === 4) {
    params.ScopeDepartmentList = `${ScopeDepartmentList[0]}, ${ScopeDepartmentList[1]}, ${ScopeDepartmentList[2]}, and ${ScopeDepartmentList[3]}`;
  } else {
    return res.status(400).send({ error: "scope department list empty" });
  }

  params.NumMeetings = req.body.NumMeetings;
  params.HasInitialRecommendationsMeeting =
    req.body.HasInitialRecommendationsMeeting;

  params.getNextLetter = getNextLetter;

  params.letter = "";
  params.romanNumeral = "";
  params.number = 1;

  params.getNextRomanNumeral = getNextRomanNumeral;

  params.htmlPaymentScheduleTable = await paymentScheduleTable(params);

  await finalize(req, res, filename, params);
});

router.post("/site-lighting-tarrar", async (req, res) => {
  var filename = "site-lighting-tarrar-proposal-template.ejs";

  var params = {};

  params.NewConstruction = req.body.NewConstruction;

  params.ProjectName = req.body.ProjectName;
  params.ProjectAddress = req.body.ProjectAddress;
  params.TarrarNo = req.body.TarrarNo;
  params.DateSent = req.body.DateSent;

  await finalize(req, res, filename, params);
});

router.post("/t24", async (req, res) => {
  var filename = "t24-proposal-template.ejs";

  var params = {};

  params.NewConstruction = req.body.NewConstruction;

  params.ProjectName = req.body.ProjectName;
  params.ProjectAddress = req.body.ProjectAddress;
  params.Client = req.body.Client;
  params.Architect = req.body.Architect;
  params.DateSent = req.body.DateSent;

  params.ClientContactName = req.body.ClientContactName;
  params.ClientBusinessName = req.body.ClientBusinessName;
  params.ClientStreetAddress = req.body.ClientStreetAddress;
  params.ClientCityStateZip = req.body.ClientCityStateZip;

  params.DateDrawingsReceived = req.body.DateDrawingsReceived;

  await finalize(req, res, filename, params);
});

router.post("/residential", async (req, res) => {
  var filename = "residential-proposal-template.ejs";

  var params = {};

  params.NewConstruction = req.body.NewConstruction;

  params.ProjectName = req.body.ProjectName;
  params.ProjectAddress = req.body.ProjectAddress;
  params.Client = req.body.Client;
  params.Architect = req.body.Architect;
  params.DateSent = req.body.DateSent;

  params.ProjectDescriptions = req.body.ProjectDescriptions;

  params.MechanicalDescriptions = req.body.MechanicalDescriptions;
  params.PlumbingDescriptions = req.body.PlumbingDescriptions;
  params.ElectricalDescriptions = req.body.ElectricalDescriptions;
  params.StructuralDescriptions = req.body.StructuralDescriptions;

  params.TotalPrice = req.body.TotalPrice;
  if (!req.body.BudgetedAdminHours) {
    params.BudgetedAdminHours = feeToHours(parseInt(params.TotalPrice));
  } else {
    params.BudgetedAdminHours = parseInt(req.body.BudgetedAdminHours);
  }

  if (!req.body.MaxAdminHours) {
    params.MaxAdminHours = 10;
  } else {
    params.MaxAdminHours = parseInt(req.body.MaxAdminHours);
  }

  params.ClientType = req.body.ClientType;

  params.HasSiteVisit = req.body.HasSiteVisit;

  params.RetainerPercent = req.body.RetainerPercent;

  params.ClientContactName = req.body.ClientContactName;
  params.ClientBusinessName = req.body.ClientBusinessName;
  params.ClientStreetAddress = req.body.ClientStreetAddress;
  params.ClientCityStateZip = req.body.ClientCityStateZip;
  params.ClientEmail = req.body.ClientEmail;
  params.ClientPhone = formatPhone(req.body.ClientPhone);

  params.DateDrawingsReceived = req.body.DateDrawingsReceived;

  var ScopeDepartmentList = [];

  if (params.StructuralDescriptions) {
    ScopeDepartmentList.push("structural");
  }
  if (params.MechanicalDescriptions) {
    ScopeDepartmentList.push("mechanical");
  }
  if (params.ElectricalDescriptions) {
    ScopeDepartmentList.push("electrical");
  }
  if (params.PlumbingDescriptions) {
    ScopeDepartmentList.push("plumbing");
  }

  if (ScopeDepartmentList.length === 1) {
    params.ScopeDepartmentList = ScopeDepartmentList[0];
  } else if (ScopeDepartmentList.length === 2) {
    params.ScopeDepartmentList = `${ScopeDepartmentList[0]} and ${ScopeDepartmentList[1]}`;
  } else if (ScopeDepartmentList.length === 3) {
    params.ScopeDepartmentList = `${ScopeDepartmentList[0]}, ${ScopeDepartmentList[1]}, and ${ScopeDepartmentList[2]}`;
  } else if (ScopeDepartmentList.length === 4) {
    params.ScopeDepartmentList = `${ScopeDepartmentList[0]}, ${ScopeDepartmentList[1]}, ${ScopeDepartmentList[2]}, and ${ScopeDepartmentList[3]}`;
  } else {
    return res.status(400).send({ error: "scope department list empty" });
  }

  params.NumMeetings = req.body.NumMeetings;
  params.HasInitialRecommendationsMeeting =
    req.body.HasInitialRecommendationsMeeting;

  params.getNextLetter = getNextLetter;

  params.letter = "";
  params.romanNumeral = "";
  params.number = 1;

  params.getNextRomanNumeral = getNextRomanNumeral;

  params.HasCommercialShellConnection = req.body.HasCommercialShellConnection;
  params.HasIndoorCommonArea = req.body.HasIndoorCommonArea;
  params.HasEmergencyPower = req.body.HasEmergencyPower;
  params.HasStructural = req.body.StructuralDescriptions;
  params.HasGarageExhaust = req.body.HasGarageExhaust;
  params.HasSiteLighting = req.body.HasSiteLighting;

  params.htmlPaymentScheduleTable = await paymentScheduleTable(params);

  await finalize(req, res, filename, params);
});

module.exports = router;
