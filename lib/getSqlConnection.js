const config = require("../etc/config");
const mysql = require("mysql2/promise");
var getSqlConnection = async function () {
  if (config.ENV !== "PRODUCTION") {
    return await mysql.createConnection({
      host: config.SQL_HOST_DEV,
      user: config.SQL_USER,
      database: config.SQL_DB,
      password: config.SQL_PASSW_DEV,
    });
  }
  return await mysql.createConnection({
    host: config.SQL_HOST,
    user: config.SQL_USER,
    database: config.SQL_DB,
    password: config.SQL_PASSW,
  });
};
module.exports = getSqlConnection;
