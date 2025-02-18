var express = require("express");
var router = express.Router();
const bcrypt = require("bcrypt");
const { v4: uuidv4 } = require("uuid");
const destroyConnSendErr = require("../../lib/destroyConnSendErr");
const destroyConnSendOk = require("../../lib/destroyConnSendOk");
const getSqlConnection = require("../../lib/getSqlConnection");
const config = require("../../etc/config");
const getUserIdFromSessionId = require("../../lib/getUserIdFromSessionId");
router.post("/", async function (req, res, next) {
  const username = req.body.Username;
  const password = req.body.Password;
  const conn = await getSqlConnection();
  var query = `
    SELECT 
    contacts.first_name,
    contacts.last_name,
    employees.passhash,
    employees.id as employee_id,
    employee_access_levels.employee_access_level,
    employee_types.employee_type,
    email_addresses.email_address,
    phone_numbers.phone_number,
    phone_numbers.calling_code,
    phone_numbers.extension
    FROM employees
    LEFT JOIN contacts ON employees.contact_id = contacts.id
    LEFT JOIN entities ON contacts.entity_id = entities.id
    LEFT JOIN phone_number_entity_rel ON phone_number_entity_rel.entity_id = entities.id
    LEFT JOIN email_addr_entity_rel ON email_addr_entity_rel.entity_id = entities.id
    LEFT JOIN phone_numbers ON phone_number_entity_rel.phone_number_id = phone_numbers.id
    LEFT JOIN email_addresses ON email_addr_entity_rel.email_address_id = email_addresses.id
    LEFT JOIN employee_types ON employee_types.id = employees.employee_type_id
    LEFT JOIN employee_access_levels ON employee_access_levels.id = employees.employee_access_level_id
    WHERE employees.username = ?
    AND employees.termination_date IS NULL
  `;
  var passhash = "";
  var employeeId = "";
  var accessLevelId = 0;
  var extension = "";
  try {
    var [results] = await conn.query(query, [username]);
    if (results.length > 0) {
      passhash = results[0]["passhash"];
      employeeId = results[0]["employee_id"];
      extension = results[0]["extension"];
    }
  } catch (err) {
    return destroyConnSendErr(conn, res, 500, "server error", "Ood8lN");
  }
  var compareResult = await bcrypt.compare(password, passhash);
  if (compareResult) {
    query = `
      INSERT INTO sessions (id, employee_id, ip, device_name) VALUES
      (?, ?, ?, ?)
    `;
    const id = uuidv4();
    try {
      await conn.query(query, [id, employeeId, "_", "computer"]);
      var sqlHost = config.SQL_HOST_DEV;
      var sqlDatabase = config.SQL_DB;
      var sqlUser = config.SQL_USER;
      var sqlPassword = config.SQL_PASSW_DEV;
      if (config.ENV !== "PRODUCTION") {
        sqlHost = config.SQL_HOST_PROD;
        sqlPassword = config.SQL_PASSW_PROD;
      }
      const sqlConnectionString = `
      Server=${sqlHost};
      Port=3306;
      Database=${sqlDatabase};
      User Id=${sqlUser};
      Password=${sqlPassword};
      `;
      return destroyConnSendOk(conn, res, 201, {
        SessionId: id,
        SqlConnectionString: sqlConnectionString,
        AwsAccessKeyId: config.AWS_ACCESS_KEY_ID,
        AwsSecretAccessKey: config.AWS_SECRET_ACCESS_KEY,
        AwsS3Bucket: config.AWS_S3_BUCKET,
        AccessLevelId: accessLevelId,
      });
    } catch (err) {
      return destroyConnSendErr(conn, res, 500, "server error", "Uk00W3");
    }
  } else {
    return destroyConnSendErr(conn, res, 403, "incorrect password", "kcn0EU");
  }
});

router.delete("/", async function (req, res, next) {
  const sid = req.body.SessionId;
  const conn = await getSqlConnection();
  var query = `DELETE FROM sessions WHERE id = ?`;
  try {
    await conn.query(query, [sid]);
    return destroyConnSendOk(conn, res, 201, {});
  } catch (err) {
    return destroyConnSendErr(conn, res, 500, "server error", "PGV6dU");
  }
});

router.delete("/all", async function (req, res, next) {
  const conn = await getSqlConnection();
  const sid = req.body.SessionId;
  const employeeId = await getUserIdFromSessionId(conn, sid);
  if (!employeeId) {
    return destroyConnSendOk(conn, res, 201, {
      message: `no session found for ${sid}`,
    });
  }
  var query = `DELETE FROM sessions WHERE employee_id = ?`;
  try {
    await conn.query(query, [employeeId]);
    return destroyConnSendOk(conn, res, 201, { sid_list: sidList });
  } catch (err) {
    return destroyConnSendErr(conn, res, 500, "server error", "ISlKf9");
  }
});

module.exports = router;
