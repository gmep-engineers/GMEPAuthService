var express = require("express");
var router = express.Router();
const bcrypt = require("bcrypt");
const config = require("../../etc/config");
const getSqlConnection = require("../../lib/getSqlConnection");
const destroyConnSendErr = require("../../lib/destroyConnSendErr");
const destroyConnSendOk = require("../../lib/destroyConnSendOk");
const { v4: uuidv4 } = require("uuid");
const saltRounds = 10;

router.post("/", async function (req, res, next) {
  var username = req.body["username"];
  var password = req.body["password"];
  var emailAddr = req.body["email_addr"];
  var firstName = req.body["first_name"];
  var lastName = req.body["last_name"];
  var phoneNumber = req.body["phone_number"];
  var extension = req.body["extension"];
  var employeeTypeId = req.body["employee_type_id"];
  var employeeAccessLevelId = req.body["employee_access_level_id"];
  var hireDate = req.body["hire_date"];
  const conn = await getSqlConnection();
  var query = `SELECT username FROM employees WHERE username = ?`;
  try {
    const [results, _] = await conn.query(query, [username]);
    if (results.length > 0) {
      return destroyConnSendErr(conn, res, 403, "username exists", "jKVbHq");
    }
  } catch (err) {
    return destroyConnSendErr(conn, res, 500, "server error", "eKS0Ne");
  }

  var salt = await bcrypt.genSalt(saltRounds);
  var passhash = await bcrypt.hash(password, salt);
  const entityId = uuidv4();
  const contactId = uuidv4();
  const emailAddressId = uuidv4();
  const phoneNumberId = uuidv4();
  const employeeId = uuidv4();
  const emailAddrEntityRelId = uuidv4();
  const phoneNumberEntityRelId = uuidv4();
  query = `
    INSERT INTO entities (id) VALUES (?)
  `;
  await conn.query(query, [entityId]);
  query = `
    INSERT INTO contacts (id, entity_id, first_name, last_name, company_id) VALUES (?, ?, ?, ?, ?)
  `;
  await conn.query(query, [
    contactId,
    entityId,
    firstName,
    lastName,
    config.GMEP_COMPANY_ID,
  ]);
  query = `
    INSERT INTO email_addresses (id, email_address) VALUES (?, ?)
  `;
  await conn.query(query, [emailAddressId, emailAddr]);
  query = `
    INSERT INTO phone_numbers (id, phone_number, calling_code, extension) VALUES (?, ?, ?, ?)
  `;
  await conn.query(query, [phoneNumberId, phoneNumber, "1", extension]);
  query = `
    INSERT INTO email_addr_entity_rel (id, email_address_id, entity_id, is_primary) VALUES (?, ?, ?, ?)
  `;
  await conn.query(query, [emailAddrEntityRelId, emailAddressId, entityId, 1]);
  query = `
    INSERT INTO phone_number_entity_rel (id, phone_number_id, entity_id, is_primary) VALUES (?, ?, ?, ?)
  `;
  await conn.query(query, [phoneNumberEntityRelId, phoneNumberId, entityId, 1]);

  query = `
    INSERT INTO employees (id, contact_id, employee_type_id, employee_access_level_id, hire_date, username, passhash) VALUES 
    (?, ?, ?, ?, ?, ?, ?)
  `;

  await conn.query(query, [
    employeeId,
    contactId,
    employeeTypeId,
    employeeAccessLevelId,
    hireDate,
    username,
    passhash,
  ]);

  return destroyConnSendOk(conn, res, 201, {
    employee_id: employeeId,
  });
});

module.exports = router;
