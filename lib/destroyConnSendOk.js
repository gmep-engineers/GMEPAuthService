var destroyConnSendOk = function (conn, res, code, obj) {
  conn.destroy();
  res.status(code).send(obj);
};

module.exports = destroyConnSendOk;
