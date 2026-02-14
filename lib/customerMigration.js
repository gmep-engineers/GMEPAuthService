const { v1: uuidv1 } = require("uuid");

const offsetAmt = 50;

const parsePhoneNumber = require("./parsePhoneNumber");
var headers = {};

const processEmail = async function (conn, itemEmail, entityId) {
  var query = `
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
    await conn.query(query, [emailAddressId, itemEmail]);
  }
  query = `select * from email_addr_entity_rel where entity_id = ? and email_address_id = ?`;
  [result] = await conn.query(query, [entityId, emailAddressId]);
  if (result.length === 0) {
    const emailAddrEntityRelId = uuidv1();
    query = `
    insert into email_addr_entity_rel (id, entity_id, email_address_id, is_primary)
    values (?, ?, ?, 0)
    `;
    await conn.query(query, [emailAddrEntityRelId, entityId, emailAddressId]);
  }
};

const processPhone = async function (conn, itemPhone, entityId) {
  if (!itemPhone) {
    return;
  }
  const matches = itemPhone.match(/[0-9]+/g);
  if (!matches) {
    return;
  }
  itemPhone = matches.join("");
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
  query = `select * from phone_number_entity_rel where entity_id = ? and phone_number_id = ?`;
  [result] = await conn.query(query, [entityId, phoneNumberId]);
  if (result.length === 0) {
    const phoneNumberEntityRelId = uuidv1();
    query = `
    insert into phone_number_entity_rel (id, entity_id, phone_number_id, is_primary)
    values (?, ?, ?, 0)
  `;
    await conn.query(query, [phoneNumberEntityRelId, entityId, phoneNumberId]);
  }
};

const getCompanyAddress = async function (conn, item) {
  var addressQueryBody = {
    q: `SELECT EntityAddress.Addr1, EntityAddress.Addr2, EntityAddress.City, EntityAddress.State, EntityAddress.Zip FROM EntityAddress INNER JOIN Customer ON Customer.DefaultShippingAddress = EntityAddress.nKey WHERE Customer.ID = ${item.id}`,
  };

  const address = {
    street_address: "",
    street_address2: "",
    city: "",
    state: "",
    postal_code: "",
  };

  var addressRes = await fetch(
    `https://5645740.suitetalk.api.netsuite.com/services/rest/query/v1/suiteql?limit=1`,
    {
      headers: headers,
      method: "POST",
      body: JSON.stringify(addressQueryBody),
    }
  );
  const json = await addressRes.json();

  if (addressRes.ok) {
    const addrItems = json.items;
    if (addrItems && addrItems.length > 0) {
      const addrItem = addrItems[0];
      address.street_address = addrItem.addr1;
      address.street_address2 = addrItem.addr2;
      address.city = addrItem.city;
      address.state = addrItem.state;
      address.postal_code = addrItem.zip;
    }
  }
  return address;
};

const createNewCustomer = async function (conn, item, isArchitect) {
  const entityId = uuidv1();
  var query = `
    insert into entities (id) values (?)
  `;
  await conn.query(query, [entityId]);

  const address = await getCompanyAddress(conn, item);

  query = `
  insert into companies (id, entity_id, name, street_address, street_address_2, city, state, postal_code) values
                        ( ?,         ?,    ?,              ?,                ?,    ?,     ?,           ?)
  `;

  try {
    await conn.query(query, [
      item.id.toString(),
      entityId,
      item.companyname,
      address.street_address,
      address.street_address2,
      address.city,
      address.state,
      address.postal_code,
    ]);
  } catch (err) {
    console.error(err);
  }

  if (item.email) {
    await processEmail(conn, item.email, entityId);
  }

  if (item.phone) {
    await processPhone(conn, item.phone, entityId);
  }

  if (item.mobilephone) {
    await processPhone(conn, item.mobilephone, entityId);
  }

  const clientId = uuidv1();
  if (isArchitect) {
    query = `
    insert into architects (id, company_id) values (?, ?)
    `;
    await conn.query(query, [clientId, item.id]);
  } else {
    query = `
    insert into clients (id, company_id, loyalty_type_id) values (?, ?, ?)
    `;
    await conn.query(query, [clientId, item.id, 3]);
  }

  var contactQueryBody = {
    q: `SELECT * FROM companycontactrelationship WHERE company = ${item.id}`,
  };

  var contactRes = await fetch(
    `https://5645740.suitetalk.api.netsuite.com/services/rest/query/v1/suiteql`,
    {
      headers: headers,
      method: "POST",
      body: JSON.stringify(contactQueryBody),
    }
  );

  var contactIds = [];
  if (contactRes.ok) {
    const json = await contactRes.json();
    const items = json.items;
    contactIds = items.map((i) => i.contact);
  }

  for (let i of contactIds) {
    await processSingleContact(conn, i);
  }
};

