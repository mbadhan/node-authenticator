"use strict";
const argon2 = require("argon2");
const router = require("express").Router();
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const User = require("../model/User");
const { registerValidation, loginValidation } = require("../validation");


// nodemailer
const transporter = nodemailer.createTransport({
  service: 'Gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASS,
  },
});


/*
 Email confirmation with token
 */

router.get('/confirm/:token', async (req, res) => {
  try {
    const { user } = jwt.verify(req.params.token, process.env.EMAIL_TOKEN);
    if (user) {
      await User.updateOne({ _id: user }, { confirmed: true });
      res.sendStatus(200);
    } else {
      res.sendStatus(400);
    }
  } catch (err) {
    res.sendStatus(500);
  }
})

/*
 Send reset password email
 */

router.post('/forgot', async (req, res) => {
  try {
    const user = await User.findOne({ email: req.body.email });
    if (user) {
      // Send email
      jwt.sign(
        {
          user: user._id,
        },
        process.env.RESET_TOKEN,
        {
          expiresIn: '15m',
        },
        async (err, resetToken) => {
          if (err) {
            return res.sendStatus(400);
          }

          await User.findByIdAndUpdate(user._id, { resetToken: resetToken });

          const url = `http://localhost:3000/api/user/forgot/${resetToken}`;
  
          transporter.sendMail({
            to: user.email,
            subject: 'Reset Password.',
            html: `Please click this email to reset your password: <a href="${url}">${url}</a>`,
          });
        }
      );
      res.sendStatus(200);
    } else {
      res.sendStatus(400);
    }
  } catch (err) {
    res.sendStatus(500);
  }
})


/*
 Verify reset token
 */

router.get('/forgot/verify/:token', async (req, res) => {
  try {
    const { user } = jwt.verify(req.params.token, process.env.RESET_TOKEN);

    const userObj = await User.findById(user);

    if (userObj.resetToken == req.params.token) {
      return res.sendStatus(200);
    } else {
      return res.sendStatus(400);
    }
  } catch (err) {
    res.sendStatus(500);
  }
})


/*
 Reset password with token
 */

router.post('/forgot/:token', async (req, res) => {
  try {
    const { user } = jwt.verify(req.params.token, process.env.RESET_TOKEN);

    const userObj = await User.findById(user);

    if (userObj.resetToken == req.params.token) {
      const bruh = await User.findOneAndUpdate(user, { resetToken: "" });
    } else {
      return res.sendStatus(400);
    }

    if (user) {
      // hash password
      const hash = await argon2.hash(req.body.password, {
        type: argon2.argon2id,
      });

      await User.updateOne({ _id: user }, { password: hash });

      res.sendStatus(200);
    } else {
      res.sendStatus(400);
    }
  } catch (err) {
    res.sendStatus(500);
  }
})


/*
 User register
 */

router.post('/register', async (req, res) => {  
  try {
    // Validation
    const { error } = await registerValidation(req.body);
    if (error) return res.status(400).send(error.details[0].message);

    // Check if the user is already registered
    const emailExist = await User.findOne({ email: req.body.email });
    if (emailExist) return res.status(400).send('User already registered');

    // Hash password
    const hash = await argon2.hash(req.body.password, {
      type: argon2.argon2id,
    });

    // Create a new user
    const user = new User({
      username: req.body.username,
      email: req.body.email,
      password: hash
    });
    
    const savedUser = await user.save();
    
    // Send email confirmation
    jwt.sign(
      {
        user: savedUser._id,
      },
      process.env.EMAIL_TOKEN,
      {
        expiresIn: '1d',
      },
      (err, emailToken) => {
        const url = `http://localhost:3000/confirm/${emailToken}`;

        transporter.sendMail({
          to: savedUser.email,
          subject: 'Confirm Email.',
          html: `Please click this email to confirm your email: <a href="${url}">${url}</a>`,
        });
      }
    );

    res.sendStatus(200);
  } catch(err) {
    res.status(400).send(err);
  }
});


/*
 User login
 */

router.post('/login', async (req, res) => {
  try {
    // Validation
    const { error } = await loginValidation(req.body);
    if (error) return res.status(400).send(error.details[0].message);

    // Check if the user is already registered
    const user = await User.findOne({ email: req.body.email });
    if (!user) return res.status(400).send('Email is not found.');

    // Check password
    const validPass = await argon2.verify(user.password, req.body.password);
    if (!validPass) return res.status(400).send('Password is incorrect.');

    // Check if email is confirmed
    if (!user.confirmed) return res.status(400).send('Please confirm your email.');

    // JWT
    const accessToken = generateAccessToken({ _id: user._id });
    const refreshToken = jwt.sign({ _id: user._id }, process.env.REFRESH_TOKEN_SECRET, { expiresIn: '30d' });
    
    await User.updateOne({ _id: user._id }, { refreshToken: refreshToken });

    res.header('auth-token', accessToken).header('refresh-token', refreshToken).status(200).send('bruh');
  } catch(err) {
    res.status(500).send(err);
  }
});


/*
 Request new access token
 */

router.post('/token', async (req, res) => {
  try {
    const refreshToken = req.header('refresh-token');
    if (refreshToken == null) return res.sendStatus(401);

    const user = await User.findOne({ refreshToken: refreshToken });
    if (!user) return res.sendStatus(403);

    jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET, async (err, user) => {
      if (err) {
        await User.updateOne({ refreshToken: refreshToken }, { refreshToken: "" });
        return res.sendStatus(403)
      }
      const accessToken = generateAccessToken( { _id: user._id } );
      const refreshToken = jwt.sign({ _id: user._id }, process.env.REFRESH_TOKEN_SECRET, { expiresIn: '7d' });

      await User.updateOne({ _id: user._id }, { refreshToken: refreshToken });

      res.header('auth-token', accessToken).header('refresh-token', refreshToken).status(200).send('bruh');
    });
  } catch (err) {
    res.status(500).send(err);
  }
});


/*
 Force Logout by Revoking Refresh Token
 */

router.delete('/logout', async (req, res) => {
  try {
    const refreshToken = req.header('refresh-token');
    await User.updateOne({ refreshToken: refreshToken }, { refreshToken: "" });
    res.sendStatus(204);
  } catch (err) {
    res.sendStatus(500);
  }
});


/*
 Generate new access token
 */

function generateAccessToken(user) {
  return jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '10m' });
}


module.exports = router;