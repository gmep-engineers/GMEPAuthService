const { exec } = require("child_process");
var express = require("express");
var router = express.Router();
var fs = require("fs");
var path = require("path");
const { v4: uuidv4 } = require("uuid");
const multer = require("multer");
const upload = multer({ dest: "routes/api/input" });
const ejs = require("ejs");

router.post(
  "/commercial",
  upload.single("file"),
  async function (req, res, next) {
    var filename = req.file.filename + ".ejs";

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

    params.TotalPrice = parseInt(req.body.TotalPrice);

    params.ClientType = req.body.ClientType;

    params.HasSiteVisit = req.body.HasSiteVisit;

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
    }
    if (ScopeDepartmentList.length === 2) {
      params.ScopeDepartmentList = `${ScopeDepartmentList[0]} and ${ScopeDepartmentList[1]}`;
    }
    if (ScopeDepartmentList.length === 3) {
      params.ScopeDepartmentList = `${ScopeDepartmentList[0]}, ${ScopeDepartmentList[1]}, and ${ScopeDepartmentList[2]}`;
    }
    if (ScopeDepartmentList.length === 4) {
      params.ScopeDepartmentList = `${ScopeDepartmentList[0]}, ${ScopeDepartmentList[1]}, ${ScopeDepartmentList[2]}, and ${ScopeDepartmentList[3]}`;
    }

    params.NumMeetings = parseInt(req.body.NumMeetings);
    params.HasInitialRecommendationsMeeting =
      req.body.HasInitialRecommendationsMeeting;

    params.getNextLetter = function (letter) {
      var letters = "ABCDEFGabcdefg";
      var index = letters.indexOf(letter);
      return letters[index + 1];
    };

    params.letter = "";
    params.romanNumeral = "";
    params.number = 1;

    params.getNextRomanNumeral = function (romanNumeral) {
      var romanNumerals = ["i", "ii", "iii", "iv", "v", "vi", "vii"];
      var index = romanNumerals.indexOf(romanNumeral);
      return romanNumerals[index + 1];
    };

    fs.renameSync(
      path.join(__dirname, "input", req.file.filename),
      path.join(__dirname, "input", filename)
    );

    await new Promise((resolve, reject) => {
      ejs.renderFile(
        path.join(__dirname, "input", filename),
        params,
        (err, str) => {
          if (!err) {
            fs.writeFileSync(
              path.join(__dirname, "input", req.file.filename + ".html"),
              str
            );
            filename = req.file.filename + ".html";
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
    footerTemplate = footerTemplate.replace(
      "$ProjectName",
      req.body.ProjectName
    );
    const footerTemplateId = uuidv4();
    fs.writeFileSync(
      path.join(
        __dirname,
        "input",
        `formatted-footer-${footerTemplateId}.html`
      ),
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
        `formatted-footer-${footerTemplateId}.html`
      )}" --page-size Letter -B 25.4mm "${path.join(
        __dirname,
        "input",
        filename
      )}" routes/api/output/${filename}.pdf`,
      (err, stdout, stderr) => {
        fs.unlinkSync(
          path.join(
            __dirname,
            "input",
            `formatted-footer-${footerTemplateId}.html`
          )
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
        res.sendFile(
          path.join(__dirname, "output", filename + ".pdf"),
          (err) => {
            if (err) {
              console.log("sendFile stderr");
              console.error(err);
              return res.status(500).send(err);
            }
            fs.unlinkSync(`routes/api/output/${filename}.pdf`);
          }
        );
      }
    );
  }
);

module.exports = router;
