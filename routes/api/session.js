var express = require("express");
var router = express.Router();
const bcrypt = require("bcrypt");
const redis = require("redis");
const { v4: uuidv4 } = require("uuid");
const destroyConnSendErr = require("../../lib/destroyConnSendErr");
const destroyConnSendOk = require("../../lib/destroyConnSendOk");
const getSqlConnection = require("../../lib/getSqlConnection");
const config = require("../../etc/config");
router.post("/", async function (req, res, next) {
  const username = req.body.username;
  const password = req.body.password;
  const conn = await getSqlConnection();
  const mem = await redis.createClient().connect();
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
  var accessLevel = "0";
  var extension = "";
  try {
    var [results] = await conn.query(query, [username]);
    if (results.length > 0) {
      passhash = results[0]["passhash"];
      employeeId = results[0]["employee_id"];
      extension = results[0]["extension"];
    }
  } catch (err) {
    await mem.disconnect();
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
      await mem.set(id, employeeId);
      await mem.set(employeeId, accessLevel);
      await mem.disconnect();
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
        sid: id,
        sql_connection_string: sqlConnectionString,
        aws_access_key_id: config.AWS_ACCESS_KEY_ID,
        aws_secret_access_key: config.AWS_SECRET_ACCESS_KEY,
        aws_s3_bucket: config.AWS_S3_BUCKET,
      });
    } catch (err) {
      await mem.disconnect();
      return destroyConnSendErr(conn, res, 500, "server error", "Uk00W3");
    }
  } else {
    await mem.disconnect();
    return destroyConnSendErr(conn, res, 403, "incorrect password", "kcn0EU");
  }
});

router.delete("/", async function (req, res, next) {
  const sid = req.body.sid;
  const conn = await getSqlConnection();
  const mem = await redis.createClient().connect();
  try {
    const employeeId = await mem.get(sid);
    await mem.del(sid);
    await mem.del(employeeId);
    var query = `DELETE FROM sessions WHERE id = ?`;
    await conn.query(query, [sid]);
    await mem.disconnect();
    return destroyConnSendOk(conn, res, 201, {});
  } catch (err) {
    return destroyConnSendErr(conn, res, 500, "server error", "PGV6dU");
  }
});

router.delete("/all", async function (req, res, next) {
  const conn = await getSqlConnection();
  const sid = req.body.sid;
  const mem = await redis.createClient().connect();
  var query = `SELECT id FROM sessions WHERE user_id = ?`;
  try {
    const employeeId = await mem.get(sid);
    const [result] = await conn.query(query, [employeeId]);
    const sidList = [];
    for (i = 0; i < result.length; i++) {
      sidList.push(result[i]["id"]);
      await mem.del(result[i]["id"]);
    }
    await mem.del(employeeId);
    var query = `DELETE FROM sessions WHERE user_id = ?`;
    await conn.query(query, [employeeId]);
    await mem.disconnect();
    return destroyConnSendOk(conn, res, 201, { sid_list: sidList });
  } catch (err) {
    await mem.disconnect();
    return destroyConnSendErr(conn, res, 500, "server error", "ISlKf9");
  }
});

module.exports = router;
