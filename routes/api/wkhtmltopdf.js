const { exec } = require("child_process");
var express = require("express");
var router = express.Router();
var fs = require("fs");
var path = require("path");
const { v4: uuidv4 } = require("uuid");

router.post("/", async function (req, res, next) {
  var html = req.body.html;
  var filename = uuidv4() + ".html";
  fs.writeFileSync(path.join(__dirname, "input", filename), html);
  exec(
    `wkhtmltopdf --enable-local-file-access --header-html "${path.join(
      __dirname,
      "pdf_templates",
      "header.html"
    )}" --footer-html "${path.join(
      __dirname,
      "pdf_templates",
      "footer.html"
    )}" --load-error-handling ignore --page-size Letter "${path.join(
      __dirname,
      "input",
      filename
    )}" routes/api/output/${filename}.pdf`,
    (err, stdout, stderr) => {
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
      });
    }
  );
});

module.exports = router;
