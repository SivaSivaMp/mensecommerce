import express from 'express';
import MongoStore from 'connect-mongo';
import session from 'express-session';
import nocache from 'nocache';
import morgan from 'morgan';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import connectB from './config/db.js';
import AppError from './utils/appError.js';
import globalErrorHandler from './controllers/user/errorController.js';
import userRouter from './routes/user/userRoutes.js';
import passport from './config/passport.js'

const app = express();
dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
connectB();
app.use(
    session({
        secret: process.env.SESSION_SECRET,
        resave: false,
        saveUninitialized: false,
        store: MongoStore.create({
            mongoUrl: process.env.DATABASE_LOCAL,
            collectionName: 'sessions',
            ttl: 60 * 60 * 24,
        }),
        cookie: {
            maxAge: 1000 * 60 * 60 * 24,
            httpOnly: true,
        },
    })
);
app.use(passport.initialize());
app.use(passport.session());
app.use((req, res, next) => {
    res.locals.user = req.session.user || req.user || null;
    next();
});
app.use(nocache());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
    morgan('dev', {
        skip: function (req, res) {
            return (
                req.url.startsWith('/css') ||
                req.url.startsWith('/js') ||
                req.url.startsWith('/images') ||
                req.url.startsWith('/fonts') ||
                req.url.startsWith('/admin') ||
                req.url.startsWith('/assets')
            );
        },
    })
);

app.set('view engine', 'ejs');
app.set('views', [
    path.join(__dirname, '/views/user'),
    path.join(__dirname, '/views/admin'),
]);
app.use(express.static(path.join(__dirname, 'public')));
app.use('/', userRouter);

app.use((req, res, next) => {
    next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
});
app.use(globalErrorHandler);

app.listen(process.env.PORT || 3000, () => {
    console.log(`server running in ${process.env.PORT}`);
});
