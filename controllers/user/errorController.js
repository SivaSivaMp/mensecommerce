const globalErrorHandler = (err, req, res, next) => {
    err.statusCode = err.statusCode || 500;
    err.status = err.status || 'error';
    if (err.statusCode === 404) {
        let url = req.originalUrl;
        if (url.includes('/admin')) {
            return res.status(404).render('adminpage-404', {
                url: req.originalUrl,
            });
        } else {
            return res.status(404).render('page-404', {
                url: req.originalUrl,
            });
        }
    }

    res.status(err.statusCode).json({
        status: err.status,
        error: err,
        message: err.message,
        stack: err.stack,
    });
};

export default globalErrorHandler;
