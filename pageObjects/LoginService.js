const axios = require('axios');

class LoginService {
  constructor(baseURL) {
    this.apiClient = axios.create({
      baseURL,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Step 1: Validate OTP
  async validateOtp(otpData) {
    const response = await this.apiClient.post('/tr/superback/otp/v1/validate', otpData);
    return response.data.accessToken; // otpAccessToken
  }

  // Step 2: Validate Phone Number
  async validatePhoneNumber(phoneNumber, deviceId, otpAccessToken) {
    const response = await this.apiClient.get(
      '/tr/superback/ciam/v1/auth/uservalidation',
      {
        params: { phoneNumber, deviceId },
        headers: {
          Authorization: `Bearer ${otpAccessToken}`,
          'accept-encoding': 'gzip',
        },
      }
    );
    return response.data;
  }

  // Step 3: Login and get ciamToken
  async login(loginData) {
    const response = await this.apiClient.post('/tr/superback/ciam/v1/auth/login', loginData);
    return response.data.accessToken; // ciamToken
  }

  // Step 4: Get User Info
  async getUserInfo(token) {
    const response = await this.apiClient.get('/tr/superback/ciam/v1/auth/getuserprofile', {
      headers: {
        Authorization: `Bearer ${token}`,
      }
    });
    return response.data; // Profile info
  }
}

module.exports = LoginService;
