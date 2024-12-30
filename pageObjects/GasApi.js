const axios = require('axios');
const xApiKey = '30e958b9-7107-4589-b603-416e4fe7fdec';

class GasApi {
    constructor(baseURL) {
        this.apiClient = axios.create({
            baseURL,
            headers: { 'Content-Type': 'application/json' },
        });
    }
    // Transaction
    async makeTransaction(payload) {
        try {
            const response = await this.apiClient.post('/api/v1/transactions', payload, {
                headers: {
                    'X-Api-Key': xApiKey,
                },
                auth: {
                    username: 'user',
                    password: '1234Pass',
                },
            });
            return response.status;
        } catch (error) {
            console.error('Error making transaction:', error.response ? error.response.data : error.message);
            throw error;
        }
    }
    async getBoxes(token) {
        const response = await this.apiClient.get('/api/v2/campaigns/boxes', {
          headers: {
            Authorization: `Bearer ${token}`,
            'X-Api-Key': xApiKey,
          }
        });
        return response; 
    }

    // Boxes
    async countBoxes(token) {
        const boxesResponse = await this.getBoxes(token);
    
        const boxes = boxesResponse.data || []; 
    
        if (!Array.isArray(boxes)) {
            throw new Error('Expected an array in response data, but got: ' + typeof boxes);
        }
    
        const totalBoxes = boxes.length;
        const closedBoxes = boxes.filter(box => box.boxStatus === 'CLOSED');
        const closedBoxesLength = closedBoxes.length;
    
        return {
            totalBoxes,
            closedBoxes,
            closedBoxesLength
        };
    }
    async openBoxes(token, boxId) {
        const response = await this.apiClient.post(`/api/v1/campaigns/boxes/${boxId}/open`,
        {}, {
          headers: {
            Authorization: `Bearer ${token}`,
            'X-Api-Key': xApiKey,
          }
        });
        return response.data; 
    }
    async closedBoxes(token) {
        const boxes = await this.getBoxes(token);
        const closedBoxes = [];
        for (const box of boxes.data) {
            if (box.boxStatus === 'CLOSED') {
                closedBoxes.push(box);
            }
        }

        return {
            totalBoxes: boxes.data.length,
            closedBoxes,
            closedBoxesCount: closedBoxes.length,
        };
    }