const updateExistingCustomer = async function (
  conn,
  item,
  isArchitect,
  entityId
) {
  const address = await getCompanyAddress(conn, item);
  var query = `
  update companies set name = ?, street_address = ?, street_address_2 = ?, city = ?, state = ?, postal_code = ? where id = ?                        
  `;

  await conn.query(query, [
    item.companyname,
    address.street_address,
    address.street_address2,
    address.city,
    address.state,
    address.postal_code,
    item.id.toString(),
  ]);
  if (item.email) {
    await processEmail(conn, item.email, entityId);
  }

  if (item.phone) {
    await processPhone(conn, item.phone, entityId);
  }

  if (item.mobilephone) {
    await processPhone(conn, item.mobilephone, entityId);
  }
  const clientId = uuidv1();
  if (isArchitect) {
    query = `select * from architects where company_id = ?`;
    let [result] = await conn.query(query, [item.id]);
    if (result.length === 0) {
      query = `
      insert into architects (id, company_id) values (?, ?)
      `;
      await conn.query(query, [clientId, item.id]);
    }
  } else {
    query = `select * from clients where company_id = ?`;
    let [result] = await conn.query(query, [item.id]);
    if (result.length === 0) {
      let query = `
      insert into clients (id, company_id, loyalty_type_id) values (?, ?, ?)
      `;
      await conn.query(query, [clientId, item.id, 3]);
    }
  }

  var contactQueryBody = {
    q: `SELECT * FROM companycontactrelationship WHERE company = ${item.id}`,
  };

  var contactRes = await fetch(
    `https://5645740.suitetalk.api.netsuite.com/services/rest/query/v1/suiteql`,
    {
      headers: headers,
      method: "POST",
      body: JSON.stringify(contactQueryBody),
    }
  );

  var contactIds = [];
  if (contactRes.ok) {
    const json = await contactRes.json();
    const items = json.items;
    contactIds = items.map((i) => i.contact);
  }

  var previouslyStoredContactsForCompany = [];

  query = `
  select id from contacts where company_id = ? and date_deleted is null
  `;

  var [result] = await conn.query(query, [item.id]);
  if (result.length > 0) {
    previouslyStoredContactsForCompany = result.map((r) => r.id);
  }

  for (let i of contactIds) {
    await processSingleContact(conn, i);
  }

  for (let i of previouslyStoredContactsForCompany) {
    if (!contactIds.includes(i)) {
      query = `
      update contacts set date_deleted = current_timestamp() where id = ?
      `;
      await conn.query(query, [i]);
    }
  }
};

const processCustomer = async function (conn, item, isArchitect) {
  const customerId = item.id;
  var query = `
  SELECT * FROM companies WHERE id = ?
  `;
  const [result] = await conn.query(query, [customerId]);
  var update = false;
  var entityId = null;
  if (result.length > 0) {
    update = true;
    entityId = result[0].entity_id;
  }
  if (update) {
    console.log("updating existing customer");
    await updateExistingCustomer(conn, item, isArchitect, entityId);
  } else {
    console.log("creating new customer");
    await createNewCustomer(conn, item, isArchitect);
  }
};

