import AppError from '../../utils/appError.js';

// load home page
const loadHomepage = async (req, res, next) => {
    res.render('home-men');
};

// load login

const loadLogin = async () => {
    if (req.session?.user) {
        return res.redirect('/');
    }
    res.render('signup', {
        title: 'Register',
        error: null,
    });
};

// load homepage

export default { loadHomepage, loadLogin };
