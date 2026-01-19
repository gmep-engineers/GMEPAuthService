const { v1: uuidv1 } = require("uuid");
const getSqlConnection = require("./getSqlConnection");

const offsetAmt = 50;
var headers = {};

const processEmail = async function (conn, itemEmail, entityId) {
  const emailAddressId = uuidv1();
  var query = `
  insert into email_addresses (id, email_address) values (?, ?)
  `;
  await conn.query(query, [emailAddressId, itemEmail]);

  const emailAddrEntityRelId = uuidv1();
  query = `
  insert into email_addr_entity_rel (id, email_address_id, entity_id, is_primary) values
  (?, ?, ?, 1)  
  `;
  await conn.query(query, [emailAddrEntityRelId, emailAddressId, entityId]);
};

const processExistingEmail = async function (conn, itemEmail, entityId) {
  query = `
  select id from email_addresses  
  where email_addresses.email_address = ?
  `;
  var [result] = await conn.query(query, [itemEmail]);
  var emailAddressId = null;
  if (result.length > 0) {
    emailAddressId = result[0].id;
  } else {
    emailAddressId = uuidv1();
    query = `
    insert into email_addresses (id, email_address) values (?, ?)
    `;
    await conn.query(query, [emailAddressId, item.email]);
  }
  const emailAddrEntityRelId = uuidv1();
  query = `
  insert into email_addr_entity_rel (id, entity_id, email_address_id)
  values (?, ?, ?)
  `;
  await conn.query(query, [emailAddrEntityRelId, entityId, emailAddressId]);
};

const parsePhoneNumber = function (itemPhone) {
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

const processPhone = async function (conn, itemPhone, entityId) {
  const phoneNumber = parsePhoneNumber(itemPhone);
  if (isNaN(phoneNumber)) {
    return;
  }
  const phoneNumberId = uuidv1();
  var query = `
      insert into phone_numbers (id, phone_number)
      `;
  await conn.query(query, [phoneNumberId, phoneNumber]);

  const phoneNumberEntityRelId = uuidv1();
  query = `
      insert into phone_number_entity_rel (id, phone_number_id, entity_id) values (?, ?, ?)
      `;
  await conn.query(query, [phoneNumberEntityRelId, phoneNumberId, entityId]);
};

const processExistingPhone = async function (conn, itemPhone, entityId) {
  const phoneNumber = parsePhoneNumber(itemPhone);
  if (isNaN(phoneNumber)) {
    return;
  }
  query = `
  select id from phone_numbers  
  where phone_numbers.phone_number = ?
  `;
  var [result] = await conn.query(query, [itemPhone]);
  var phoneNumberId = null;
  if (result.length > 0) {
    phoneNumberId = result[0].id;
  } else {
    phoneNumberId = uuidv1();
    query = `
    insert into phone_numbers (id, phone_number) values (?, ?)
    `;
    await conn.query(query, [phoneNumberId, itemPhone]);
  }
  const phoneNumberEntityRelId = uuidv1();
  query = `
  insert into phone_number_entity_rel (id, entity_id, phone_number_id)
  values (?, ?, ?)
  `;
  await conn.query(query, [phoneNumberEntityRelId, entityId, phoneNumberId]);
};

const createNewCustomer = async function (item) {
  const entityId = uuidv1();
  var query = `
    insert into entities (id) values (?)
  `;
  await conn.query(query, [entityId]);

  var addressQueryBody = {
    q: `SELECT EntityAddress.Addr1, EntityAddress.Addr2, EntityAddress.City, EntityAddress.State, EntityAddress.Zip FROM EntityAddress INNER JOIN Customer ON Customer.DefaultShippingAddress = EntityAddress.nKey WHERE Customer.ID = ${item.id}`,
  };

  var name = item.companyname;
  var street_address = "";
  var street_address2 = "";
  var city = "";
  var state = "";
  var postal_code = "";

  var addressRes = await fetch(
    `https://5645740.suitetalk.api.netsuite.com/services/rest/query/v1/suiteql?limit=1`,
    {
      headers: headers,
      method: "POST",
      body: JSON.stringify(addressQueryBody),
    },
  );
  const json = await addressRes.json();
  if (addressRes.ok) {
    const addrItems = json.items;
    if (addrItems && addrItems.length > 0) {
      const addrItem = addrItems[0];
      street_address = addrItem.addr1;
      street_address2 = addrItem.addr2;
      city = addrItem.city;
      state = addrItem.state;
      postal_code = addrItem.zip;
    }
  }

  query = `
  insert into companies (id, entity_id, name, street_address, street_address_2, city, state, postal_code) values
                        ( ?,         ?,    ?,              ?,                ?,    ?,     ?,           ?)
  `;
  await conn.query(query, [
    item.id.toString(),
    entityId,
    name,
    street_address,
    street_address2,
    city,
    state,
    postal_code,
  ]);

  if (item.email) {
    processEmail(conn, item.email, entityId);
  }

  if (item.phone) {
    await processPhone(conn, item.phone, entityId);
  }

  if (item.mobilephone) {
    await processPhone(conn, item.mobilephone, entityId);
  }

  const clientId = uuidv1();
  query = `
  insert into clients (id, company_id, loyalty_type_id) values (?, ?, ?)
  `;
  await conn.query(query, [clientId, id, 3]);

  conn.destroy();

  var contactQueryBody = {
    q: `SELECT * FROM companycontactrelationship WHERE company = ${item.id}`,
  };

  var contactRes = await fetch(
    `https://5645740.suitetalk.api.netsuite.com/services/rest/query/v1/suiteql?limit=1`,
    {
      headers: headers,
      method: "POST",
      body: JSON.stringify(contactQueryBody),
    },
  );

  var contactIds = [];
  if (contactRes.ok) {
    const json = await contactRes.json();
    const items = json.items;
    contactIds = items.map((i) => i.contact);
  }

  for (let i of contactIds) {
    processSingleContact(i);
  }
};

const updateExistingCustomer = async function (item) {};

const processCustomer = async function (item) {
  const customerId = item.id;
  const conn = await getSqlConnection();
  var query = `
  SELECT * FROM companies WHERE id = ?
  `;
  const [result] = await conn.query(query, [customerId]);
  conn.destroy();
  var update = false;
  if (result.length > 0) {
    update = true;
  }
  if (update) {
    updateExistingCustomer(item);
  } else {
    createNewCustomer(item);
  }
};

const processAllCustomers = async function () {
  const offsetAmt = 50;
  var offset = 0;
  var items = [];
  const body = JSON.stringify({
    q: "select * from customer",
  });
  while (offset <= 4350) {
    var res = await fetch(
      `https://5645740.suitetalk.api.netsuite.com/services/rest/query/v1/suiteql?limit=${offsetAmt}&offset=${offset}`,
      {
        headers: headers,
        body: body,
        method: "POST",
      },
    );

    if (res.ok) {
      const json = await res.json();
      items = json.items;
    }

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      await processCustomer(item);
    }

    offset += offsetAmt;
  }
};

