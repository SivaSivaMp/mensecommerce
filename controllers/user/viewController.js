import AppError from '../../utils/appError.js';

// load home page
const loadHomepage = async (req, res, next) => {
    res.render('home-men');
};

export default { loadHomepage };
