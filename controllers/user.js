const dotenv = require('dotenv');
dotenv.config({ path: '.env' }); // See the file .env.example for the structure of .env
const User = require('../models/User');

// From https://stackoverflow.com/questions/2450954/how-to-randomize-shuffle-a-javascript-array
function shuffle(array) {
    let currentIndex = array.length,
        randomIndex;
    // While there remain elements to shuffle.
    while (currentIndex != 0) {
        // Pick a remaining element.
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex--;
        // And swap it with the current element.
        [array[currentIndex], array[randomIndex]] = [
            array[randomIndex], array[currentIndex]
        ];
    }
    return array;
}

// create random id for guest accounts
function makeid(length) {
    var result = '';
    var characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    var charactersLength = characters.length;
    for (var i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
}

/**
 * GET /logout
 * Handles user log out.
 */
exports.logout = async(req, res) => {
    const user = await User.findById(req.user.id).exec();
    const r_id = user.mturkID;
    user.logPage(Date.now(), '/thankyou');
    req.logout((err) => {
        if (err) console.log('Error : Failed to logout.', err);
        req.session.destroy((err) => {
            if (err) console.log('Error : Failed to destroy the session during logout.', err);
            req.user = null;
            res.redirect(`/thankyou?r_id=${r_id}`);
        });
    });
};

/**
 * GET /signup
 * Signup page.
 */
exports.getSignup = (req, res) => {
    if (req.user) {
        return res.redirect('/');
    }
    res.render('account/signup', {
        title: 'Create Account'
    });
};

/**
 * POST /signup
 * Create a new local account.
 */
exports.postSignup = async(req, res, next) => {
    // (1) If given r_id from Qualtrics: If user instance exists, go to profile page. If doens't exist, create a user instance. 
    // (2) If not given r_id from Qualtrics: Generate a random username, not used yet, and save user instance.
    if (req.query.r_id == 'null' || !req.query.r_id || req.query.r_id == 'undefined') {
        req.query.r_id = makeid(10);
    }

    let experimentalCondition;
    if (!req.query.c_id || req.query.c_id == 'null' || req.query.c_id == 'undefined') {
        const experimentalConditionNames = process.env.EXP_CONDITIONS_NAMES.split(",");
        const numConditions = experimentalConditionNames.length;
        experimentalCondition = experimentalConditionNames[(Math.floor(Math.random() * numConditions))];
    } else {
        experimentalCondition = req.query.c_id;
    }

    try {
        const existingUser = await User.findOne({ mturkID: req.query.r_id }).exec();
        if (existingUser && req.query.r_id) {
            existingUser.username = req.body.username;
            existingUser.profile.picture = req.body.photo;
            existingUser.profile.name = req.body.username;
            user = existingUser;
        } else {
            user = new User({
                mturkID: req.query.r_id,
                username: req.body.username,
                profile: {
                    name: req.body.username,
                    color: '#a6a488',
                    picture: req.body.photo
                },
                experimentalCondition: experimentalCondition,
                active: true,
                lastNotifyVisit: (Date.now()),
                createdAt: (Date.now())
            });
        }

        await user.save();
        req.logIn(user, (err) => {
            if (err) {
                return next(err);
            }
            const currDate = Date.now();
            const userAgent = req.headers['user-agent'];
            const user_ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
            user.logUser(currDate, userAgent, user_ip);
            res.set('Content-Type', 'application/json; charset=UTF-8');
            res.send({ result: "success" });
        });
    } catch (err) {
        next(err);
    }
};

/**
 * POST /account/interest
 * Update interest information.
 */
exports.postInterestInfo = async(req, res, next) => {
    try {
        const user = await User.findById(req.user.id).exec();
        user.interest = req.body.interest;
        user.consent = true;
        await user.save();
        res.set('Content-Type', 'application/json; charset=UTF-8');
        res.send({ result: "success" });
    } catch (err) {
        next(err);
    }
};

/**
 * POST /pageLog
 * Record user's page visit to pageLog.
 */
exports.postPageLog = async(req, res, next) => {
    try {
        const user = await User.findById(req.user.id).exec();
        user.logPage(Date.now(), req.body.path);
        res.set('Content-Type', 'application/json; charset=UTF-8');
        res.send({ result: "success" });
    } catch (err) {
        next(err);
    }
};

/**
 * POST /pageTimes
 * Record user's time on site to pageTimes.
 */
exports.postPageTime = async(req, res, next) => {
    try {
        const user = await User.findById(req.user.id).exec();
        // What day in the study is the user in? 
        const log = {
            time: req.body.time,
            page: req.body.pathname,
        };
        user.pageTimes.push(log);
        await user.save();
        res.set('Content-Type', 'application/json; charset=UTF-8');
        res.send({ result: "success" });
    } catch (err) {
        next(err);
    }
};

/**
 * GET /forgot
 * Forgot Password page.
 */
exports.getForgot = (req, res) => {
    if (req.isAuthenticated()) {
        return res.redirect('/');
    }
    res.render('account/forgot', {
        title: 'Forgot Password'
    });
};


/**
 * GET /userInfo
 * Get user profile and number of user comments
 */
exports.getUserProfile = async(req, res) => {
    try {
        const user = await User.findById(req.user.id).exec();
        res.set('Content-Type', 'application/json; charset=UTF-8');
        res.send({
            userProfile: user.profile,
            numComments: user.numComments
        });
    } catch (err) {
        next(err);
    }
}