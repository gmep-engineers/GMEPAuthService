const ejs = require("ejs");
const common = {
  render: function (templateName, templateParams) {
    return new Promise((resolve, reject) => {
      ejs.renderFile(
        "./" + templateName + ".ejs",
        templateParams,
        function (err, str) {
          if (err) {
            console.error(err);
            reject(err);
          }
          resolve(str);
        }
      );
    });
  },
};
module.exports = common;
