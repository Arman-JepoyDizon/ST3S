
const getDashboard = (req, res) => {
   
    res.render('admin/dashboard', { user: req.session.user });
};

module.exports = {
    getDashboard
};