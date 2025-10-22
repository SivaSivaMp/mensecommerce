import morgan from 'morgan';
export const logger = morgan('dev', {
    skip: (req) =>
        req.url.startsWith('/css') ||
        req.url.startsWith('/js') ||
        req.url.startsWith('/images') ||
        req.url.startsWith('/fonts') ||
        req.url.startsWith('/assets'),
});