const processAllCustomers = async function (conn) {
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
      }
    );

    if (res.ok) {
      const json = await res.json();
      items = json.items;
    }

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      await processCustomer(conn, item);
    }

    offset += offsetAmt;
  }
};

const processSingleCustomer = async function (
  conn,
  customerId,
  token,
  isArchitect
) {
  var offset = 0;
  headers = {
    Authorization: `Bearer ${token}`,
    "content-type": "application/json",
    prefer: "transient",
    connection: "keep-alive",
  };
  console.log("headers", headers);
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
    }
  );

  if (res.ok) {
    const json = await res.json();
    items = json.items;
  } else {
    const json = await res.json();
    console.log("json", json);
  }

  if (items.length > 0) {
    const item = items[0];
    await processCustomer(conn, item, isArchitect);
  }
};

const updateExistingContact = async function (conn, item, entityId) {
  var query = `
    update contacts set
    first_name = ?, last_name = ?
    where id = ?
  `;
  try {
    const names = item.entitytitle.split(" ");
    const firstName = names.slice(0, names.length - 1).join(" ");
    const lastName = names[names.length - 1];
    await conn.query(query, [firstName, lastName, item.id]);
    if (item.email) {
      await processEmail(conn, item.email, entityId);
    }

    if (item.phone) {
      await processPhone(conn, item.phone, entityId);
    }

    if (item.mobilephone) {
      await processPhone(conn, item.mobile, entityId);
    }
  } catch (err) {
    console.error(err);
  }
};

const processContact = async function (conn, item) {
  var query = `
  select entity_id from contacts where id = ?
  `;
  var [result] = await conn.query(query, [item.id]);
  if (result.length > 0) {
    await updateExistingContact(conn, item, result[0].entity_id);
    return;
  }

  const entityId = uuidv1();
  var query = `
    insert into entities (id) values (?)
  `;
  await conn.query(query, [entityId]);

  query = `
    insert into contacts (id, entity_id, first_name, last_name, company_id)
    values (?, ?, ?, ?, ?)
  `;
  try {
    const names = item.entitytitle.split(" ");
    const firstName = names.slice(0, names.length - 1).join(" ");
    const lastName = names[names.length - 1];
    await conn.query(query, [
      item.id,
      entityId,
      firstName,
      lastName,
      item.company,
    ]);
    if (item.email) {
      await processEmail(conn, item.email, entityId);
    }

    if (item.phone) {
      await processPhone(conn, item.phone, entityId);
    }

    if (item.mobilephone) {
      await processPhone(conn, item.mobile, entityId);
    }
  } catch (err) {
    console.error(err);
  }
};

const processAllContacts = async function (conn) {
  var offset = 0;
  var items = [];
  const body = JSON.stringify({
    q: "select * from contact",
  });
  while (offset <= 4350) {
    var res = await fetch(
      `https://5645740.suitetalk.api.netsuite.com/services/rest/query/v1/suiteql?limit=${offsetAmt}&offset=${offset}`,
      {
        headers: headers,
        body: body,
        method: "POST",
      }
    );

    if (res.ok) {
      const json = await res.json();
      items = json.items;
    }

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      await processContact(conn, item);
    }

    offset += offsetAmt;
  }
};

const processSingleContact = async function (conn, contactId) {
  var offset = 0;
  var items = [];
  const body = JSON.stringify({
    q: `SELECT * FROM contact WHERE id='${contactId}'`,
  });
  var res = await fetch(
    `https://5645740.suitetalk.api.netsuite.com/services/rest/query/v1/suiteql`,
    {
      headers: headers,
      body: body,
      method: "POST",
    }
  );

  if (res.ok) {
    const json = await res.json();
    items = json.items;
  }

  if (items.length > 0) {
    const item = items[0];
    await processContact(conn, item);
  }
};

// (async () => {
//   const args = process.argv.slice(2);
//   processSingleCustomer(args[0]);
// })();

module.exports = { processSingleCustomer };
