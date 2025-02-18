var getUserIdFromSessionId = async function (conn, sessionId) {
  const query = `
  SELECT user_id FROM sessions WHERE id = ?
  `;
  const [result] = await conn.query(query, [sessionId]);
  if (result.length > 0) {
    return result["user_id"];
  }
  return "";
};
module.exports = getUserIdFromSessionId;
