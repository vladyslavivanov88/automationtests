const LoginService = require('../pageObjects/LoginService');
const GravtyService = require('../pageObjects/GravtyService');
const GasApi = require('../pageObjects/GasApi');
const testDataUser = require('../testDataJson/testDataUser.json');
const testDataTransaction = require('../testDataJson/transactionGravtyData.json');
const testDataGasTransaction = require('../testDataJson/transactionGasData.json');
const MongoDBClient = require('../pageObjects/MongoDBClient');

const { v4: uuidv4 } = require('uuid'); // Import the UUID generator
const Helpers = require('../pageObjects/helpers');
let mongoClient;
let collectionUsers, collectionTransaction, collectionBoxes;

const { phoneNumber, deviceId, otpData, loginData, baseURL } = testDataUser;

const loginService = new LoginService(baseURL);
const gravtyService = new GravtyService(baseURL);
const gasApi = new GasApi('https://mustang.mioxxo.io/gas');
const helper = new Helpers();

let ciamToken, userInfo, mediumCode; // To store the token for use in tests

jest.setTimeout(30000);

describe('CIAM Login Service', () => {
  beforeAll(async () => {
    // Step 1: Validate OTP
    const otpAccessToken = await loginService.validateOtp(otpData);
    expect(otpAccessToken).toBeDefined();
    // Step 2: Validate Phone Number
    const userValidationResponse = await loginService.validatePhoneNumber(
      phoneNumber,
      deviceId,
      otpAccessToken
    );
    expect(userValidationResponse).toHaveProperty('codeUserStatus', '2');
    // Step 3: Login and store ciamToken
    ciamToken = await loginService.login(loginData);
    expect(ciamToken).toBeDefined();

    // Get user info
    userInfo = await loginService.getUserInfo(ciamToken);
    mediumCode = await gravtyService.getMediumCode(ciamToken);
    expect(mediumCode).toBeDefined();

    // Connect to DB
    mongoClient = new MongoDBClient();
    await mongoClient.connect();
    collectionUsers = mongoClient.getCollection('users');
    collectionTransaction = mongoClient.getCollection('transactions');
    collectionBoxes = mongoClient.getCollection('campaign_boxes');
  });

  test('GAS transaction (1 day - 1 box)', async () => {
    // Get points
    const userPoints = await gravtyService.getPoints(ciamToken);
    expect(userPoints.balance).toBeDefined();

    // Get Boxes
    const boxes = await gasApi.getBoxes(ciamToken);
    expect(boxes.status).toBe(200);
    const result = await gasApi.countBoxes(ciamToken);
    const totalBoxCount = result.totalBoxes;
    const totalClosedBoxCount = result.closedBoxesLength;

    // Check add 1 boxe for 1 day
    const user = await collectionUsers.findOne({ _id: userInfo.memberId });
    const userLastBoxDate = user.last_box_obtained;
    const daysDifference = await helper.getDaysDifference(userLastBoxDate);
    // Get transaction count 
    let collectionTransactionCountBefore = (await collectionTransaction
    .find({ memberId: userInfo.memberId })
    .toArray())
    .length;
    if (daysDifference < 24) {
      // Case when today added box
      // New GAS transaction
      const transactionPayload = {
        ...testDataGasTransaction,
        medium_code: mediumCode,
        member_id: userInfo.memberId
      };
      const transactionResponse = await gasApi.makeTransaction(transactionPayload);
      expect(transactionResponse).toBe(200);

      // Verifie box cont defore transaction = box count after transaction
      const newBoxes = await gasApi.countBoxes(ciamToken);
      const totalNewBoxCount = newBoxes.totalBoxes;
      const totalNewClosedBoxCount = newBoxes.closedBoxesLength;
      expect(totalNewBoxCount).toEqual(totalBoxCount);
      expect(totalNewClosedBoxCount).toEqual(totalClosedBoxCount);
      // Verifie new transaction adde to DB
      let collectionTransactionCountAfter = (await collectionTransaction
        .find({ memberId: userInfo.memberId })
        .toArray())
        .length;
      expect(collectionTransactionCountAfter > collectionTransactionCountBefore).toBeTruthy();
    } else {
      // New GAS transaction
      const transactionPayload = {
        ...testDataGasTransaction,
        medium_code: mediumCode,
        member_id: userInfo.memberId
      };
      const transactionResponse = await gasApi.makeTransaction(transactionPayload);
      expect(transactionResponse).toBe(200);
      // Verifie new transaction adde to DB
      let collectionTransactionCountAfter = (await collectionTransaction
        .find({ memberId: userInfo.memberId })
        .toArray())
        .length;
      // Verifie box cont defore transaction > box count after transaction (closed box)
      const newBoxes = await gasApi.countBoxes(ciamToken);
      const totalNewBoxCount = newBoxes.totalBoxes;
      const totalNewClosedBoxCount = newBoxes.closedBoxesLength;
      expect(collectionTransactionCountAfter > collectionTransactionCountBefore).toBeTruthy();
      expect(totalNewBoxCount > totalBoxCount).toBeTruthy();
      expect(totalNewClosedBoxCount > totalClosedBoxCount).toBeTruthy();
    }
  });

  test('Open box (1 day - 1 box)', async () => {
      // Cange date for actual for new box (< 24 houers)
      await mongoClient.updateUserLastBoxDate(userInfo.memberId, helper);

      // Create new transaction for new box
      const boxes = await gasApi.getBoxes(ciamToken);
      expect(boxes.status).toBe(200);
      const result = await gasApi.countBoxes(ciamToken);
      const totalBoxCount = result.totalBoxes;
      const totalClosedBoxCount = result.closedBoxesLength;
      let collectionTransactionCountBefore = (await collectionTransaction
        .find({ memberId: userInfo.memberId })
        .toArray())
        .length;
      const transactionPayload = {
        ...testDataGasTransaction,
        medium_code: mediumCode,
        member_id: userInfo.memberId
      };
      const transactionResponse = await gasApi.makeTransaction(transactionPayload);
      expect(transactionResponse).toBe(200);

      let collectionTransactionCountAfter = (await collectionTransaction
        .find({ memberId: userInfo.memberId })
        .toArray())
        .length;
      const newBoxes = await gasApi.countBoxes(ciamToken);
      const totalNewBoxCount = newBoxes.totalBoxes;
      const totalNewClosedBoxCount = newBoxes.closedBoxesLength;
      const totalClosedBox = result.closedBoxes;
      expect(collectionTransactionCountAfter > collectionTransactionCountBefore).toBeTruthy();
      expect(totalNewBoxCount > totalBoxCount).toBeTruthy();
      expect(totalNewClosedBoxCount > totalClosedBoxCount).toBeTruthy();

      // Open box
      const openBox = await gasApi.openBoxes(ciamToken, totalClosedBox[0].id);
      // Box ID is opened
      expect(openBox.id).toEqual(totalClosedBox[0].id);
      expect(openBox.boxStatus).toEqual('OPEN');
      const countBoxesAfterOpen = await gasApi.countBoxes(ciamToken);
      
      expect(countBoxesAfterOpen.closedBoxesLength < totalNewClosedBoxCount).toBeTruthy();

      // Create new transaction. New box didn't create
      const transactionResponseWitoutBox = await gasApi.makeTransaction(transactionPayload);
      expect(transactionResponseWitoutBox).toBe(200);
      const newBoxesTransactionResponseWitoutBox = await gasApi.countBoxes(ciamToken);
      const totalNewBoxCountTransactionResponseWitoutBox = newBoxesTransactionResponseWitoutBox.totalBoxes;

      expect(totalNewBoxCount).toEqual(totalNewBoxCountTransactionResponseWitoutBox);

      // Open box that was opened
      try {
        const result = await gasApi.openBoxes(ciamToken, totalClosedBox[0].id);
        if (result.status === 400) {
            console.log('Handled gracefully:', result.message);
        } else {
            console.log('Box opened successfully:', result);
        }
      } catch (error) {
          expect(error.message === 400);
      }      
  })

  test('Negative cases for add box', async () => {
    // Cange date for actual for new box (< 24 houers)
    await mongoClient.updateUserLastBoxDate(userInfo.memberId, helper);
    
    // Fuel = MAGNA and price < 650
    const boxes = await gasApi.getBoxes(ciamToken);
      expect(boxes.status).toBe(200);
      const result = await gasApi.countBoxes(ciamToken);
      const totalBoxCount = result.totalBoxes;
      const totalClosedBoxCount = result.closedBoxesLength;
      let collectionTransactionCountBefore = (await collectionTransaction
        .find({ memberId: userInfo.memberId })
        .toArray())
        .length;
      const transactionPayload = {
        ...testDataGasTransaction,
        medium_code: mediumCode,
        member_id: userInfo.memberId,
      };
      // Modify only the required fields
      transactionPayload.payment_details = [
        {
          amount: 649,
          method: "CARD"
        }
      ];
      transactionPayload.products = [
        {
          type: '0',
          price: 5,
          category: 'COMBUSTIBLE',
          sub_category: 'MAGNA',
          quantity: 53.683,
          total_discount: 0,
          code: '2'
        }
      ];
      let transactionResponse = await gasApi.makeTransaction(transactionPayload);
      expect(transactionResponse).toBe(200);

      let collectionTransactionCountAfter = (await collectionTransaction
        .find({ memberId: userInfo.memberId })
        .toArray())
        .length;
      const newBoxesMagna = await gasApi.countBoxes(ciamToken);
      const totalNewBoxCountMagna = newBoxesMagna.totalBoxes;
      const totalNewClosedBoxCountMagna = newBoxesMagna.closedBoxesLength;
      expect(collectionTransactionCountAfter > collectionTransactionCountBefore).toBeTruthy();
      expect(totalNewBoxCountMagna === totalBoxCount).toBeTruthy();
      expect(totalNewClosedBoxCountMagna === totalClosedBoxCount).toBeTruthy();

     // Fuel = PREMIUM and price < 650
     // Modify only the required fields
     transactionPayload.payment_details = [
      {
        amount: 649,
        method: "CARD"
      }
    ];
    transactionPayload.products = [
      {
        type: '0',
        price: 5,
        category: 'COMBUSTIBLE',
        sub_category: 'PREMIUM',
        quantity: 53.683,
        total_discount: 0,
        code: '2'
      }
    ];
    transactionResponse = await gasApi.makeTransaction(transactionPayload);
    expect(transactionResponse).toBe(200);

    collectionTransactionCountAfter = (await collectionTransaction
      .find({ memberId: userInfo.memberId })
      .toArray())
      .length;
    const newBoxesPremium = await gasApi.countBoxes(ciamToken);
    const totalNewBoxCountPremium = newBoxesPremium.totalBoxes;
    const totalNewClosedBoxCountPremium = newBoxesPremium.closedBoxesLength;
    expect(collectionTransactionCountAfter > collectionTransactionCountBefore).toBeTruthy();
    expect(totalNewBoxCountPremium === totalBoxCount).toBeTruthy();
    expect(totalNewClosedBoxCountPremium === totalClosedBoxCount).toBeTruthy();

     // Fuel = DIESEL and price < 2000
     // Modify only the required fields
     transactionPayload.payment_details = [
      {
        amount: 1999,
        method: "CARD"
      }
    ];
    transactionPayload.products = [
      {
        type: '0',
        price: 5,
        category: 'COMBUSTIBLE',
        sub_category: 'DIESEL',
        quantity: 53.683,
        total_discount: 0,
        code: '2'
      }
    ];
    transactionResponse = await gasApi.makeTransaction(transactionPayload);
    expect(transactionResponse).toBe(200);

    collectionTransactionCountAfter = (await collectionTransaction
      .find({ memberId: userInfo.memberId })
      .toArray())
      .length;
    const newBoxesDiesel = await gasApi.countBoxes(ciamToken);
    const totalNewBoxCountDiesel = newBoxesPremium.totalBoxes;
    const totalNewClosedBoxCountDiesel = newBoxesPremium.closedBoxesLength;
    expect(collectionTransactionCountAfter > collectionTransactionCountBefore).toBeTruthy();
    expect(totalNewBoxCountDiesel === totalBoxCount).toBeTruthy();
    expect(totalNewClosedBoxCountDiesel === totalClosedBoxCount).toBeTruthy();

     // Fuel != DIESEL, PREMIUM, MAGNA and price > 2000
     // Modify only the required fields
     transactionPayload.payment_details = [
      {
        amount: 2550,
        method: "CARD"
      }
    ];
    transactionPayload.products = [
      {
        type: '0',
        price: 200,
        category: 'COMBUSTIBLE',
        sub_category: 'TEST',
        quantity: 53.683,
        total_discount: 0,
        code: '2'
      }
    ];
    transactionResponse = await gasApi.makeTransaction(transactionPayload);
    expect(transactionResponse).toBe(200);

    collectionTransactionCountAfter = (await collectionTransaction
      .find({ memberId: userInfo.memberId })
      .toArray())
      .length;
    const newBoxesNo = await gasApi.countBoxes(ciamToken);
    const totalNewBoxCountNo = newBoxesPremium.totalBoxes;
    const totalNewClosedBoxCountNo = newBoxesPremium.closedBoxesLength;
    expect(collectionTransactionCountAfter > collectionTransactionCountBefore).toBeTruthy();
    expect(totalNewBoxCountNo === totalBoxCount).toBeTruthy();
    expect(totalNewClosedBoxCountNo === totalClosedBoxCount).toBeTruthy();
  })

  test('Positive cases for add box', async () => {
    // Fuel = MAGNA and price > 650
    // Cange date for actual for new box (< 24 houers)
    await mongoClient.updateUserLastBoxDate(userInfo.memberId, helper);

    const boxes = await gasApi.getBoxes(ciamToken);
    expect(boxes.status).toBe(200);
    const result = await gasApi.countBoxes(ciamToken);
    const totalBoxCount = result.totalBoxes;
    const totalClosedBoxCount = result.closedBoxesLength;
    let collectionTransactionCountBefore = (await collectionTransaction
      .find({ memberId: userInfo.memberId })
      .toArray())
      .length;
    const transactionPayload = {
      ...testDataGasTransaction,
      medium_code: mediumCode,
      member_id: userInfo.memberId,
    };
    // Modify only the required fields
    transactionPayload.payment_details = [
      {
        amount: 650,
        method: "CARD"
      }
    ];
    transactionPayload.products = [
      {
        type: '0',
        price: 25,
        category: 'COMBUSTIBLE',
        sub_category: 'MAGNA',
        quantity: 53.683,
        total_discount: 0,
        code: '2'
      }
    ];
    let transactionResponse = await gasApi.makeTransaction(transactionPayload);
    expect(transactionResponse).toBe(200);

    let collectionTransactionCountAfter = (await collectionTransaction
      .find({ memberId: userInfo.memberId })
      .toArray())
      .length;
    const newBoxesMagna = await gasApi.countBoxes(ciamToken);
    const totalNewBoxCountMagna = newBoxesMagna.totalBoxes;
    const totalNewClosedBoxCountMagna = newBoxesMagna.closedBoxesLength;
    expect(collectionTransactionCountAfter > collectionTransactionCountBefore).toBeTruthy();

    expect(totalNewBoxCountMagna > totalBoxCount).toBeTruthy();
    expect(totalNewClosedBoxCountMagna > totalClosedBoxCount).toBeTruthy();

    // Fuel = PREMIUM and price > 650
    // Cange date for actual for new box (< 24 houers)
    // Cange date for actual for new box (< 24 houers)
    await mongoClient.updateUserLastBoxDate(userInfo.memberId, helper);
    const boxesPremium = await gasApi.getBoxes(ciamToken);
    expect(boxes.status).toBe(200);
    const resultPremium = await gasApi.countBoxes(ciamToken);
    const totalBoxCountPremium = resultPremium.totalBoxes;
    const totalClosedBoxCountPremium = resultPremium.closedBoxesLength;
    collectionTransactionCountBefore = (await collectionTransaction
      .find({ memberId: userInfo.memberId })
      .toArray())
      .length;
    const transactionPayloadPremium = {
      ...testDataGasTransaction,
      medium_code: mediumCode,
      member_id: userInfo.memberId,
    };
    // Modify only the required fields
    transactionPayloadPremium.payment_details = [
      {
        amount: 650,
        method: "CARD"
      }
    ];
    transactionPayloadPremium.products = [
      {
        type: '0',
        price: 25,
        category: 'COMBUSTIBLE',
        sub_category: 'PREMIUM',
        quantity: 53.683,
        total_discount: 0,
        code: '2'
      }
    ];
    transactionResponse = await gasApi.makeTransaction(transactionPayloadPremium);
    expect(transactionResponse).toBe(200);

    collectionTransactionCountAfter = (await collectionTransaction
      .find({ memberId: userInfo.memberId })
      .toArray())
      .length;
    const newBoxesPremium = await gasApi.countBoxes(ciamToken);
    const totalNewBoxCountPremium = newBoxesPremium.totalBoxes;
    const totalNewClosedBoxCountPremium = newBoxesPremium.closedBoxesLength;
    expect(collectionTransactionCountAfter > collectionTransactionCountBefore).toBeTruthy();
    expect(totalNewBoxCountPremium > totalBoxCountPremium).toBeTruthy();
    expect(totalNewClosedBoxCountPremium > totalClosedBoxCountPremium).toBeTruthy();

    // Fuel = DIESEL and price > 2000
    // Cange date for actual for new box (< 24 houers)
    await mongoClient.updateUserLastBoxDate(userInfo.memberId, helper);
    const boxesDiesel = await gasApi.getBoxes(ciamToken);
    expect(boxes.status).toBe(200);
    const resultDiesel = await gasApi.countBoxes(ciamToken);
    const totalBoxCountDiesel = resultDiesel.totalBoxes;
    const totalClosedBoxCountDiesel = resultDiesel.closedBoxesLength;
    collectionTransactionCountBefore = (await collectionTransaction
      .find({ memberId: userInfo.memberId })
      .toArray())
      .length;
    const transactionPayloadDiesel = {
      ...testDataGasTransaction,
      medium_code: mediumCode,
      member_id: userInfo.memberId,
    };
    // Modify only the required fields
    transactionPayloadDiesel.payment_details = [
      {
        amount: 2000,
        method: "CARD"
      }
    ];
    transactionPayloadDiesel.products = [
      {
        type: '0',
        price: 45,
        category: 'COMBUSTIBLE',
        sub_category: 'DIESEL',
        quantity: 53.683,
        total_discount: 0,
        code: '2'
      }
    ];
    transactionResponse = await gasApi.makeTransaction(transactionPayloadDiesel);
    expect(transactionResponse).toBe(200);

    collectionTransactionCountAfter = (await collectionTransaction
      .find({ memberId: userInfo.memberId })
      .toArray())
      .length;
    const newBoxesDiesel = await gasApi.countBoxes(ciamToken);
    const totalNewBoxCountDiesel = newBoxesDiesel.totalBoxes;
    const totalNewClosedBoxCountDiesel = newBoxesDiesel.closedBoxesLength;
    expect(collectionTransactionCountAfter > collectionTransactionCountBefore).toBeTruthy();
    expect(totalNewBoxCountDiesel > totalBoxCountDiesel).toBeTruthy();
    expect(totalNewClosedBoxCountDiesel > totalClosedBoxCountDiesel).toBeTruthy();
  })

  test('Closed box is expired aftre 48 houers', async () => {
    const closedBoxesBefore = await gasApi.closedBoxes(ciamToken)
    // Get closed box from DB
    const getCollectionBoxes = await collectionBoxes
      .find({ memberId: userInfo.memberId, state: 'CLOSED'  }).toArray();

    // Find box from API
    const box = await gasApi.getBoxes(ciamToken)
    const boxID = helper.bintouuid((getCollectionBoxes[0]._id).toString('base64'))
    const exists = box.data.some(item => item.id === boxID);
    expect(exists).toBe(true)

    // Update expirationDate in DB
    const expirationDate = new Date(getCollectionBoxes[0].expiration_date_time);
    expirationDate.setHours(expirationDate.getHours() - 48);
    await collectionBoxes.updateOne(
      { _id:getCollectionBoxes[0]._id },  // Находим запись по её _id
      { $set: { expiration_date_time: expirationDate } }  // Устанавливаем новое значение expiration_date_time
    );

    const getCollectionBoxes2 = await collectionBoxes
      .find({ memberId: userInfo.memberId, state: 'CLOSED', _id: getCollectionBoxes[0]._id }).toArray();
    expect(getCollectionBoxes2[0].state).toBe('CLOSED')

    // Get boxes (Update status)
    await gasApi.getBoxes(ciamToken)

    // Verifie expired box
    const closedBoxesAfter = await gasApi.closedBoxes(ciamToken)
    expect(closedBoxesBefore.closedBoxesCount).toEqual(closedBoxesAfter.closedBoxesCount + 1)

    const getCollectionBoxes3 = await collectionBoxes
    .find({ memberId: userInfo.memberId, _id: getCollectionBoxes[0]._id }).toArray();
    expect(getCollectionBoxes3[0].state).toBe('EXPIRED')
  })

  test('Opened box is not expired aftre 48 houers', async () => {
    // Get closed box from DB
    const getCollectionBoxes = await collectionBoxes
      .find({ memberId: userInfo.memberId, state: 'OPEN'  }).toArray();

    // Find box from API
    const box = await gasApi.getBoxes(ciamToken)
    const boxID = helper.bintouuid((getCollectionBoxes[0]._id).toString('base64'))
    const exists = box.data.some(item => item.id === boxID);
    expect(exists).toBe(true)

    // Update expirationDate in DB
    const expirationDate = new Date(getCollectionBoxes[0].expiration_date_time);
    expirationDate.setHours(expirationDate.getHours() - 48);
    await collectionBoxes.updateOne(
      { _id:getCollectionBoxes[0]._id },  // Находим запись по её _id
      { $set: { expiration_date_time: expirationDate } }  // Устанавливаем новое значение expiration_date_time
    );

    const getCollectionBoxes2 = await collectionBoxes
      .find({ memberId: userInfo.memberId, state: 'OPEN', _id: getCollectionBoxes[0]._id }).toArray();
    expect(getCollectionBoxes2[0].state).toBe('OPEN')

    // Get boxes (Update status)
    await gasApi.getBoxes(ciamToken)

    // Verifie box has not expired
    const getCollectionBoxes3 = await collectionBoxes
    .find({ memberId: userInfo.memberId, _id: getCollectionBoxes[0]._id }).toArray();
    expect(getCollectionBoxes3[0].state).toBe('OPEN')
  })

  afterAll(async () => {
    if (mongoClient) {
      await mongoClient.disconnect();
    }
  });
});