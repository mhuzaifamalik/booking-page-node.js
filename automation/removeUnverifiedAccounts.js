import cron from  'node-cron';
import {User} from '../models/usermodels.js';


export const removeUnverifiedAccounts =     () => {
    cron.schedule('*/30 * * * *', async () => {
            const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);        
             await User.deleteMany({
                accountverified: false,
                createdAt: { $lt: thirtyMinutesAgo }
            });
            
    });
};