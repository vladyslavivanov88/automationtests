const axios = require('axios');

class GravtyService {
  constructor(baseURL) {
    this.apiClient = axios.create({
      baseURL,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  async getMediumCode(token) {
    const response = await this.apiClient.get('/tr/loyalty/customer/v1/customer/medium-code', {
      headers: {
        Authorization: `Bearer ${token}`,
      }
    });
    return response.data.medium_code; 
  }

  async getPoints(token) {
    const response = await this.apiClient.get('/tr/loyalty/customer/v1/customer/points', {
      headers: {
        Authorization: `Bearer ${token}`,
      }
    });
    return response.data; 
  }

  async makePOSTransaction(token, payload) {
    const response = await axios.post(
      'https://qa.api-pos.digitalmxce.com/api/v1/pos/accrual',
      payload,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'API-Key': '4XGEsUtkSmhXFYmgXlJ4GiCht1jVgsAGMkDNxU6SiUIRvESp',
        },
        timeout: 8000, // 8 seconds timeout
      }
    );
    console.log('Transaction response:', response.data);
    return response.data;
  }  
}

module.exports = GravtyService;