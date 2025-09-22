import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
dotenv.config();
export async function sendVerificationEmail(email, otp) {
    try {

        const transporter = nodemailer.createTransport({
            service: 'gmail',
            port: 465,
            secure: true,
            requireTLS: true,
            auth: {
                user: process.env.NODEMAILER_EMAIL,
                pass: process.env.NODEMAILER_PASSWORD,
            },
        });

        const info = await transporter.sendMail({
            from: 'ecomus store Ecommerce Website',
            to: email,
            subject: 'Verify your account',
            text: `Your OTP is ${otp}`,
            html: `<b>Your OTP is: ${otp}. It is valid for one minute.</b>`,
            replyTo: process.env.NODEMAILER_EMAIL,
        });

        console.log('Email sent:', info.response);
        return info.accepted.length > 0;
    } catch (error) {
        console.error('Error sending email:', error);
        return false;
    }
}
