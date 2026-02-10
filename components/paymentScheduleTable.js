const common = require("../lib/common");

const paymentScheduleTable = async function (params) {
  await common.render("components/paymentScheduleTable", params);
};

module.exports = paymentScheduleTable;
