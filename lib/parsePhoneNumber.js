const parsePhoneNumber = function (itemPhone) {
  if (!itemPhone) {
    return;
  }
  const phoneRegex = /[0-9]+/g;
  const phoneNumberMatches = itemPhone.match(phoneRegex);
  if (phoneNumberMatches) {
    const phoneNumberStr = phoneNumberMatches.join("");
    if (phoneNumberStr.length > 0) {
      const phoneNumber = parseInt(phoneNumberStr);
      return phoneNumber;
    } else {
      return null;
    }
  } else {
    return null;
  }
};
module.exports = parsePhoneNumber;
