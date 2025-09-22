import AppError from '../../utils/appError.js';
import bcrypt from 'bcryptjs';
import User from '../../models/userSchema.js';
import { sendVerificationEmail } from '../../utils/email.js';
import { generateOtp } from '../../utils/generateOtp.js';
// load login

const loadLogin = async (req, res) => {
    if (req.session?.user) {
        return res.redirect('/');
    }
    res.render('login', {
        title: 'Login',
        error: null,
    });
};

// load signup
const loadSignup = async (req, res) => {
    if (req.session?.user) {
        return res.redirect('/');
    }
    res.render('signup', {
        title: 'Register',
        error: null,
    });
};

// login-post

const login = async (req, res, next) => {
    try {
        const { email, password } = req.body;
        if (req.session.user) {
            return next(new AppError('user already logged in', 400));
        }
        if (!email || !password) {
            return next(new AppError('email or password is missing', 400));
        }

        const user = await User.findOne({ email }).select('+password');

        if (!user) {
            return next(new AppError('Invalid user credentials', 400));
        }
        if (user.isBlocked) {
            return next(new AppError('user is blocked', 400));
        }
        const isPasswordCorrect = await bcrypt.compare(password, user.password);
        if (!isPasswordCorrect) {
            return next(new AppError('Invalid user credentials', 400));
        }
        req.session.user = {
            id: user._id,
            name: user.name,
            email: user.email,
        };
        res.status(200).json({
            status: 'success',
            message: 'login is successful',
            redirectUrl: '/',
        });
    } catch (error) {
        next(error);
        console.error();
    }
};

// signup-post

const signup = async (req, res, next) => {
    try {
        const { name, email, password, cpassword } = req.body;
        if (!name || !email || !password || !cpassword) {
            return next(new AppError('please add all necessary fields', 400));
        }
        if (password !== cpassword) {
            return next(new AppError('password do not match', 400));
        }
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return next(new AppError('this user already exists', 400));
        }
        const otp = generateOtp();
        const emailSent = await sendVerificationEmail(email, otp);
        console.log('otp is :', otp);

        if (!emailSent) {
            return next(
                new AppError('Failed to send verification emil. Try again', 500)
            );
        }

  req.session.userOtp = otp;
  req.session.userData = { name, email, password };

        res.status(200).json({
            status: 'success',
            message: 'OTP sent succesfully',
            redirectUrl: '/verify-otp',
        });
    } catch (error) {
        console.log('Error occured', error);
    }
};

// get verify-otp

const getverifyOtp = async (req, res) => {
    try {
        res.render('verify-otp', { title: 'verify-otp', error: null });
    } catch (error) {
        console.log('error while rendering verify-otp page :', error);
    }
};

const verifyOtp=async(req,res,next)=>{

    try {
    
    const {otp}=req.body
    if(!req.session||!req.session.userOtp||!req.session.userData){
        return next(new AppError('session expired or invalid, please try again',400))
    }   
    if(otp!==req.session.userOtp){
    return next(new AppError('Invalid otp',400))
    }
       
        const {name,email,password}=req.session.userData
        const newUser=new User({name,email,password})
        await newUser.save()
        req.session.user={
            id:newUser._id,
            name:newUser.name,
            email:newUser.email
        }
        req.session.userOtp=null
        req.session.userData=null

        return res.status(200).json({
            status:'success',
            message:'OTP verified succesfully, welcome',
            redirectUrl:'/'
        })
       
          
    } catch (error) {
        console.log('Error during verifying otp',error);
        
    }


}

const resendOtp=async(req,res,next)=>{
    try {
  const { email } = req.session.userData;
  if (!email) {
    return next(new AppError('Email not Found in the session', 400));
  }
  const otp = generateOtp();
  console.log(`Resend OTP:`, otp);

  const emailSent = await sendVerificationEmail(email, otp);
  if (!emailSent) {
    return next(new AppError('Failed to resend the OTP', 400));
  }
  req.session.userOtp = otp;
  res.status(200).json({
    success: true,
    status: 'success',
    message: 'OTP resent successfully',
  });
    } catch (error) {
        console.log('error during resending the otp',error);
        
    }
}

const logout=async(req,res,next)=>{
    
    req.session.destroy((err)=>{
        next (new AppError('logout unsuccsfull',400))
    })
      res.clearCookie('connect.sid');
    return res.redirect('/');
}

export default { loadLogin, loadSignup, login, signup, getverifyOtp,verifyOtp,resendOtp,logout };