const processSingleCustomer = async function (customerId, token) {
  headers = {
    Authorization: `Bearer ${token}`,
    "content-type": "application/json",
    prefer: "transient",
    connection: "keep-alive",
  };
  var items = [];
  const body = JSON.stringify({
    q: `SELECT * FROM customer WHERE id='${customerId}'`,
  });
  var res = await fetch(
    `https://5645740.suitetalk.api.netsuite.com/services/rest/query/v1/suiteql?limit=${offsetAmt}&offset=${offset}`,
    {
      headers: headers,
      body: body,
      method: "POST",
    },
  );

  if (res.ok) {
    const json = await res.json();
    items = json.items;
  }

  if (items.length > 0) {
    const item = items[0];
    await processCustomer(item);
  }
};

const processContact = async function (item) {
  const conn = await getSqlConnection();
  const entityId = uuidv1();
  var query = `
    insert into entities (id) values (?)
  `;
  await conn.query(query, [entityId]);

  query = `
    insert into contacts (id, entity_id, first_name, last_name, company_id)
    values (?, ?, ?, ?, ?)
  `;
  const names = item.entitytitle.split(" ");
  const firstName = names.slice(0, names.length - 1).join(" ");
  const lastName = names[-1];
  await conn.query(query, [
    item.id,
    entityId,
    firstName,
    lastName,
    item.company,
  ]);

  if (item.email) {
    await processExistingEmail(conn, item.email, entityId);
  }

  if (item.phone) {
    await processExistingPhone(conn, item.phone, entityId);
  }

  if (item.mobilephone) {
    await processExistingPhone(conn, item.mobile, entityId);
  }
};

const processAllContacts = async function () {
  var offset = 0;
  var items = [];
  const body = JSON.stringify({
    q: "select * from contacts",
  });
  while (offset <= 4350) {
    var res = await fetch(
      `https://5645740.suitetalk.api.netsuite.com/services/rest/query/v1/suiteql?limit=${offsetAmt}&offset=${offset}`,
      {
        headers: headers,
        body: body,
        method: "POST",
      },
    );

    if (res.ok) {
      const json = await res.json();
      items = json.items;
    }

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      await processContact(item);
    }

    offset += offsetAmt;
  }
};

const processSingleContact = async function (contactId) {
  var items = [];
  const body = JSON.stringify({
    q: `SELECT * FROM contacts WHERE id='${contactId}'`,
  });
  var res = await fetch(
    `https://5645740.suitetalk.api.netsuite.com/services/rest/query/v1/suiteql?limit=${offsetAmt}&offset=${offset}`,
    {
      headers: headers,
      body: body,
      method: "POST",
    },
  );

  if (res.ok) {
    const json = await res.json();
    items = json.items;
  }

  if (items.length > 0) {
    const item = items[0];
    await processContact(item);
  }
};

// (async () => {
//   const args = process.argv.slice(2);
//   processSingleCustomer(args[0]);
// })();

module.exports = { processSingleCustomer };
