export const notFound = (req, res, next) => {
    let url = req.originalUrl;
    if (url.includes('/admin')) {
        res.status(404).render('adminpage-404', {
            url: req.originalUrl,
        });
    } else {
        res.status(404).render('page-404', {
            url: req.originalUrl,
        });
    }
};