    // Tickets 
    async getTickets(token, sort = 'transactionDate,DESC', page = 0, size = 100) {
        try {
            const response = await this.apiClient.get('/api/v1/tickets', {
                headers: {
                    'X-Api-Key': xApiKey,
                    Authorization: `Bearer ${token}`,
                },
                params: {
                    sort,
                    page,
                    size,
                },
            });
            return response.data;
        } catch (error) {
            console.error('Error fetching tickets:', error.response ? error.response.data : error.message);
            throw error;
        }
    }
    async registerTicket(token, payload) {
        try {
            const response = await this.apiClient.post('/api/v1/tickets', payload, {
                headers: {
                    'X-Api-Key': xApiKey,
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
            });
            return response.data;
        } catch (error) {
            console.error('Error creating ticket:', error.response ? error.response.data : error.message);
            throw error;
        }
    }
    async countTickets(token) {
        try {
            const ticketsResponse = await this.getTickets(token);
    
            const tickets = ticketsResponse.content || [];
    
            if (!Array.isArray(tickets)) {
                throw new Error('Expected an array in response "content", but got: ' + typeof tickets);
            }
    
            const totalTickets = tickets.length;
            const createdTickets = tickets.filter(ticket => ticket.status === 'CREATED').length;
            const expiredTickets = tickets.filter(ticket => ticket.status === 'EXPIRED').length;
            const invoiceTickets = tickets.filter(ticket => ticket.status === 'INVOICED').length;
    
            return {
                totalTickets,
                createdTickets,
                expiredTickets,
                invoiceTickets,
            };
        } catch (error) {
            console.error('Error counting tickets:', error.response ? error.response.data : error.message);
            throw error;
        }
    }    
    async createInvoice(token, invoicePayload) {
        try {
            const response = await this.apiClient.post('/api/v1/tickets/invoice', invoicePayload, {
                headers: {
                    'X-Api-Key': xApiKey,
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
            });
            return response.data;
        } catch (error) {
            console.error('Error creating invoice:', error.response ? error.response.data : error.message);
            throw error;
        }
    }
    async getCouponsAvailability(token) {
        try {
            const response = await this.apiClient.get('/api/v2/coupons/availability', {
                headers: {
                    'X-Api-Key': xApiKey,
                    Authorization: `Bearer ${token}`,
                },
            });
            return response.data;
        } catch (error) {
            console.error('Error fetching coupons availability:', error.response ? error.response.data : error.message);
            throw error;
        }
    }
    async getCoupons(token, page = 0, size = 1000, sort = 'expirationDate,DESC') {
        try {
            const response = await this.apiClient.get('/api/v1/coupons', {
                headers: {
                    'X-Api-Key': xApiKey,
                    Authorization: `Bearer ${token}`,
                },
                params: {
                    page,
                    size,
                    sort,
                },
            });
            return response.data;
        } catch (error) {
            console.error('Error fetching coupons:', error.response ? error.response.data : error.message);
            throw error;
        }
    }
    // Buy coupon
    async getSessionInfo(token) {
        try {
            const response = await axios.get(`https://qa.api.spinplatform.digital/tr/superback/checkout/v1/session/id`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'X-Api-Key': xApiKey,
                    Accept: 'application/json',
                    "cookie": "visid_incap_2887940=xIuWjMoZTly1yOSxxSXBwSOxbWcAAAAAQUIPAAAAAADmgCtCZovN8AW/hVznx0oQ; nlbi_2887940=sKPEK5zd0T8fHAlM+7XbkAAAAACbmGP4o+MUxmVfz7u3UBqY; incap_ses_1532_2887940=mOULJhm5YWQvYOcIE8JCFQ2ybWcAAAAAwvfZDyugdNg1O8+hMT+eBw==; incap_ses_1845_2887940=ldq3HE37jhRQRMXd+MGaGY2ybWcAAAAAoidZZTqCWYCvI7enKI/vFA==",
                    "user-agent": "okhttp/4.12.0",
                    "x-api-version": 1.2,
                },
            });
            return response.data;
        } catch (error) {
            console.error('Error fetching session info:', error.response ? error.response.data : error.message);
            throw error;
        }
    }
    async makePaymentCharge(token, payload) {
        try {
            const response = await axios.post('https://qa.api.spinplatform.digital/tr/superback/checkout/v1/payment/charges', payload, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'X-Api-Key': xApiKey,
                    'X-Api-Version': '2.0',
                    "cookie": "visid_incap_2887940=03eZ4SEWQL2Lcv75ZrSKaNTMbWcAAAAAQUIPAAAAAABbXo595ZF54VW/fljKUGeO; nlbi_2887940=TCN8G8kjYgI5pC9R+7XbkAAAAABZ/h1DOmsPGiTRPt74izCg; incap_ses_1844_2887940=g7IyLojHXlIN2xXBcDSXGdTMbWcAAAAApENZciuWKGCWCsAj0gqLa",
                    "user-agent": "okhttp/4.12.0",
                },
            });
            return response.data;
        } catch (error) {
            console.error('Error making payment charge:', error.response ? error.response.data : error.message);
            throw error;
        }
    }
    async getPayOrder(token, payOrderId) {
        try {
            const response = await axios.get(`https://qa.api.spinplatform.digital/tr/superback/checkout/v1/payorder/${payOrderId}`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'X-Api-Key': xApiKey,
                    'Accept': 'application/json',
                },
            });
            return response.data;
        } catch (error) {
            console.error('Error fetching pay order:', error.response ? error.response.data : error.message);
            throw error;
        }
    }
    async assignCoupon(token, payload) {
        try {
            const response = await axios.post('https://qa.api.spinplatform.digital/tr/loyalty/delivery/v1/gas/coupons/assign', payload, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'X-Api-Key': xApiKey,
                },
            });
            return response.data;
        } catch (error) {
            console.error('Error assigning coupon:', error.response ? error.response.data : error.message);
            throw error;
        }
    }
}

module.exports = GasApi;