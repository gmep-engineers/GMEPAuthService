var express = require("express");
var router = express.Router();

const { processSingleCustomer } = require("../../lib/customerMigration");

router.post("/sync-client", async function (req, res, next) {
  await processSingleCustomer(req.body.CustomerId, req.body.Token);
  res.status(201).send({});
});

module.exports = router;
