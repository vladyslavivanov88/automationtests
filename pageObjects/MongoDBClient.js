const { MongoClient } = require('mongodb');
require('dotenv').config();

class MongoDBClient {
    constructor() {
        this.uri = process.env.MONGO_URI;
        this.dbName = process.env.DB_NAME;
        this.client = null;
        this.db = null;
    }

    async connect() {
        if (!this.client) {
            this.client = new MongoClient(this.uri); // Убираем устаревшие опции
            await this.client.connect();
            this.db = this.client.db(this.dbName);
            console.log(`MongoDB connected to database: ${this.dbName}`);
        }
    }

    getCollection(collectionName) {
        if (!this.db) {
            throw new Error('Database not initialized. Call connect() first.');
        }
        return this.db.collection(collectionName);
    }

    async disconnect() {
        if (this.client) {
            await this.client.close();
            console.log('MongoDB disconnected.');
        }
    }

    async updateUserLastBoxDate(memberId, helper) {
        const collectionUsers = this.getCollection('users');
        const user = await collectionUsers.findOne({ _id: memberId });

        if (user) {
            const userLastBoxDate = user.last_box_obtained;
            const daysDifference = await helper.getDaysDifference(userLastBoxDate);

            if (daysDifference < 24) {
                const now = new Date();
                const newDate = new Date(now.getTime() - 48 * 60 * 60 * 1000);
                const updateResult = await collectionUsers.updateOne(
                    { _id: memberId },
                    { $set: { last_box_obtained: newDate } }
                );

                if (updateResult.modifiedCount === 1) {
                    console.log('Successfully updated the last_box_obtained date to 24 hours ago.');
                } else {
                    console.error('Failed to update the date.');
                }
            } else {
                console.log("The user's last_box_obtained date is not within the last 24 hours or not today.");
            }
        } else {
            console.error('User not found.');
        }
    }
}

module.exports = MongoDBClient;
