const LoginService = require('../pageObjects/LoginService');
const GasApi = require('../pageObjects/GasApi');
const testDataUser = require('../testDataJson/testDataUser.json');
const MongoDBClient = require('../pageObjects/MongoDBClient');
const tickets = require('../testDataJson/tickets.json');
const Helpers = require('../pageObjects/helpers');

const helper = new Helpers();

const { phoneNumber, deviceId, otpData, loginData, baseURL } = testDataUser;

const loginService = new LoginService(baseURL);
const gasApi = new GasApi('https://mustang.mioxxo.io/gas');
let mongoClient;
let collectionTickets, validTickets;

let ciamToken; // To store the token for use in tests

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
  
      // Connect to DB
      mongoClient = new MongoDBClient();
      await mongoClient.connect();
      collectionTickets = mongoClient.getCollection('tickets');

      // Filter exists tickets
      const ticketIds = await collectionTickets
            .find({}, { projection: { transactionId: 1, _id: 0 } }) 
            .map(doc => doc.transactionId) 
            .toArray(); 
      validTickets = await helper.findMissingTickets(tickets, ticketIds)
    });
  
    test('Register a ticket successfully', async () => {
        const ticketCountsBefore = await gasApi.countTickets(ciamToken);
        const ticket = tickets.find(ticket => ticket.transactionId === validTickets[0]);
        const registerTicket = await gasApi.registerTicket(ciamToken, ticket);
        const ticketCountsAfter = await gasApi.countTickets(ciamToken);
        expect(ticketCountsBefore.createdTickets).toEqual(ticketCountsAfter.createdTickets - 1);
        expect(ticketCountsBefore.expiredTickets).toEqual(ticketCountsAfter.expiredTickets);
        expect(ticketCountsBefore.invoiceTickets).toEqual(ticketCountsAfter.invoiceTickets);
    })

    test('Invoice ticket successfully', async () => {
        const ticketCountsBefore = await gasApi.countTickets(ciamToken);
        const ticketCreated = await gasApi.getTickets(ciamToken);
        const tickets = ticketCreated.content || []; 
        const createdTicket = tickets.filter(ticket => ticket.status === 'CREATED');
        const invoceData = {
            receiver: {
                rfc: 'BECR890207SD3',
                name: 'Name Surname',
                email: 'sergii.kaliberda@icemobile.com',
                cfdi: {
                    id: 'G03',
                    description: 'Gastos en general'
                },
                address: 'Col. Colonia del Valle, C.P. 42808',
                fiscalRegime: '626-Sueldos y Salarios e Ingresos Asimilados a Salarios'
            },
            ticketIds: [
                createdTicket[1].id
            ]
        };
        const invoiceTicket = await gasApi.createInvoice(ciamToken, invoceData);

        await new Promise(resolve => setTimeout(resolve, 5000));
        const ticketCountsAfter = await gasApi.countTickets(ciamToken);
        expect(createdTicket[1].id).toEqual(invoiceTicket.tickets[0].id)
        expect(invoiceTicket.tickets[0].status).toEqual("INVOICED");
        expect(ticketCountsBefore.createdTickets).toEqual(ticketCountsAfter.createdTickets + 1);
        expect(ticketCountsBefore.invoiceTickets).toEqual(ticketCountsAfter.invoiceTickets - 1);
    })

    test('Invoice ticket negative', async () => {
        const ticketCountsBefore = await gasApi.countTickets(ciamToken);
        const ticketCreated = await gasApi.getTickets(ciamToken);
        const tickets = ticketCreated.content || []; 
        const createdTicket = tickets.filter(ticket => ticket.status === 'CREATED');
        const invocededTicket = tickets.filter(ticket => ticket.status === 'INVOICED');

        // Try to invoce Invoced ticked 
        const invoceDataInvoced = {
            receiver: {
                rfc: 'BECR890207SD3',
                name: 'Name Surname',
                email: 'sergii.kaliberda@icemobile.com',
                cfdi: {
                    id: 'G03',
                    description: 'Gastos en general'
                },
                address: 'Col. Colonia del Valle, C.P. 42808',
                fiscalRegime: '626-Sueldos y Salarios e Ingresos Asimilados a Salarios'
            },
            ticketIds: [
                invocededTicket[0].id
            ]
        };
        try {
            await gasApi.createInvoice(ciamToken, invoceDataInvoced);
            throw new Error('Expected a conflict error (400), but the request succeeded');
        } catch (error) {
            expect(error.response.status).toBe(400);
            expect(error.response.data.message).toContain(`Ticket Ids [${invocededTicket[0].id}] not eligible for invoicing`);
        }
        const ticketCountsAfterInvoced = await gasApi.countTickets(ciamToken);
        expect(ticketCountsBefore.createdTickets).toEqual(ticketCountsAfterInvoced.createdTickets);
        expect(ticketCountsBefore.invoiceTickets).toEqual(ticketCountsAfterInvoced.invoiceTickets);

        // Wrong ticket id
        const invoceDataTicketId = {
            receiver: {
                rfc: 'BECR890207SD3',
                name: 'Name Surname',
                email: 'sergii.kaliberda@icemobile.com',
                cfdi: {
                    id: 'G03',
                    description: 'Gastos en general'
                },
                address: 'Col. Colonia del Valle, C.P. 42808',
                fiscalRegime: '626-Sueldos y Salarios e Ingresos Asimilados a Salarios'
            },
            ticketIds: [
                "12345"
            ]
        };
        try {
            await gasApi.createInvoice(ciamToken, invoceDataTicketId);
            throw new Error('Expected a conflict error (400), but the request succeeded');
        } catch (error) {
            expect(error.response.status).toBe(400);
            expect(error.response.data.detail).toContain('Failed to read request');
        }
        const ticketCountsAfterWrongTicketId = await gasApi.countTickets(ciamToken);
        expect(ticketCountsBefore.createdTickets).toEqual(ticketCountsAfterWrongTicketId.createdTickets);
        expect(ticketCountsBefore.invoiceTickets).toEqual(ticketCountsAfterWrongTicketId.invoiceTickets);

        // Wrong rfc
        const invoceDataRfc = {
            receiver: {
                rfc: 'BECR890207S00',
                name: 'Name Surname',
                email: 'sergii.kaliberda@icemobile.com',
                cfdi: {
                    id: 'G03',
                    description: 'Gastos en general'
                },
                address: 'Col. Colonia del Valle, C.P. 42808',
                fiscalRegime: '626-Sueldos y Salarios e Ingresos Asimilados a Salarios'
            },
            ticketIds: [
                createdTicket[createdTicket.length - 2].id
            ]
        };
        try {
            await gasApi.createInvoice(ciamToken, invoceDataRfc);
            throw new Error('Expected a conflict error (400), but the request succeeded');
        } catch (error) {
            expect(error.response.status).toBe(400);
            expect(error.response.data.message).toContain('Error creating invoice: Este RFC del receptor no existe en la lista de RFC inscritos no cancelados del SAT.');
        }
        const ticketCountsAfter = await gasApi.countTickets(ciamToken);
        expect(ticketCountsBefore.createdTickets).toEqual(ticketCountsAfter.createdTickets);
        expect(ticketCountsBefore.invoiceTickets).toEqual(ticketCountsAfter.invoiceTickets);
    })

    test('Register a already exists', async () => {
        const ticketCountsBefore = await gasApi.countTickets(ciamToken);
        const ticket = {
            stationNumber: 'E07791',
            amount: 100,
            transactionId: 79819810,
        };
        try {
            await gasApi.registerTicket(ciamToken, ticket);
            throw new Error('Expected a conflict error, but the request succeeded');
        } catch (error) {
            expect(error.response.status).toBe(409);
            expect(error.response.data.error).toBe('Conflict');
            expect(error.response.data.message).toContain('Ticket already exists');
        }
        const ticketCountAfter = await gasApi.countTickets(ciamToken);
        expect(ticketCountsBefore).toEqual(ticketCountAfter);
    })

    afterAll(async () => {
        if (mongoClient) {
          await mongoClient.disconnect();
        }
      });
})