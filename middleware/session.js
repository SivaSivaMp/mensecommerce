import session from 'express-session';
import dotenv from 'dotenv';
import MongoStore from 'connect-mongo';
dotenv.config();

const userSession = session({
    name: 'user_session',
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
});

const adminSession = session({
    name: 'admin_session',
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
});

export default { userSession, adminSession };
