var express = require("express");
var router = express.Router();

const { processSingleCustomer } = require("../../lib/customerMigration");
const getSqlConnection = require("../../lib/getSqlConnection");

router.post("/sync-client", async function (req, res, next) {
  const conn = await getSqlConnection();
  await processSingleCustomer(conn, req.body.CustomerId, req.body.Token);
  conn.destroy();
  res.status(201).send({});
});

module.exports = router;
