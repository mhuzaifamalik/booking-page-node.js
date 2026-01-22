import express from 'express';
import cookieParser from 'cookie-parser';
import cors from "cors"
import mongoose from 'mongoose';
import {connection} from "./database/dbconnection.js"
import { errorMiddleware } from './middlewares/error.js';
import userRouter from './route/userRouter.js';
import {removeUnverifiedAccounts} from './automation/removeUnverifiedAccounts.js';

export const    app = express();

app.use(cors({
    origin: [process.env.FRONTEND_URL],
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
})
);

app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({extended: true})) 

app.use('/api/v1/user', userRouter);


http://localhost:5000/api/v1/user/register



removeUnverifiedAccounts();


connection ()



app.use(errorMiddleware);