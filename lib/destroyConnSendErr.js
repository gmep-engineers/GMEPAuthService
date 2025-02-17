var destroyConnSendErr = function (conn, res, code, err, err_id) {
  conn.destroy();
  res.status(code).send({ error: err, id: err_id });
};

module.exports = destroyConnSendErr;
