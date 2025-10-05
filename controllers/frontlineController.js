
const User = require('../models/user');

const getLoginPage = (req, res) => {
    // We pass the user session to the view for the dynamic navbar
    res.render('login', { user: req.session.user });
};

const postLogin = async (req, res) => {
    try {
        const { username, password } = req.body;

        // 1. this helps find the user via username
        const user = await User.findOne({ username });
        if (!user) {
            //default message to might change later
            return res.status(401).json({message: "User not found", type: "error"});
        }

        // 2. comparer nang passwords
        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.status(401).json({message: "Incorrect Password", type: "error"});
        }

        // 3. generate session
        req.session.user = {
            id: user._id,
            username: user.username,
            role: user.role
        };

        // 4. redirect sa role based
        if (user.role === 'Admin') {
            res.redirect('/admin/dashboard');
        } else {
            res.redirect('/'); // Redirect Front Liner to the main order screen
        }
    } catch (error) {
        console.error(error);
        res.status(500).send('Server error during the login process.');
    }
};


const logoutUser = (req, res) => {
    req.session.destroy(err => {
        if (err) {
            console.error('Session destruction error:', err);
            return res.status(500).send('Could not log out.');
        }
        res.redirect('/login');
    });
};

const getOrderScreen = (req, res) => {
    
    if (!req.session.user || req.session.user.role !== 'Front Liner') {
        return res.redirect('/login');
    }
    res.render('frontline/index', { user: req.session.user });
};


module.exports = {
    getLoginPage,
    postLogin,
    logoutUser,
    getOrderScreen
};