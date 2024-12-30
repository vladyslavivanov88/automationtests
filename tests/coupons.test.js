const LoginService = require('../pageObjects/LoginService');
const GasApi = require('../pageObjects/GasApi');
const GravtyService = require('../pageObjects/GravtyService');
const testDataUser = require('../testDataJson/testDataUser.json');
const testDataGasTransaction = require('../testDataJson/transactionGasData.json');
const Helpers = require('../pageObjects/helpers');
const couponMakePaymentChargeData = require('../testDataJson/couponMakePaymentChargeData.json');
const couponAssignData = require('../testDataJson/assignCupons.json');

const { phoneNumber, deviceId, otpData, loginData, baseURL } = testDataUser;

const loginService = new LoginService(baseURL);
const gravtyService = new GravtyService(baseURL);
const gasApi = new GasApi('https://mustang.mioxxo.io/gas');
const helper = new Helpers();

let transactionDate;


let mediumCode, memberId, ciamToken; // To store the token for use in tests

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
      // Step 4: Get medium code 
      const userInfo = await loginService.getUserInfo(ciamToken);
      mediumCode = await gravtyService.getMediumCode(ciamToken);
      memberId = userInfo.memberId;
      expect(mediumCode).toBeDefined();
    });
  
    test('Coupons are updated when the count is less than 5', async () => {
        const getCouponsAvailabilityBefore = await gasApi.getCouponsAvailability(ciamToken)
        expect(getCouponsAvailabilityBefore.companies[0].name).toEqual('CAR_WASH')
        expect(getCouponsAvailabilityBefore.companies[1].name).toEqual('CINEMEX')

        if (getCouponsAvailabilityBefore.companies[1].countAvailable < 5) {
            // Transaction > 200 pesso (transaction date should be > than last transaction)
            transactionDate = await helper.getFormattedDateWithOffset();
            const transactionPayload = {
                ...testDataGasTransaction,
                medium_code: mediumCode,
                member_id: memberId,
                date: transactionDate,
            };
            const transactionResponse = await gasApi.makeTransaction(transactionPayload);
            expect(transactionResponse).toBe(200);
        } else {
            // Buy coupons
            const getSessionInfo = await gasApi.getSessionInfo(ciamToken);
            couponMakePaymentChargeData.chargeData.sessionId = getSessionInfo.response;
            const makePaymentCharge = await gasApi.makePaymentCharge(ciamToken, couponMakePaymentChargeData);
            couponAssignData.orderPaymentId = makePaymentCharge.response.processOrder.orderPaymentId;
            const getPayOrder = await gasApi.getPayOrder(ciamToken, couponAssignData.orderPaymentId);
            couponAssignData.payOrderNumber = getPayOrder.response.orderPaymentId
            const assignCupons = await gasApi.assignCoupon(ciamToken, couponAssignData);
            const getCouponsAvailabilityAfter = await gasApi.getCouponsAvailability(ciamToken)
            expect(getCouponsAvailabilityAfter.companies[1].countAvailable < 5).toBeTruthy();
            // Transaction > 200 pesso (transaction date should be > than last transaction)
            transactionDate = await helper.getFormattedDateWithOffset();
            const transactionPayload = {
                ...testDataGasTransaction,
                medium_code: mediumCode,
                member_id: memberId,
                date: transactionDate,
            };
            const transactionResponse = await gasApi.makeTransaction(transactionPayload);
            expect(transactionResponse).toBe(200);
        }
        const getCouponsAvailabilityAfter = await gasApi.getCouponsAvailability(ciamToken)
        expect(getCouponsAvailabilityAfter.companies[0].name).toEqual('CAR_WASH')
        expect(getCouponsAvailabilityAfter.companies[1].name).toEqual('CINEMEX')
        expect(getCouponsAvailabilityAfter.companies[1].countAvailable).toEqual(5)
    })

    test('Coupons are not updated when the count is 5', async () => {
        const getCouponsAvailabilityBefore = await gasApi.getCouponsAvailability(ciamToken)
        expect(getCouponsAvailabilityBefore.companies[0].name).toEqual('CAR_WASH')
        expect(getCouponsAvailabilityBefore.companies[1].name).toEqual('CINEMEX')

        if (getCouponsAvailabilityBefore.companies[1].countAvailable === 5) {
            // Transaction > 200 pesso (transaction date should be > than last transaction)
            transactionDate = await helper.getFormattedDateWithOffset(90, 1, 1);
            const transactionPayload = {
                ...testDataGasTransaction,
                medium_code: mediumCode,
                member_id: memberId,
                date: transactionDate,
            };
            const transactionResponse = await gasApi.makeTransaction(transactionPayload);
            expect(transactionResponse).toBe(200);
        } else {
            // First transaction for coupon 
            transactionDate = await helper.getFormattedDateWithOffset(90, 1, 1);
            let transactionDate2 = await helper.getFormattedDateWithOffset(90, 1, 2);
            const transactionPayload = {
                ...testDataGasTransaction,
                medium_code: mediumCode,
                member_id: memberId,
                date: transactionDate,
            };
            const transactionResponse = await gasApi.makeTransaction(transactionPayload);
            expect(transactionResponse).toBe(200);
            // Second transaction for coupon 
            const transactionPayload2 = {
                ...testDataGasTransaction,
                medium_code: mediumCode,
                member_id: memberId,
                date: transactionDate2,
            };
            const transactionResponse2 = await gasApi.makeTransaction(transactionPayload2);
            expect(transactionResponse2).toBe(200);
        }
        const getCouponsAvailabilityAfter = await gasApi.getCouponsAvailability(ciamToken)
        expect(getCouponsAvailabilityAfter.companies[0].name).toEqual('CAR_WASH')
        expect(getCouponsAvailabilityAfter.companies[1].name).toEqual('CINEMEX')
        expect(getCouponsAvailabilityAfter.companies[1].countAvailable).toEqual(5)
    })

    test('Coupons are not updated when the count is less than 5 and transaction less than 200 pesso', async () => {
        const getCouponsAvailabilityBefore = await gasApi.getCouponsAvailability(ciamToken)
        expect(getCouponsAvailabilityBefore.companies[0].name).toEqual('CAR_WASH')
        expect(getCouponsAvailabilityBefore.companies[1].name).toEqual('CINEMEX')

        if (getCouponsAvailabilityBefore.companies[1].countAvailable === 5) {
            // Buy coupons
            const getSessionInfo = await gasApi.getSessionInfo(ciamToken);
            couponMakePaymentChargeData.chargeData.sessionId = getSessionInfo.response;
            const makePaymentCharge = await gasApi.makePaymentCharge(ciamToken, couponMakePaymentChargeData);
            couponAssignData.orderPaymentId = makePaymentCharge.response.processOrder.orderPaymentId;
            const getPayOrder = await gasApi.getPayOrder(ciamToken, couponAssignData.orderPaymentId);
            couponAssignData.payOrderNumber = getPayOrder.response.orderPaymentId
            const assignCupons = await gasApi.assignCoupon(ciamToken, couponAssignData);
        }
        transactionDate = await helper.getFormattedDateWithOffset(90, 1, 3);
        const transactionPayload = {
            ...testDataGasTransaction,
            medium_code: mediumCode,
            member_id: memberId,
            date: transactionDate,
            payment_details: [
                {
                    amount: 180,
                    method: "CARD"
                }
            ]
        };
        const transactionResponse2 = await gasApi.makeTransaction(transactionPayload);
        expect(transactionResponse2).toBe(200); 
        const getCouponsAvailabilityAfter = await gasApi.getCouponsAvailability(ciamToken)
        expect(getCouponsAvailabilityBefore.companies[1].countAvailable).toEqual(getCouponsAvailabilityAfter.companies[1].countAvailable)
    })
})