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

    params.getNextLetter = function (letter) {
      var letters = ["ABCDEFGabcdefg"];
      var index = letters.indexOf(letter);
      return letters[index + 1];
    };

    params.letter = "";
    params.romanNumeral = "";

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
      ejs.renderFile(filename, params, (err, str) => {
        if (!err) {
          fs.writeFileSync(
            path.join(__dirname, "input", req.file.filename + ".html"),
            str
          );
          filename = req.file.filename + ".html";
          resolve();
        } else {
          reject();
        }
      });
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
        "formatted-footer.html"
      )}" --page-size Letter -B 12mm "${path.join(
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
