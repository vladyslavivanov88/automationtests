const LoginService = require('../pageObjects/LoginService');
const GravtyService = require('../pageObjects/GravtyService');
const testData = require('../testDataJson/testDataUser.json');

const { phoneNumber, deviceId, otpData, loginData, baseURL } = testData;

const loginService = new LoginService(baseURL);
const gravtyService = new GravtyService(baseURL);

let ciamToken; // To store the token for use in tests

jest.setTimeout(10000);

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
  });

  test('Get Medium Code', async () => {
    const mediumCode = await gravtyService.getMediumCode(ciamToken);
    expect(mediumCode).toBeDefined();
  });

  test('Verify User Info', async () => {
    const userInfo = await loginService.getUserInfo(ciamToken);
    expect(userInfo.nickname).toEqual(phoneNumber);
    expect(userInfo.userName).toEqual(phoneNumber);
    expect(userInfo.phoneNumber).toEqual(phoneNumber);
    expect(userInfo.loyaltyId).toBeTruthy();
    expect(userInfo.femsaId).toBeTruthy();
    expect(userInfo.memberId).toBeTruthy();
  });

  test('Get points', async () => {
    const userPoints = await gravtyService.getPoints(ciamToken);
    expect(userPoints.balance).toBeDefined();
  });
});