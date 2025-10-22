export const attachLocals = (req, res, next) => {
    res.locals.user = req.session?.user || req.user || null;
    res.locals.admin = req.session?.admin || null;
    next();
};
