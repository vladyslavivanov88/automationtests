class Helpers {
    constructor() {

    }  
    async getDaysDifference(date2) {
        const d1 = new Date(); 
        const d2 = new Date(date2); 

        const differenceInMilliseconds = Math.abs(d1 - d2); 
        const differenceInDays = Math.floor(differenceInMilliseconds / (1000 * 60 * 60)); 

        return differenceInDays;
    }
    async findMissingTickets(tickets, ticketIds) {
        // Приводим все ID к строкам
        const ticketsFromFile = tickets.map(ticket => Number(ticket.transactionId));
        const normalizedTicketIds = ticketIds.map(id => Number(id));
    
        const missingTickets = [];
    
        for (const ticketId of ticketsFromFile) {
            if (!normalizedTicketIds.includes(ticketId)) {
                missingTickets.push(ticketId);
            }
        }
    
        if (missingTickets.length > 0) {
            console.log('Missing Ticket IDs:', missingTickets);
        } else {
            console.log('All Ticket IDs are present in the collection.');
        }
    
        return missingTickets;
    }    
    async getFormattedDateWithOffset(days = 90, hours = 0, minutes = 0) {
        const now = new Date(); 
    
        // Увеличиваем дату на указанное количество дней, часов и минут
        now.setDate(now.getDate() + days);
        now.setHours(now.getHours() + hours);
        now.setMinutes(now.getMinutes() + minutes);
        
        // Форматируем дату
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0'); 
        const day = String(now.getDate()).padStart(2, '0');
        const hour = String(now.getHours()).padStart(2, '0');
        const minute = String(now.getMinutes()).padStart(2, '0');
        const second = String(now.getSeconds()).padStart(2, '0');
        const millisecond = String(now.getMilliseconds()).padStart(3, '0');
        
        return `${year}-${month}-${day}T${hour}:${minute}:${second}.${millisecond}-06:00`;
    }    
    bintouuid(base64str) {
        // Декодируем Base64 строку
        const binData = atob(base64str);
    
        // Преобразуем бинарные данные в строку шестнадцатеричных символов
        let hexstr = '';
        for (let i = 0; i < binData.length; i++) {
            hexstr += binData.charCodeAt(i).toString(16).padStart(2, '0');
        }
    
        // Формируем UUID из шестнадцатеричной строки
        const uuid = `${hexstr.substring(14, 16)}${hexstr.substring(12, 14)}${hexstr.substring(10, 12)}${hexstr.substring(8, 10)}-` +
                     `${hexstr.substring(6, 8)}${hexstr.substring(4, 6)}-` +
                     `${hexstr.substring(2, 4)}${hexstr.substring(0, 2)}-` +
                     `${hexstr.substring(30, 32)}${hexstr.substring(28, 30)}-` +
                     `${hexstr.substring(26, 28)}${hexstr.substring(24, 26)}${hexstr.substring(22, 24)}${hexstr.substring(20, 22)}${hexstr.substring(18, 20)}${hexstr.substring(16, 18)}`;
    
        return uuid;
    }
}

module.exports = Helpers;